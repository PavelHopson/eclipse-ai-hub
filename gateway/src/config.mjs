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

function normalizeProviderModels(value, allowedModels, name) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 32) {
    throw new Error(`${name} must contain between 1 and 32 models`);
  }
  const models = [...new Set(value.map((model) => typeof model === 'string' ? model.trim() : '').filter(Boolean))];
  if (models.length < 1 || models.some((model) => !allowedModels.has(model))) {
    throw new Error(`${name} must contain only models from AI_GATEWAY_MODELS`);
  }
  return Object.freeze(models);
}

function parseProviderRoutes(env, models) {
  const raw = env.AI_GATEWAY_UPSTREAMS?.trim();
  if (!raw) {
    return Object.freeze([Object.freeze({
      id: 'configured-provider',
      baseUrl: normalizeUpstream(env.AI_GATEWAY_UPSTREAM_BASE_URL),
      apiKey: env.AI_GATEWAY_UPSTREAM_API_KEY?.trim() || undefined,
      models,
      priority: 0,
      monthlyTokenBudget: null,
    })]);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('AI_GATEWAY_UPSTREAMS must be valid JSON');
  }
  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 4) {
    throw new Error('AI_GATEWAY_UPSTREAMS must contain between 1 and 4 providers');
  }

  const allowedModels = new Set(models);
  const providerIds = new Set();
  return Object.freeze(parsed.map((provider, index) => {
    const name = `AI_GATEWAY_UPSTREAMS[${index}]`;
    if (!provider || typeof provider !== 'object' || Array.isArray(provider)) {
      throw new Error(`${name} must be an object`);
    }
    const allowedFields = new Set(['id', 'baseUrl', 'apiKeyEnv', 'models', 'priority', 'monthlyTokenBudget']);
    if (Object.keys(provider).some((field) => !allowedFields.has(field))) {
      throw new Error(`${name} contains an unsupported field`);
    }
    const id = typeof provider.id === 'string' ? provider.id.trim() : '';
    if (!/^[a-z][a-z0-9-]{1,62}$/.test(id) || providerIds.has(id)) {
      throw new Error(`${name}.id must be unique and URL-safe`);
    }
    providerIds.add(id);

    let apiKey;
    if (provider.apiKeyEnv !== undefined) {
      if (typeof provider.apiKeyEnv !== 'string' || !/^[A-Z][A-Z0-9_]{2,63}$/.test(provider.apiKeyEnv)) {
        throw new Error(`${name}.apiKeyEnv must be a safe environment variable name`);
      }
      apiKey = env[provider.apiKeyEnv]?.trim();
      if (!apiKey) throw new Error(`${name}.apiKeyEnv does not reference a configured secret`);
    }

    const budget = provider.monthlyTokenBudget ?? null;
    if (budget !== null && (!Number.isSafeInteger(budget) || budget < 1_000 || budget > 10_000_000_000_000)) {
      throw new Error(`${name}.monthlyTokenBudget must be null or an integer between 1000 and 10000000000000`);
    }
    return Object.freeze({
      id,
      baseUrl: normalizeUpstream(provider.baseUrl),
      apiKey,
      models: normalizeProviderModels(provider.models, allowedModels, `${name}.models`),
      priority: parseInteger(provider.priority, index, { min: 0, max: 100, name: `${name}.priority` }),
      monthlyTokenBudget: budget,
    });
  }));
}

export function loadGatewayConfig(env = process.env) {
  const requestsPerMinute = parseInteger(env.AI_GATEWAY_REQUESTS_PER_MINUTE, 120, {
    min: 1,
    max: 10_000,
    name: 'AI_GATEWAY_REQUESTS_PER_MINUTE',
  });
  const serviceClients = loadServiceClients(env, requestsPerMinute);
  const serviceTokens = serviceClients.flatMap((client) => client.tokens);
  const models = Object.freeze(parseModels(env.AI_GATEWAY_MODELS ?? env.AI_GATEWAY_MODEL));
  const upstreams = parseProviderRoutes(env, models);

  return Object.freeze({
    host: env.AI_GATEWAY_HOST?.trim() || '127.0.0.1',
    port: parseInteger(env.AI_GATEWAY_PORT, 8810, { min: 1, max: 65_535, name: 'AI_GATEWAY_PORT' }),
    serviceTokens: Object.freeze(serviceTokens),
    serviceClients: Object.freeze(serviceClients),
    upstreams,
    upstreamBaseUrl: upstreams[0].baseUrl,
    upstreamApiKey: upstreams[0].apiKey,
    models,
    providerRetryAttempts: parseInteger(env.AI_GATEWAY_PROVIDER_RETRY_ATTEMPTS, 2, { min: 1, max: 3, name: 'AI_GATEWAY_PROVIDER_RETRY_ATTEMPTS' }),
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
