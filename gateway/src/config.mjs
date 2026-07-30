import { isAbsolute, normalize } from 'node:path';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
export const SERVICE_SCOPES = Object.freeze([
  'models:read',
  'telemetry:read',
  'chat:write',
]);
const SERVICE_SCOPE_SET = new Set(SERVICE_SCOPES);

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

function parseServiceTokens(env) {
  const source = env.AI_GATEWAY_SERVICE_TOKENS?.trim() || env.AI_GATEWAY_SERVICE_TOKEN?.trim();
  const tokens = [...new Set((source || '').split(',').map((token) => token.trim()).filter(Boolean))];
  if (tokens.length < 1 || tokens.length > 4 || tokens.some((token) => token.length < 32 || token.length > 512)) {
    throw new Error('AI_GATEWAY_SERVICE_TOKEN(S) must contain between 1 and 4 tokens of 32..512 characters');
  }
  return tokens;
}

function parseServiceClients(env, defaultRequestsPerMinute) {
  const rawClients = env.AI_GATEWAY_SERVICE_CLIENTS?.trim();
  if (!rawClients) {
    const tokens = parseServiceTokens(env);
    return [Object.freeze({
      id: 'legacy-service',
      tokens: Object.freeze(tokens),
      scopes: SERVICE_SCOPES,
      requestsPerMinute: defaultRequestsPerMinute,
    })];
  }

  if (env.AI_GATEWAY_SERVICE_TOKEN?.trim() || env.AI_GATEWAY_SERVICE_TOKENS?.trim()) {
    throw new Error('AI_GATEWAY_SERVICE_CLIENTS cannot be combined with legacy service token variables');
  }

  let parsed;
  try {
    parsed = JSON.parse(rawClients);
  } catch {
    throw new Error('AI_GATEWAY_SERVICE_CLIENTS must be valid JSON');
  }
  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 32) {
    throw new Error('AI_GATEWAY_SERVICE_CLIENTS must contain between 1 and 32 clients');
  }

  const clientIds = new Set();
  const allTokens = new Set();
  return parsed.map((client, index) => {
    if (!client || typeof client !== 'object' || Array.isArray(client)) {
      throw new Error(`AI_GATEWAY_SERVICE_CLIENTS[${index}] must be an object`);
    }
    const allowedFields = new Set(['id', 'tokens', 'scopes', 'requestsPerMinute']);
    if (Object.keys(client).some((field) => !allowedFields.has(field))) {
      throw new Error(`AI_GATEWAY_SERVICE_CLIENTS[${index}] contains an unsupported field`);
    }

    const id = typeof client.id === 'string' ? client.id.trim() : '';
    if (!/^[a-z][a-z0-9-]{1,62}$/.test(id) || clientIds.has(id)) {
      throw new Error(`AI_GATEWAY_SERVICE_CLIENTS[${index}].id must be unique and URL-safe`);
    }
    clientIds.add(id);

    const tokens = Array.isArray(client.tokens)
      ? [...new Set(client.tokens.map((token) => typeof token === 'string' ? token.trim() : '').filter(Boolean))]
      : [];
    if (tokens.length < 1 || tokens.length > 4 || tokens.some((token) => token.length < 32 || token.length > 512)) {
      throw new Error(`AI_GATEWAY_SERVICE_CLIENTS[${index}].tokens must contain 1..4 tokens of 32..512 characters`);
    }
    if (tokens.some((token) => allTokens.has(token))) {
      throw new Error('AI_GATEWAY_SERVICE_CLIENTS tokens must be unique across clients');
    }
    tokens.forEach((token) => allTokens.add(token));

    const scopes = Array.isArray(client.scopes)
      ? [...new Set(client.scopes.map((scope) => typeof scope === 'string' ? scope.trim() : '').filter(Boolean))]
      : [];
    if (scopes.length < 1 || scopes.some((scope) => !SERVICE_SCOPE_SET.has(scope))) {
      throw new Error(`AI_GATEWAY_SERVICE_CLIENTS[${index}].scopes contains an unsupported scope`);
    }

    const requestsPerMinute = parseInteger(
      client.requestsPerMinute,
      defaultRequestsPerMinute,
      { min: 1, max: 10_000, name: `AI_GATEWAY_SERVICE_CLIENTS[${index}].requestsPerMinute` },
    );

    return Object.freeze({
      id,
      tokens: Object.freeze(tokens),
      scopes: Object.freeze(scopes),
      requestsPerMinute,
    });
  });
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
  const serviceClients = parseServiceClients(env, requestsPerMinute);
  const serviceTokens = serviceClients.flatMap((client) => client.tokens);

  return Object.freeze({
    host: env.AI_GATEWAY_HOST?.trim() || '127.0.0.1',
    port: parseInteger(env.AI_GATEWAY_PORT, 8810, { min: 1, max: 65_535, name: 'AI_GATEWAY_PORT' }),
    serviceTokens: Object.freeze(serviceTokens),
    serviceClients: Object.freeze(serviceClients),
    upstreamBaseUrl: normalizeUpstream(env.AI_GATEWAY_UPSTREAM_BASE_URL),
    upstreamApiKey: env.AI_GATEWAY_UPSTREAM_API_KEY?.trim() || undefined,
    models: Object.freeze(parseModels(env.AI_GATEWAY_MODELS ?? env.AI_GATEWAY_MODEL)),
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
