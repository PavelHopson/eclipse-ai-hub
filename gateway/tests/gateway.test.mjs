import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { once } from 'node:events';
import { loadGatewayConfig } from '../src/config.mjs';
import { createGatewayServer } from '../src/server.mjs';

const TOKEN = 'test-service-token-with-at-least-32-characters';
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

test('proxies an allowed completion without exposing the upstream key', async () => {
  let received;
  const upstream = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    received = {
      authorization: request.headers.authorization,
      requestId: request.headers['x-request-id'],
      body: JSON.parse(Buffer.concat(chunks).toString('utf8')),
    };
    response.writeHead(200, { 'Content-Type': 'application/json' });
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
