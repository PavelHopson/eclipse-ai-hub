import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { once } from 'node:events';
import { loadGatewayConfig } from '../src/config.mjs';
import { createGatewayServer } from '../src/server.mjs';

const TOKEN = 'test-service-token-with-at-least-32-characters';
const LIMITED_TOKEN = 'limited-service-token-with-at-least-32-characters';
const SECOND_TOKEN = 'second-client-token-with-at-least-32-characters';
const GROWTH_TOKEN = 'growth-client-token-with-at-least-32-characters';
const silentLogger = { info() {}, warn() {}, error() {} };

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

async function close(server) {
  server.close();
  await once(server, 'close');
}

function config(upstreamBaseUrl) {
  return loadGatewayConfig({
    AI_GATEWAY_SERVICE_TOKEN: TOKEN,
    AI_GATEWAY_UPSTREAM_BASE_URL: upstreamBaseUrl,
    AI_GATEWAY_MODELS: 'auto/best-chat,fast-chat',
    AI_GATEWAY_REQUESTS_PER_MINUTE: '20',
  });
}

test('rejects remote plaintext upstreams', () => {
  assert.throws(
    () => config('http://example.com/v1'),
    /Plain HTTP upstreams are allowed only on loopback/,
  );
});

test('accepts a bounded dual-token rotation window and rejects relative telemetry paths', async () => {
  const rotatingConfig = loadGatewayConfig({
    AI_GATEWAY_SERVICE_TOKENS: `${TOKEN},second-service-token-with-at-least-32-characters`,
    AI_GATEWAY_UPSTREAM_BASE_URL: 'http://127.0.0.1:20128/v1',
    AI_GATEWAY_MODELS: 'auto/best-chat',
  });
  assert.equal(rotatingConfig.serviceTokens.length, 2);
  assert.throws(
    () => loadGatewayConfig({
      AI_GATEWAY_SERVICE_TOKEN: TOKEN,
      AI_GATEWAY_UPSTREAM_BASE_URL: 'http://127.0.0.1:20128/v1',
      AI_GATEWAY_TELEMETRY_FILE: 'relative/telemetry.json',
    }),
    /must be an absolute path/,
  );

  const gateway = createGatewayServer(rotatingConfig, { logger: silentLogger });
  const gatewayUrl = await listen(gateway);
  try {
    for (const token of rotatingConfig.serviceTokens) {
      const response = await fetch(`${gatewayUrl}/v1/models`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(response.status, 200);
    }
  } finally {
    await close(gateway);
  }
});

test('requires service authentication for protected routes', async () => {
  const gateway = createGatewayServer(config('http://127.0.0.1:20128/v1'), { logger: silentLogger });
  const gatewayUrl = await listen(gateway);
  try {
    const response = await fetch(`${gatewayUrl}/v1/models`);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error.code, 'unauthorized');
  } finally {
    await close(gateway);
  }
});

test('enforces client scopes and isolates request budgets', async () => {
  const scopedConfig = loadGatewayConfig({
    AI_GATEWAY_SERVICE_CLIENTS: JSON.stringify([
      {
        id: 'limited-reader',
        tokens: [LIMITED_TOKEN],
        scopes: ['models:read'],
        requestsPerMinute: 1,
      },
      {
        id: 'chat-service',
        tokens: [SECOND_TOKEN],
        scopes: ['models:read', 'chat:write'],
        requestsPerMinute: 2,
      },
    ]),
    AI_GATEWAY_UPSTREAM_BASE_URL: 'http://127.0.0.1:20128/v1',
    AI_GATEWAY_MODELS: 'auto/best-chat',
  });
  assert.equal(scopedConfig.serviceClients.length, 2);
  assert.throws(
    () => loadGatewayConfig({
      AI_GATEWAY_SERVICE_CLIENTS: JSON.stringify([{
        id: 'duplicate-token-a',
        tokens: [LIMITED_TOKEN],
        scopes: ['models:read'],
      }, {
        id: 'duplicate-token-b',
        tokens: [LIMITED_TOKEN],
        scopes: ['models:read'],
      }]),
      AI_GATEWAY_UPSTREAM_BASE_URL: 'http://127.0.0.1:20128/v1',
    }),
    /tokens must be unique across clients/,
  );

  const gateway = createGatewayServer(scopedConfig, { logger: silentLogger });
  const gatewayUrl = await listen(gateway);
  try {
    const limitedModels = await fetch(`${gatewayUrl}/v1/models`, {
      headers: { Authorization: `Bearer ${LIMITED_TOKEN}` },
    });
    assert.equal(limitedModels.status, 200);
    await limitedModels.body.cancel();

    const limitedTelemetry = await fetch(`${gatewayUrl}/v1/telemetry`, {
      headers: { Authorization: `Bearer ${LIMITED_TOKEN}` },
    });
    assert.equal(limitedTelemetry.status, 403);
    assert.equal((await limitedTelemetry.json()).error.code, 'forbidden_scope');

    const limitedBudget = await fetch(`${gatewayUrl}/v1/models`, {
      headers: { Authorization: `Bearer ${LIMITED_TOKEN}` },
    });
    assert.equal(limitedBudget.status, 429);

    const independentBudget = await fetch(`${gatewayUrl}/v1/models`, {
      headers: { Authorization: `Bearer ${SECOND_TOKEN}` },
    });
    assert.equal(independentBudget.status, 200);
    await independentBudget.body.cancel();
  } finally {
    await close(gateway);
  }
});

test('isolates the Growth executor behind its own scope and fixed workflow', async () => {
  let received;
  let growthContent = JSON.stringify({
    schemaVersion: 'growth.research.v2',
    verifiedFacts: [{
      claim: 'Gateway выполняет один ограниченный Growth-шаг.',
      evidenceId: 'EF-001',
      evidenceBoundary: 'Проверяется только переданным публичным источником.',
    }],
    hypotheses: [],
    unknowns: [],
  });
  const upstream = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    received = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({
      model: 'selected-growth-model',
      choices: [{ message: { role: 'assistant', content: growthContent } }],
      usage: { prompt_tokens: 120, completion_tokens: 25 },
    }));
  });
  const upstreamUrl = await listen(upstream);
  const growthConfig = loadGatewayConfig({
    AI_GATEWAY_SERVICE_CLIENTS: JSON.stringify([
      { id: 'chat-only', tokens: [SECOND_TOKEN], scopes: ['chat:write'], requestsPerMinute: 10 },
      { id: 'growth-only', tokens: [GROWTH_TOKEN], scopes: ['growth:execute'], requestsPerMinute: 10 },
    ]),
    AI_GATEWAY_UPSTREAM_BASE_URL: `${upstreamUrl}/v1`,
    AI_GATEWAY_MODELS: 'auto/best-chat',
  });
  const gateway = createGatewayServer(growthConfig, { logger: silentLogger });
  const gatewayUrl = await listen(gateway);
  const body = {
    schemaVersion: 'growth.execute.v1',
    step: 'research',
    run: {
      id: 'growth-run-1',
      input: {
        releaseName: 'Eclipse Growth executor',
        releaseSummary: 'Пошаговый исполнитель создаёт только текстовый материал без публикации.',
        audience: 'Команда Eclipse Forge',
        channel: 'telegram',
        sourceUrls: ['https://example.com/release'],
        evidenceNotes: 'Источник передан как данные и не открывается самим AI gateway.',
        evidenceCards: [{
          id: 'EF-001',
          claim: 'Gateway выполняет один ограниченный Growth-шаг.',
          state: 'verified',
          sourceUrl: 'https://example.com/release',
          evidenceBoundary: 'Проверяется только переданным публичным источником.',
        }],
      },
      artifacts: [],
    },
  };
  try {
    const unauthenticated = await fetch(`${gatewayUrl}/v1/growth/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    assert.equal(unauthenticated.status, 401);

    const wrongScope = await fetch(`${gatewayUrl}/v1/growth/execute`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SECOND_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    assert.equal(wrongScope.status, 403);
    assert.equal((await wrongScope.json()).error.code, 'forbidden_scope');

    const outOfOrder = await fetch(`${gatewayUrl}/v1/growth/execute`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${GROWTH_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, step: 'draft' }),
    });
    assert.equal(outOfOrder.status, 400);
    assert.equal((await outOfOrder.json()).error.code, 'growth_step_out_of_order');

    const success = await fetch(`${gatewayUrl}/v1/growth/execute`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${GROWTH_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    assert.equal(success.status, 200);
    const result = await success.json();
    assert.equal(result.schemaVersion, 'growth.execute.result.v1');
    assert.equal(result.step, 'research');
    assert.equal(result.role, 'Researcher');
    assert.equal(result.model, 'selected-growth-model');
    assert.equal(JSON.parse(result.content).schemaVersion, 'growth.research.v2');
    assert.equal(received.model, 'auto/best-chat');
    assert.equal(received.tools, undefined);
    assert.equal(received.tool_choice, undefined);
    assert.match(received.messages[0].content, /не открывай ссылки|не публикуй материалы/);
    assert.match(received.messages[0].content, /growth\.research\.v2/);
    assert.match(received.messages[1].content, /"id": "EF-001"/);
    assert.match(received.messages[1].content, /DATA START/);

    growthContent = 'invalid role output containing private upstream diagnostics';
    const invalidOutput = await fetch(`${gatewayUrl}/v1/growth/execute`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${GROWTH_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    assert.equal(invalidOutput.status, 502);
    const invalidPayload = await invalidOutput.json();
    assert.equal(invalidPayload.error.code, 'invalid_upstream_response');
    assert.doesNotMatch(JSON.stringify(invalidPayload), /private upstream diagnostics/);
  } finally {
    await close(gateway);
    await close(upstream);
  }
});

test('proxies an allowed completion without exposing the upstream key', async () => {
  let received;
  let includeUsageHeaders = true;
  const upstream = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    received = {
      authorization: request.headers.authorization,
      requestId: request.headers['x-request-id'],
      body: JSON.parse(Buffer.concat(chunks).toString('utf8')),
    };
    response.writeHead(200, {
      'Content-Type': 'application/json',
      ...(includeUsageHeaders ? {
        'X-OmniRoute-Response-Cost': '0.0015',
        'X-OmniRoute-Tokens-In': '40',
        'X-OmniRoute-Tokens-Out': '10',
      } : {}),
    });
    response.end(JSON.stringify({
      id: 'completion-1',
      object: 'chat.completion',
      model: 'upstream-selected-model',
      choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 4, completion_tokens: 1 },
    }));
  });
  const upstreamUrl = await listen(upstream);
  const gatewayConfig = { ...config(`${upstreamUrl}/v1`), upstreamApiKey: 'upstream-secret' };
  const gateway = createGatewayServer(gatewayConfig, { logger: silentLogger });
  const gatewayUrl = await listen(gateway);

  try {
    const response = await fetch(`${gatewayUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        'X-Request-Id': 'chat-request-1',
      },
      body: JSON.stringify({
        model: 'auto/best-chat',
        messages: [{ role: 'user', content: 'Ответь: ok' }],
        stream: false,
      }),
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-request-id'), 'chat-request-1');
    assert.match(response.headers.get('x-eclipse-latency-ms'), /^\d+$/);
    assert.equal((await response.json()).choices[0].message.content, 'ok');
    assert.equal(received.authorization, 'Bearer upstream-secret');
    assert.equal(received.requestId, 'chat-request-1');
    assert.equal(received.body.stream, false);

    includeUsageHeaders = false;
    const fallbackUsageResponse = await fetch(`${gatewayUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'auto/best-chat',
        messages: [{ role: 'user', content: 'Return: ok' }],
        stream: false,
      }),
    });
    assert.equal(fallbackUsageResponse.status, 200);
    await fallbackUsageResponse.body.cancel();

    const telemetryResponse = await fetch(`${gatewayUrl}/v1/telemetry`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    assert.equal(telemetryResponse.status, 200);
    const telemetry = await telemetryResponse.json();
    assert.equal(telemetry.windows['24h'].requests, 2);
    assert.equal(telemetry.windows['24h'].successes, 2);
    assert.equal(telemetry.windows['24h'].costUsd, 0.0015);
    assert.equal(telemetry.windows['24h'].promptTokens, 44);
    assert.equal(telemetry.windows['24h'].completionTokens, 11);
    assert.equal(telemetry.windows['24h'].slo.status, 'healthy');
  } finally {
    await close(gateway);
    await close(upstream);
  }
});

test('blocks unlisted models, streaming, and fields outside ai.v1 before reaching upstream', async () => {
  const gateway = createGatewayServer(config('http://127.0.0.1:20128/v1'), { logger: silentLogger });
  const gatewayUrl = await listen(gateway);
  try {
    const request = async (body) => fetch(`${gatewayUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const unknownModel = await request({ model: 'unknown', messages: [{ role: 'user', content: 'test' }] });
    assert.equal(unknownModel.status, 400);
    assert.equal((await unknownModel.json()).error.code, 'model_not_allowed');

    const streaming = await request({
      model: 'auto/best-chat',
      messages: [{ role: 'user', content: 'test' }],
      stream: true,
    });
    assert.equal(streaming.status, 400);
    assert.equal((await streaming.json()).error.code, 'stream_not_supported');

    const unsupportedField = await request({
      model: 'auto/best-chat',
      messages: [{ role: 'user', content: 'test' }],
      user: 'must-not-pass-through',
    });
    assert.equal(unsupportedField.status, 400);
    assert.equal((await unsupportedField.json()).error.code, 'unsupported_field');
  } finally {
    await close(gateway);
  }
});

test('does not expose an upstream error body', async () => {
  const upstream = createServer((_request, response) => {
    response.writeHead(500, { 'Content-Type': 'text/plain' });
    response.end('private upstream diagnostics and prompt fragments');
  });
  const upstreamUrl = await listen(upstream);
  const gateway = createGatewayServer(config(`${upstreamUrl}/v1`), { logger: silentLogger });
  const gatewayUrl = await listen(gateway);
  try {
    const response = await fetch(`${gatewayUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'auto/best-chat', messages: [{ role: 'user', content: 'secret' }] }),
    });
    assert.equal(response.status, 502);
    const raw = await response.text();
    assert.doesNotMatch(raw, /private upstream diagnostics|prompt fragments/);
  } finally {
    await close(gateway);
    await close(upstream);
  }
});

test('normalizes network failures and rejects oversized upstream responses', async () => {
  const unavailableGateway = createGatewayServer(config('http://127.0.0.1:1/v1'), { logger: silentLogger });
  const unavailableUrl = await listen(unavailableGateway);
  const completionBody = JSON.stringify({
    model: 'auto/best-chat',
    messages: [{ role: 'user', content: 'test' }],
  });
  try {
    const response = await fetch(`${unavailableUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: completionBody,
    });
    assert.equal(response.status, 502);
    assert.equal((await response.json()).error.code, 'upstream_unavailable');
  } finally {
    await close(unavailableGateway);
  }

  const oversizedUpstream = createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': '5000000' });
    response.end('{}');
  });
  const oversizedUpstreamUrl = await listen(oversizedUpstream);
  const oversizedGateway = createGatewayServer(config(`${oversizedUpstreamUrl}/v1`), { logger: silentLogger });
  const oversizedGatewayUrl = await listen(oversizedGateway);
  try {
    const response = await fetch(`${oversizedGatewayUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: completionBody,
    });
    assert.equal(response.status, 502);
    assert.equal((await response.json()).error.code, 'upstream_response_too_large');
  } finally {
    await close(oversizedGateway);
    await close(oversizedUpstream);
  }
});
