import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import { loadGatewayConfig } from '../src/config.mjs';
import { createProviderRouter } from '../src/provider-router.mjs';
import { createGatewayServer } from '../src/server.mjs';

const SERVICE_TOKEN = 'provider-router-test-token-with-32-characters';
const silentLogger = { info() {}, warn() {}, error() {} };

function routes(overrides = {}) {
  return [{
    id: 'primary',
    baseUrl: 'https://primary.invalid/v1',
    apiKey: 'must-never-appear',
    models: ['auto/best-chat'],
    priority: 0,
    monthlyTokenBudget: null,
    ...overrides.primary,
  }, {
    id: 'backup',
    baseUrl: 'http://127.0.0.1:11434/v1',
    models: ['auto/best-chat'],
    priority: 1,
    monthlyTokenBudget: null,
    ...overrides.backup,
  }];
}

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

test('retries a transient provider and falls back after its circuit opens', async () => {
  let now = Date.UTC(2026, 7, 30);
  const calls = [];
  const router = createProviderRouter(routes(), {
    clock: () => now,
    retryAttempts: 2,
    retryDelayMs: 0,
    circuitFailures: 2,
    circuitCooldownMs: 1_000,
  });
  const transient = Object.assign(new Error('temporary'), { retryable: true });
  const result = await router.execute({
    model: 'auto/best-chat',
    estimatedTokens: 100,
    run: async (route, attempt) => {
      calls.push(`${route.id}:${attempt}`);
      if (route.id === 'primary') throw transient;
      now += 12;
      return { payload: { ok: true }, usageTokens: 80 };
    },
    isRetryable: (error) => error.retryable === true,
  });

  assert.deepEqual(calls, ['primary:1', 'primary:2', 'backup:1']);
  assert.equal(result.routeId, 'backup');
  assert.equal(result.fallbackUsed, true);
  assert.equal(router.summary().routes[0].status, 'circuit-open');
  assert.equal(router.summary().routes[1].remainingTokens, null);
});

test('skips a provider whose monthly token budget cannot cover the reservation', async () => {
  const router = createProviderRouter(routes({
    primary: { monthlyTokenBudget: 1_000 },
    backup: { monthlyTokenBudget: 2_000 },
  }), { retryAttempts: 1 });

  const first = await router.execute({
    model: 'auto/best-chat',
    estimatedTokens: 900,
    run: async () => ({ usageTokens: 900 }),
    isRetryable: () => false,
  });
  assert.equal(first.routeId, 'primary');

  const second = await router.execute({
    model: 'auto/best-chat',
    estimatedTokens: 200,
    run: async () => ({ usageTokens: 120 }),
    isRetryable: () => false,
  });
  assert.equal(second.routeId, 'backup');
  assert.equal(second.fallbackUsed, true);
  assert.equal(router.summary().routes[0].remainingTokens, 100);
});

test('does not send a non-retryable rejection to another provider', async () => {
  const router = createProviderRouter(routes(), { retryAttempts: 3, retryDelayMs: 0 });
  const denied = new Error('denied');
  let calls = 0;
  await assert.rejects(router.execute({
    model: 'auto/best-chat',
    estimatedTokens: 100,
    run: async () => {
      calls += 1;
      throw denied;
    },
    isRetryable: () => false,
  }), (error) => error === denied);
  assert.equal(calls, 1);
});

test('provider health summary never includes URLs or credentials', () => {
  const router = createProviderRouter(routes());
  const summary = JSON.stringify(router.summary());
  assert.doesNotMatch(summary, /primary\.invalid|127\.0\.0\.1|must-never-appear|apiKey|baseUrl/);
  assert.match(summary, /eclipse\.provider-health\.v1/);
});

test('loads a bounded multi-provider registry from secret environment references', () => {
  const config = loadGatewayConfig({
    AI_GATEWAY_SERVICE_TOKEN: SERVICE_TOKEN,
    AI_GATEWAY_MODELS: 'auto/best-chat,local/qwen',
    PRIMARY_KEY: 'server-side-secret',
    AI_GATEWAY_UPSTREAMS: JSON.stringify([{
      id: 'cloud-primary',
      baseUrl: 'https://api.example.com/v1',
      apiKeyEnv: 'PRIMARY_KEY',
      models: ['auto/best-chat'],
      priority: 0,
      monthlyTokenBudget: 1_500_000_000,
    }, {
      id: 'ollama-local',
      baseUrl: 'http://127.0.0.1:11434/v1',
      models: ['local/qwen'],
      priority: 1,
      monthlyTokenBudget: null,
    }]),
  });

  assert.equal(config.upstreams.length, 2);
  assert.equal(config.upstreams[0].apiKey, 'server-side-secret');
  assert.equal(config.upstreams[0].monthlyTokenBudget, 1_500_000_000);
  assert.equal(config.upstreamBaseUrl, 'https://api.example.com/v1');
  assert.throws(() => loadGatewayConfig({
    AI_GATEWAY_SERVICE_TOKEN: SERVICE_TOKEN,
    AI_GATEWAY_MODELS: 'auto/best-chat',
    AI_GATEWAY_UPSTREAMS: JSON.stringify([{
      id: 'unsafe',
      baseUrl: 'http://example.com/v1',
      models: ['auto/best-chat'],
    }]),
  }), /Plain HTTP upstreams are allowed only on loopback/);
  assert.throws(() => loadGatewayConfig({
    AI_GATEWAY_SERVICE_TOKEN: SERVICE_TOKEN,
    AI_GATEWAY_MODELS: 'auto/best-chat',
    AI_GATEWAY_UPSTREAMS: JSON.stringify([{
      id: 'plain-secret',
      baseUrl: 'https://example.com/v1',
      apiKey: 'forbidden-inline-secret',
      models: ['auto/best-chat'],
    }]),
  }), /unsupported field/);
  assert.throws(() => loadGatewayConfig({
    AI_GATEWAY_SERVICE_TOKEN: SERVICE_TOKEN,
    AI_GATEWAY_MODELS: 'auto/best-chat',
    AI_GATEWAY_UPSTREAMS: JSON.stringify([{
      id: 'missing-secret',
      baseUrl: 'https://example.com/v1',
      apiKeyEnv: 'MISSING_KEY',
      models: ['auto/best-chat'],
    }]),
  }), /does not reference a configured secret/);
});

test('gateway falls back on a transient provider failure and exposes only safe route metadata', async () => {
  let primaryCalls = 0;
  let backupCalls = 0;
  const primary = createServer((_request, response) => {
    primaryCalls += 1;
    response.writeHead(503, { 'Content-Type': 'text/plain' });
    response.end('private primary diagnostics');
  });
  const backup = createServer((_request, response) => {
    backupCalls += 1;
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({
      model: 'backup-model',
      choices: [{ message: { role: 'assistant', content: 'готово' } }],
      usage: { prompt_tokens: 4, completion_tokens: 2 },
    }));
  });
  const primaryUrl = await listen(primary);
  const backupUrl = await listen(backup);
  const config = loadGatewayConfig({
    AI_GATEWAY_SERVICE_TOKEN: SERVICE_TOKEN,
    AI_GATEWAY_MODELS: 'auto/best-chat',
    AI_GATEWAY_PROVIDER_RETRY_ATTEMPTS: '1',
    AI_GATEWAY_UPSTREAMS: JSON.stringify([{
      id: 'primary',
      baseUrl: `${primaryUrl}/v1`,
      models: ['auto/best-chat'],
      priority: 0,
      monthlyTokenBudget: 10_000,
    }, {
      id: 'backup',
      baseUrl: `${backupUrl}/v1`,
      models: ['auto/best-chat'],
      priority: 1,
      monthlyTokenBudget: 10_000,
    }]),
  });
  const gateway = createGatewayServer(config, { logger: silentLogger });
  const gatewayUrl = await listen(gateway);
  try {
    const response = await fetch(`${gatewayUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SERVICE_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'auto/best-chat',
        messages: [{ role: 'user', content: 'Проверь резервный маршрут' }],
        max_tokens: 100,
      }),
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-eclipse-upstream'), 'backup');
    assert.equal(response.headers.get('x-eclipse-fallback'), '1');
    assert.equal(response.headers.get('x-eclipse-attempts'), '1');
    assert.equal((await response.json()).choices[0].message.content, 'готово');
    assert.equal(primaryCalls, 1);
    assert.equal(backupCalls, 1);

    const healthResponse = await fetch(`${gatewayUrl}/v1/providers/health`, {
      headers: { Authorization: `Bearer ${SERVICE_TOKEN}` },
    });
    assert.equal(healthResponse.status, 200);
    const healthText = await healthResponse.text();
    assert.match(healthText, /eclipse\.provider-health\.v1/);
    assert.doesNotMatch(healthText, /private primary diagnostics|127\.0\.0\.1/);

    const telemetryResponse = await fetch(`${gatewayUrl}/v1/telemetry`, {
      headers: { Authorization: `Bearer ${SERVICE_TOKEN}` },
    });
    const telemetryText = await telemetryResponse.text();
    assert.match(telemetryText, /eclipse\.provider-health\.v1/);
    assert.doesNotMatch(telemetryText, /private primary diagnostics|127\.0\.0\.1/);
  } finally {
    await close(gateway);
    await close(primary);
    await close(backup);
  }
});

test('keeps concurrent token reservations isolated until every request settles', async () => {
  const primary = { ...routes()[0], monthlyTokenBudget: 1_500 };
  const router = createProviderRouter([primary], { retryAttempts: 1 });
  const releases = [];
  const run = () => new Promise((resolve) => releases.push(resolve));
  const request = () => router.execute({
    model: 'auto/best-chat',
    estimatedTokens: 600,
    run,
    isRetryable: () => false,
  });

  const first = request();
  const second = request();
  assert.equal(releases.length, 2);
  assert.equal(router.summary().routes[0].remainingTokens, 300);

  releases[0]({ usageTokens: 600 });
  await first;
  assert.equal(router.summary().routes[0].remainingTokens, 300);
  await assert.rejects(router.execute({
    model: 'auto/best-chat',
    estimatedTokens: 400,
    run: async () => ({ usageTokens: 1 }),
    isRetryable: () => false,
  }), (error) => error.code === 'provider_capacity_exhausted');

  releases[1]({ usageTokens: 600 });
  await second;
  assert.equal(router.summary().routes[0].remainingTokens, 300);
});
