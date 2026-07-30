import {
  chmodSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';

const TELEMETRY_VERSION = 1;
const LATENCY_BOUNDS_MS = Object.freeze([100, 250, 500, 1_000, 2_500, 5_000, 10_000, 15_000, 30_000, 60_000, Infinity]);
const SUMMARY_WINDOWS = Object.freeze({ '1h': 1, '24h': 24, '7d': 168 });

function finiteNumber(value, fallback = 0) {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function integer(value, fallback = 0) {
  return Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}

function hourStart(timestamp) {
  const date = new Date(timestamp);
  date.setUTCMinutes(0, 0, 0);
  return date.toISOString();
}

function emptyBucket(startedAt) {
  return {
    startedAt,
    requests: 0,
    successes: 0,
    clientErrors: 0,
    serviceErrors: 0,
    latencyCount: 0,
    latencyTotalMs: 0,
    latencyMaxMs: 0,
    latencyHistogram: Array.from({ length: LATENCY_BOUNDS_MS.length }, () => 0),
    costUsd: 0,
    promptTokens: 0,
    completionTokens: 0,
    errors: {},
  };
}

function safeErrorCode(value) {
  return typeof value === 'string' && /^[a-z0-9_]{1,64}$/.test(value) ? value : 'unknown_error';
}

function normalizeBucket(value) {
  if (!value || typeof value !== 'object' || Number.isNaN(Date.parse(value.startedAt))) return null;
  const bucket = emptyBucket(hourStart(Date.parse(value.startedAt)));
  for (const key of ['requests', 'successes', 'clientErrors', 'serviceErrors', 'latencyCount', 'promptTokens', 'completionTokens']) {
    bucket[key] = integer(value[key]);
  }
  bucket.latencyTotalMs = finiteNumber(value.latencyTotalMs);
  bucket.latencyMaxMs = finiteNumber(value.latencyMaxMs);
  bucket.costUsd = finiteNumber(value.costUsd);
  if (Array.isArray(value.latencyHistogram) && value.latencyHistogram.length === LATENCY_BOUNDS_MS.length) {
    bucket.latencyHistogram = value.latencyHistogram.map((entry) => integer(entry));
  }
  if (value.errors && typeof value.errors === 'object' && !Array.isArray(value.errors)) {
    bucket.errors = Object.fromEntries(
      Object.entries(value.errors)
        .filter(([key]) => safeErrorCode(key) === key)
        .map(([key, count]) => [key, integer(count)]),
    );
  }
  return bucket;
}

function percentile95(histogram, count, maxLatencyMs) {
  if (count === 0) return null;
  const target = Math.ceil(count * 0.95);
  let observed = 0;
  for (let index = 0; index < histogram.length; index += 1) {
    observed += histogram[index];
    if (observed >= target) {
      const bound = LATENCY_BOUNDS_MS[index];
      return Number.isFinite(bound) ? bound : Math.round(maxLatencyMs);
    }
  }
  return Math.round(maxLatencyMs);
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export class GatewayTelemetry {
  constructor({ filePath, retentionHours, availabilityTargetPercent, p95LatencyTargetMs, now = Date.now, logger = console }) {
    this.filePath = filePath;
    this.retentionHours = retentionHours;
    this.availabilityTargetPercent = availabilityTargetPercent;
    this.p95LatencyTargetMs = p95LatencyTargetMs;
    this.now = now;
    this.logger = logger;
    this.flushTimer = null;
    this.state = { version: TELEMETRY_VERSION, buckets: [] };
    this.load();
  }

  load() {
    if (!this.filePath) return;
    try {
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf8'));
      if (parsed?.version !== TELEMETRY_VERSION || !Array.isArray(parsed.buckets)) return;
      this.state.buckets = parsed.buckets.map(normalizeBucket).filter(Boolean);
      this.prune();
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        this.logger.warn({ event: 'telemetry_load_failed', error: error instanceof Error ? error.name : 'unknown' });
      }
    }
  }

  prune(timestamp = this.now()) {
    const oldest = timestamp - this.retentionHours * 3_600_000;
    this.state.buckets = this.state.buckets.filter((bucket) => Date.parse(bucket.startedAt) >= oldest);
  }

  currentBucket(timestamp) {
    const startedAt = hourStart(timestamp);
    let bucket = this.state.buckets.find((entry) => entry.startedAt === startedAt);
    if (!bucket) {
      bucket = emptyBucket(startedAt);
      this.state.buckets.push(bucket);
      this.state.buckets.sort((left, right) => left.startedAt.localeCompare(right.startedAt));
    }
    return bucket;
  }

  record({ status, latencyMs, errorCode, costUsd, promptTokens, completionTokens }, timestamp = this.now()) {
    const bucket = this.currentBucket(timestamp);
    const normalizedStatus = integer(status, 500);
    bucket.requests += 1;
    if (normalizedStatus >= 200 && normalizedStatus < 400) bucket.successes += 1;
    else if (normalizedStatus >= 400 && normalizedStatus < 500 && normalizedStatus !== 429) bucket.clientErrors += 1;
    else bucket.serviceErrors += 1;

    if (!(normalizedStatus >= 400 && normalizedStatus < 500 && normalizedStatus !== 429)) {
      const normalizedLatency = Math.min(finiteNumber(latencyMs), 300_000);
      bucket.latencyCount += 1;
      bucket.latencyTotalMs += normalizedLatency;
      bucket.latencyMaxMs = Math.max(bucket.latencyMaxMs, normalizedLatency);
      const index = LATENCY_BOUNDS_MS.findIndex((bound) => normalizedLatency <= bound);
      bucket.latencyHistogram[index === -1 ? LATENCY_BOUNDS_MS.length - 1 : index] += 1;
    }

    bucket.costUsd += Math.min(finiteNumber(costUsd), 1_000_000);
    bucket.promptTokens += Math.min(integer(promptTokens), 1_000_000_000);
    bucket.completionTokens += Math.min(integer(completionTokens), 1_000_000_000);
    if (normalizedStatus >= 400) {
      const code = safeErrorCode(errorCode);
      bucket.errors[code] = (bucket.errors[code] ?? 0) + 1;
    }
    this.prune(timestamp);
    this.scheduleFlush();
  }

  scheduleFlush() {
    if (!this.filePath || this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush();
    }, 250);
    this.flushTimer.unref?.();
  }

  flush() {
    if (!this.filePath) return;
    const temporary = `${this.filePath}.${process.pid}.tmp`;
    try {
      mkdirSync(dirname(this.filePath), { recursive: true, mode: 0o750 });
      writeFileSync(temporary, `${JSON.stringify(this.state)}\n`, { encoding: 'utf8', mode: 0o640 });
      chmodSync(temporary, 0o640);
      renameSync(temporary, this.filePath);
    } catch (error) {
      try { unlinkSync(temporary); } catch { /* best effort */ }
      this.logger.warn({ event: 'telemetry_flush_failed', error: error instanceof Error ? error.name : 'unknown' });
    }
  }

  summarizeWindow(hours, timestamp) {
    const oldest = timestamp - hours * 3_600_000;
    const buckets = this.state.buckets.filter((bucket) => Date.parse(bucket.startedAt) >= oldest);
    const aggregate = emptyBucket(hourStart(timestamp));
    for (const bucket of buckets) {
      for (const key of ['requests', 'successes', 'clientErrors', 'serviceErrors', 'latencyCount', 'latencyTotalMs', 'promptTokens', 'completionTokens', 'costUsd']) {
        aggregate[key] += bucket[key];
      }
      aggregate.latencyMaxMs = Math.max(aggregate.latencyMaxMs, bucket.latencyMaxMs);
      aggregate.latencyHistogram = aggregate.latencyHistogram.map((count, index) => count + bucket.latencyHistogram[index]);
      for (const [code, count] of Object.entries(bucket.errors)) {
        aggregate.errors[code] = (aggregate.errors[code] ?? 0) + count;
      }
    }
    const availabilityDenominator = aggregate.successes + aggregate.serviceErrors;
    const availabilityPercent = availabilityDenominator > 0
      ? round((aggregate.successes / availabilityDenominator) * 100, 3)
      : null;
    const p95LatencyMs = percentile95(aggregate.latencyHistogram, aggregate.latencyCount, aggregate.latencyMaxMs);
    const availabilityMet = availabilityPercent === null ? null : availabilityPercent >= this.availabilityTargetPercent;
    const latencyMet = p95LatencyMs === null ? null : p95LatencyMs <= this.p95LatencyTargetMs;
    const status = availabilityMet === null || latencyMet === null
      ? 'no_data'
      : availabilityMet && latencyMet ? 'healthy' : 'breached';
    return {
      requests: aggregate.requests,
      successes: aggregate.successes,
      clientErrors: aggregate.clientErrors,
      serviceErrors: aggregate.serviceErrors,
      availabilityPercent,
      averageLatencyMs: aggregate.latencyCount > 0 ? Math.round(aggregate.latencyTotalMs / aggregate.latencyCount) : null,
      p95LatencyMs,
      maxLatencyMs: aggregate.latencyCount > 0 ? Math.round(aggregate.latencyMaxMs) : null,
      costUsd: round(aggregate.costUsd, 8),
      promptTokens: aggregate.promptTokens,
      completionTokens: aggregate.completionTokens,
      topErrors: Object.entries(aggregate.errors)
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .slice(0, 5)
        .map(([code, count]) => ({ code, count })),
      slo: { status, availabilityMet, latencyMet },
    };
  }

  summary(timestamp = this.now()) {
    this.prune(timestamp);
    return {
      generatedAt: new Date(timestamp).toISOString(),
      retentionHours: this.retentionHours,
      persistence: this.filePath ? 'file' : 'memory',
      privacy: {
        aggregation: 'hourly',
        contentStored: false,
        identifiersStored: false,
      },
      targets: {
        availabilityPercent: this.availabilityTargetPercent,
        p95LatencyMs: this.p95LatencyTargetMs,
      },
      windows: Object.fromEntries(
        Object.entries(SUMMARY_WINDOWS).map(([name, hours]) => [name, this.summarizeWindow(hours, timestamp)]),
      ),
    };
  }
}

export function createGatewayTelemetry(config, options = {}) {
  return new GatewayTelemetry({
    filePath: config.telemetryFile,
    retentionHours: config.telemetryRetentionHours,
    availabilityTargetPercent: config.sloAvailabilityPercent,
    p95LatencyTargetMs: config.sloP95LatencyMs,
    now: options.now,
    logger: options.logger,
  });
}
