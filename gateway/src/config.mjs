import { isAbsolute, normalize } from 'node:path';
import { loadServiceClients } from './service-clients.mjs';

export { SERVICE_SCOPES } from './service-clients.mjs';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function parseInteger(value, fallback, { min, max, name }) {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

function parseModels(value) {
  const models = (value || 'auto/best-chat')
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean);
  const unique = [...new Set(models)];
  if (unique.length === 0) throw new Error('AI_GATEWAY_MODELS must contain at least one model');
  if (unique.some((model) => model.length > 200)) throw new Error('AI_GATEWAY_MODELS contains an invalid model id');
  return unique;
}

function parseNumber(value, fallback, { min, max, name }) {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be a number between ${min} and ${max}`);
  }
  return parsed;
}

function parseBoolean(value, fallback, name) {
  if (value === undefined || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes'].includes(normalized)) return true;
  if (['0', 'false', 'no'].includes(normalized)) return false;
  throw new Error(`${name} must be a boolean`);
}

function normalizeTelemetryFile(value) {
  if (!value?.trim()) return undefined;
  const filePath = normalize(value.trim());
  if (!isAbsolute(filePath) || !/^[A-Za-z0-9._/\\:-]+$/.test(filePath)) {
    throw new Error('AI_GATEWAY_TELEMETRY_FILE must be an absolute path without shell metacharacters');
  }
  return filePath;
}

function normalizeUpstream(value) {
  if (!value?.trim()) throw new Error('AI_GATEWAY_UPSTREAM_BASE_URL is required');
  const url = new URL(value.trim());
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('AI gateway upstream must use HTTP or HTTPS');
  if (url.username || url.password) throw new Error('AI gateway upstream must not contain URL credentials');
  if (url.protocol === 'http:' && !LOOPBACK_HOSTS.has(url.hostname)) {
    throw new Error('Plain HTTP upstreams are allowed only on loopback');
  }
  return url.toString().replace(/\/+$/, '');
}

export function loadGatewayConfig(env = process.env) {
  const requestsPerMinute = parseInteger(env.AI_GATEWAY_REQUESTS_PER_MINUTE, 120, {
    min: 1,
    max: 10_000,
    name: 'AI_GATEWAY_REQUESTS_PER_MINUTE',
  });
  const serviceClients = loadServiceClients(env, requestsPerMinute);
  const serviceTokens = serviceClients.flatMap((client) => client.tokens);

  return Object.freeze({
    host: env.AI_GATEWAY_HOST?.trim() || '127.0.0.1',
    port: parseInteger(env.AI_GATEWAY_PORT, 8810, { min: 1, max: 65_535, name: 'AI_GATEWAY_PORT' }),
    serviceTokens: Object.freeze(serviceTokens),
    serviceClients: Object.freeze(serviceClients),
    upstreamBaseUrl: normalizeUpstream(env.AI_GATEWAY_UPSTREAM_BASE_URL),
    upstreamApiKey: env.AI_GATEWAY_UPSTREAM_API_KEY?.trim() || undefined,
    models: Object.freeze(parseModels(env.AI_GATEWAY_MODELS ?? env.AI_GATEWAY_MODEL)),
    gpt56RouterEnabled: parseBoolean(env.AI_GATEWAY_GPT56_ROUTER_ENABLED, false, 'AI_GATEWAY_GPT56_ROUTER_ENABLED'),
    timeoutMs: parseInteger(env.AI_GATEWAY_TIMEOUT_MS, 60_000, {
      min: 1_000,
      max: 300_000,
      name: 'AI_GATEWAY_TIMEOUT_MS',
    }),
    maxBodyBytes: parseInteger(env.AI_GATEWAY_MAX_BODY_BYTES, 524_288, {
      min: 16_384,
      max: 2_097_152,
      name: 'AI_GATEWAY_MAX_BODY_BYTES',
    }),
    requestsPerMinute,
    telemetryFile: normalizeTelemetryFile(env.AI_GATEWAY_TELEMETRY_FILE),
    telemetryRetentionHours: parseInteger(env.AI_GATEWAY_TELEMETRY_RETENTION_HOURS, 168, {
      min: 24,
      max: 2_160,
      name: 'AI_GATEWAY_TELEMETRY_RETENTION_HOURS',
    }),
    sloAvailabilityPercent: parseNumber(env.AI_GATEWAY_SLO_AVAILABILITY_PERCENT, 99, {
      min: 90,
      max: 100,
      name: 'AI_GATEWAY_SLO_AVAILABILITY_PERCENT',
    }),
    sloP95LatencyMs: parseInteger(env.AI_GATEWAY_SLO_P95_LATENCY_MS, 15_000, {
      min: 100,
      max: 300_000,
      name: 'AI_GATEWAY_SLO_P95_LATENCY_MS',
    }),
  });
}
