import assert from 'node:assert/strict';
import test from 'node:test';
import { parseArgs } from '../../benchmarks/kimi-k3/cli.mjs';
import {
  buildBenchmarkPlan,
  KIMI_MODEL,
  KIMI_PLATFORM_ENDPOINT,
  runBenchmark,
} from '../../benchmarks/kimi-k3/runner.mjs';

const API_KEY = 'test-kimi-key-with-more-than-sixteen-characters';

test('defaults to a network-free dry run with all synthetic suites', async () => {
  const report = await runBenchmark();
  assert.equal(report.status, 'dry_run');
  assert.equal(report.networkRequested, false);
  assert.equal(report.taskCount, 6);
  assert.equal(report.endpoint, KIMI_PLATFORM_ENDPOINT);
  assert.equal(report.model, KIMI_MODEL);
  assert.equal(JSON.stringify(report).includes('Authorization'), false);
});

test('validates suite and CLI arguments before execution', () => {
  assert.equal(buildBenchmarkPlan('sentinel').length, 2);
  assert.deepEqual(parseArgs(['--suite', 'omc', '--reasoning', 'high', '--execute']), {
    suiteName: 'omc',
    reasoningEffort: 'high',
    execute: true,
    help: false,
  });
  assert.throws(() => buildBenchmarkPlan('unknown'), /Unknown suite/);
  assert.throws(() => parseArgs(['--base-url', 'https:\/\/example.com']), /Unknown argument/);
});

test('requires both the explicit network gate and an environment-only API key', async () => {
  await assert.rejects(
    () => runBenchmark({ suiteName: 'ai-hub', execute: true, env: { KIMI_API_KEY: API_KEY } }),
    /Network execution is locked/,
  );
  await assert.rejects(
    () => runBenchmark({ suiteName: 'ai-hub', execute: true, env: { KIMI_BENCHMARK_ALLOW_NETWORK: '1' } }),
    /KIMI_API_KEY is required/,
  );
});

test('runs only the fixed official endpoint and reports hashes instead of raw output', async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    const body = JSON.parse(options.body);
    const taskPrompt = body.messages[1].content;
    const content = taskPrompt.includes('launch date')
      ? '{"answer":"unknown","needsSource":true}'
      : '{"summary":"Median latency is 620 ms.","riskCount":2}';
    return new Response(JSON.stringify({
      choices: [{ message: { content } }],
      usage: { prompt_tokens: 40, completion_tokens: 12 },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const report = await runBenchmark({
    suiteName: 'ai-hub',
    execute: true,
    env: { KIMI_BENCHMARK_ALLOW_NETWORK: '1', KIMI_API_KEY: API_KEY },
    fetchImpl,
  });

  assert.equal(report.status, 'passed');
  assert.equal(requests.length, 2);
  assert.ok(requests.every((request) => request.url === KIMI_PLATFORM_ENDPOINT));
  assert.ok(requests.every((request) => request.options.headers.Authorization === `Bearer ${API_KEY}`));
  assert.ok(report.results.every((result) => /^[a-f0-9]{64}$/.test(result.outputSha256)));
  const serialized = JSON.stringify(report);
  assert.equal(serialized.includes(API_KEY), false);
  assert.equal(serialized.includes('Median latency'), false);
  assert.equal(serialized.includes('"answer":"unknown"'), false);
});

test('sanitizes provider and network failures', async () => {
  const providerFailure = await runBenchmark({
    suiteName: 'omc',
    execute: true,
    env: { KIMI_BENCHMARK_ALLOW_NETWORK: '1', KIMI_API_KEY: API_KEY },
    fetchImpl: async () => new Response('secret upstream detail', { status: 429 }),
  });
  assert.equal(providerFailure.status, 'failed');
  assert.ok(providerFailure.results.every((result) => result.error === 'provider_http_429'));
  assert.equal(JSON.stringify(providerFailure).includes('secret upstream detail'), false);

  const networkFailure = await runBenchmark({
    suiteName: 'sentinel',
    execute: true,
    env: { KIMI_BENCHMARK_ALLOW_NETWORK: '1', KIMI_API_KEY: API_KEY },
    fetchImpl: async () => {
      throw new Error('connect failed with sensitive proxy path');
    },
  });
  assert.ok(networkFailure.results.every((result) => result.error === 'benchmark_request_failed'));
  assert.equal(JSON.stringify(networkFailure).includes('sensitive proxy path'), false);

  const oversizedFailure = await runBenchmark({
    suiteName: 'ai-hub',
    execute: true,
    env: { KIMI_BENCHMARK_ALLOW_NETWORK: '1', KIMI_API_KEY: API_KEY },
    fetchImpl: async () => new Response('x'.repeat(70 * 1024), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  });
  assert.ok(oversizedFailure.results.every((result) => result.error === 'provider_response_too_large'));
});
