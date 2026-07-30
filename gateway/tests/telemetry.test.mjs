import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { GatewayTelemetry } from '../src/telemetry.mjs';

const silentLogger = { info() {}, warn() {}, error() {} };

test('persists aggregate-only SLO telemetry without content or identifiers', () => {
  const directory = mkdtempSync(join(tmpdir(), 'eclipse-ai-telemetry-'));
  const filePath = join(directory, 'telemetry.json');
  const now = Date.parse('2026-07-30T12:30:00.000Z');
  try {
    const telemetry = new GatewayTelemetry({
      filePath,
      retentionHours: 168,
      availabilityTargetPercent: 99,
      p95LatencyTargetMs: 15_000,
      now: () => now,
      logger: silentLogger,
    });
    telemetry.record({
      status: 200,
      latencyMs: 420,
      costUsd: 0.00125,
      promptTokens: 80,
      completionTokens: 20,
      prompt: 'must-not-be-stored',
      requestId: 'private-request-id',
    });
    telemetry.record({ status: 502, latencyMs: 600, errorCode: 'upstream_unavailable' });
    telemetry.record({ status: 400, latencyMs: 5, errorCode: 'invalid_request' });
    telemetry.flush();

    const persisted = readFileSync(filePath, 'utf8');
    assert.doesNotMatch(persisted, /must-not-be-stored|private-request-id/);

    const restored = new GatewayTelemetry({
      filePath,
      retentionHours: 168,
      availabilityTargetPercent: 99,
      p95LatencyTargetMs: 15_000,
      now: () => now,
      logger: silentLogger,
    });
    const summary = restored.summary();
    assert.deepEqual(summary.privacy, {
      aggregation: 'hourly',
      contentStored: false,
      identifiersStored: false,
    });
    assert.equal(summary.persistence, 'file');
    assert.equal(summary.windows['24h'].requests, 3);
    assert.equal(summary.windows['24h'].successes, 1);
    assert.equal(summary.windows['24h'].clientErrors, 1);
    assert.equal(summary.windows['24h'].serviceErrors, 1);
    assert.equal(summary.windows['24h'].availabilityPercent, 50);
    assert.equal(summary.windows['24h'].p95LatencyMs, 1_000);
    assert.equal(summary.windows['24h'].costUsd, 0.00125);
    assert.equal(summary.windows['24h'].promptTokens, 80);
    assert.equal(summary.windows['24h'].completionTokens, 20);
    assert.deepEqual(summary.windows['24h'].topErrors, [
      { code: 'invalid_request', count: 1 },
      { code: 'upstream_unavailable', count: 1 },
    ]);
    assert.equal(summary.windows['24h'].slo.status, 'breached');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
