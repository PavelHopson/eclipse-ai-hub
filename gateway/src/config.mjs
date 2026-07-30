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
  const serviceToken = env.AI_GATEWAY_SERVICE_TOKEN?.trim();
  if (!serviceToken || serviceToken.length < 32) {
    throw new Error('AI_GATEWAY_SERVICE_TOKEN must be at least 32 characters');
  }

  return Object.freeze({
    host: env.AI_GATEWAY_HOST?.trim() || '127.0.0.1',
    port: parseInteger(env.AI_GATEWAY_PORT, 8810, { min: 1, max: 65_535, name: 'AI_GATEWAY_PORT' }),
    serviceToken,
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
    requestsPerMinute: parseInteger(env.AI_GATEWAY_REQUESTS_PER_MINUTE, 120, {
      min: 1,
      max: 10_000,
      name: 'AI_GATEWAY_REQUESTS_PER_MINUTE',
    }),
  });
}
