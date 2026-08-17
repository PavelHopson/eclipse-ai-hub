import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { once } from 'node:events';
import { loadGatewayConfig } from '../src/config.mjs';
import { buildGpt56ResponseRequest } from '../src/gpt56-router.mjs';
import { createGatewayServer } from '../src/server.mjs';

const ROUTER_TOKEN = 'router-service-token-with-at-least-32-characters';
const READER_TOKEN = 'reader-service-token-with-at-least-32-characters';
const silentLogger = { info() {}, warn() {}, error() {} };

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return 'http://127.0.0.1:' + server.address().port;
}

async function close(server) {
  server.close();
  await once(server, 'close');
}

function routerConfig(upstreamBaseUrl, enabled = true) {
  return loadGatewayConfig({
    AI_GATEWAY_SERVICE_CLIENTS: JSON.stringify([
      {
        id: 'router',
        tokens: [ROUTER_TOKEN],
        scopes: ['responses:write', 'telemetry:read'],
        requestsPerMinute: 20,
      },
      {
        id: 'reader',
        tokens: [READER_TOKEN],
        scopes: ['models:read'],
        requestsPerMinute: 20,
      },
    ]),
    AI_GATEWAY_UPSTREAM_BASE_URL: upstreamBaseUrl,
    AI_GATEWAY_MODELS: 'auto/best-chat',
    AI_GATEWAY_GPT56_ROUTER_ENABLED: String(enabled),
  });
}

test('maps bounded profiles to fixed GPT-5.6 models and disables storage', () => {
  const fast = buildGpt56ResponseRequest({
    schemaVersion: 'eclipse.gpt56.request.v1',
    profile: 'fast',
    input: 'Classify this item.',
  });
  assert.equal(fast.request.model, 'gpt-5.6-luna');
  assert.equal(fast.request.reasoning.effort, 'low');
  assert.equal(fast.request.store, false);

  const balanced = buildGpt56ResponseRequest({
    schemaVersion: 'eclipse.gpt56.request.v1',
    input: 'Draft a bounded product note.',
    maxOutputTokens: 800,
  });
  assert.equal(balanced.meta.profile, 'balanced');
  assert.equal(balanced.request.model, 'gpt-5.6-terra');
  assert.equal(balanced.request.reasoning.effort, 'medium');
  assert.equal(balanced.request.max_output_tokens, 800);

  const deep = buildGpt56ResponseRequest({
    schemaVersion: 'eclipse.gpt56.request.v1',
    profile: 'deep',
    input: 'Review this architecture.',
    instructions: 'Do not execute tools.',
  });
  assert.equal(deep.request.model, 'gpt-5.6-sol');
  assert.equal(deep.request.reasoning.effort, 'high');
});

test('rejects pass-through fields and invalid profiles', () => {
  assert.throws(
    () => buildGpt56ResponseRequest({
      schemaVersion: 'eclipse.gpt56.request.v1',
      input: 'test',
      model: 'attacker-selected-model',
    }),
    (error) => error.code === 'unsupported_field',
  );
  assert.throws(
    () => buildGpt56ResponseRequest({
      schemaVersion: 'eclipse.gpt56.request.v1',
      profile: 'unbounded',
      input: 'test',
    }),
    (error) => error.code === 'invalid_profile',
  );
});

test('keeps the router feature-flagged and scope-isolated', async () => {
  const disabled = createGatewayServer(routerConfig('http://127.0.0.1:20128/v1', false), { logger: silentLogger });
  const disabledUrl = await listen(disabled);
  try {
    const response = await fetch(disabledUrl + '/v1/router/responses', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + ROUTER_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schemaVersion: 'eclipse.gpt56.request.v1',
        input: 'test',
      }),
    });
    assert.equal(response.status, 404);
  } finally {
    await close(disabled);
  }

  const enabled = createGatewayServer(routerConfig('http://127.0.0.1:20128/v1'), { logger: silentLogger });
  const enabledUrl = await listen(enabled);
  try {
    const response = await fetch(enabledUrl + '/v1/router/responses', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + READER_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schemaVersion: 'eclipse.gpt56.request.v1',
        input: 'test',
      }),
    });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error.code, 'forbidden_scope');
  } finally {
    await close(enabled);
  }
});

test('routes a balanced request through Responses API without exposing upstream credentials', async () => {
  let received;
  const upstream = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    received = {
      path: request.url,
      authorization: request.headers.authorization,
      eclipseClient: request.headers['x-eclipse-client'],
      body: JSON.parse(Buffer.concat(chunks).toString('utf8')),
    };
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({
      id: 'resp_test',
      object: 'response',
      model: 'gpt-5.6-terra',
      output: [{ type: 'message', role: 'assistant', content: [] }],
      usage: { input_tokens: 31, output_tokens: 9 },
    }));
  });
  const upstreamUrl = await listen(upstream);
  const configured = {
    ...routerConfig(upstreamUrl + '/v1'),
    upstreamApiKey: 'upstream-only-secret',
  };
  const gateway = createGatewayServer(configured, { logger: silentLogger });
  const gatewayUrl = await listen(gateway);
  try {
    const response = await fetch(gatewayUrl + '/v1/router/responses', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + ROUTER_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        schemaVersion: 'eclipse.gpt56.request.v1',
        profile: 'balanced',
        input: 'Produce a concise release risk summary.',
        instructions: 'Use only supplied facts.',
      }),
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.schemaVersion, 'eclipse.gpt56.response.v1');
    assert.equal(payload.route.model, 'gpt-5.6-terra');
    assert.equal(payload.usage.inputTokens, 31);
    assert.equal(response.headers.get('x-eclipse-route-profile'), 'balanced');
    assert.equal(received.path, '/v1/responses');
    assert.equal(received.authorization, 'Bearer upstream-only-secret');
    assert.equal(received.eclipseClient, 'eclipse-ai-gateway-gpt56-router');
    assert.equal(received.body.model, 'gpt-5.6-terra');
    assert.equal(received.body.reasoning.effort, 'medium');
    assert.equal(received.body.store, false);
    assert.equal(received.body.tools, undefined);
    assert.doesNotMatch(JSON.stringify(payload), /upstream-only-secret/);
  } finally {
    await close(gateway);
    await close(upstream);
  }
});

test('rejects invalid router fields before contacting the upstream', async () => {
  let upstreamCalls = 0;
  const upstream = createServer((_request, response) => {
    upstreamCalls += 1;
    response.writeHead(500);
    response.end();
  });
  const upstreamUrl = await listen(upstream);
  const gateway = createGatewayServer(routerConfig(upstreamUrl + '/v1'), { logger: silentLogger });
  const gatewayUrl = await listen(gateway);
  try {
    const response = await fetch(gatewayUrl + '/v1/router/responses', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + ROUTER_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schemaVersion: 'eclipse.gpt56.request.v1',
        input: 'test',
        tools: [{ type: 'computer' }],
      }),
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'unsupported_field');
    assert.equal(upstreamCalls, 0);
  } finally {
    await close(gateway);
    await close(upstream);
  }
});