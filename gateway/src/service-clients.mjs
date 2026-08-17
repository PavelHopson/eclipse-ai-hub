export const SERVICE_SCOPES = Object.freeze([
  'models:read',
  'telemetry:read',
  'chat:write',
  'responses:write',
  'growth:execute',
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

function normalizeTokens(tokens, name) {
  const normalized = Array.isArray(tokens)
    ? [...new Set(tokens.map((token) => typeof token === 'string' ? token.trim() : '').filter(Boolean))]
    : [];
  if (normalized.length < 1 || normalized.length > 4 || normalized.some((token) => token.length < 32 || token.length > 512)) {
    throw new Error(`${name} must contain 1..4 tokens of 32..512 characters`);
  }
  return normalized;
}

function normalizeScopes(scopes, name) {
  const normalized = Array.isArray(scopes)
    ? [...new Set(scopes.map((scope) => typeof scope === 'string' ? scope.trim() : '').filter(Boolean))]
    : [];
  if (normalized.length < 1 || normalized.some((scope) => !SERVICE_SCOPE_SET.has(scope))) {
    throw new Error(`${name} contains an unsupported scope`);
  }
  return normalized;
}

export function validateServiceClients(clients, defaultRequestsPerMinute = 120) {
  if (!Array.isArray(clients) || clients.length < 1 || clients.length > 32) {
    throw new Error('AI_GATEWAY_SERVICE_CLIENTS must contain between 1 and 32 clients');
  }

  const clientIds = new Set();
  const allTokens = new Set();
  return clients.map((client, index) => {
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

    const tokens = normalizeTokens(client.tokens, `AI_GATEWAY_SERVICE_CLIENTS[${index}].tokens`);
    if (tokens.some((token) => allTokens.has(token))) {
      throw new Error('AI_GATEWAY_SERVICE_CLIENTS tokens must be unique across clients');
    }
    tokens.forEach((token) => allTokens.add(token));

    const scopes = normalizeScopes(client.scopes, `AI_GATEWAY_SERVICE_CLIENTS[${index}].scopes`);
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

export function parseServiceClientsJson(rawClients, defaultRequestsPerMinute = 120) {
  let parsed;
  try {
    parsed = JSON.parse(rawClients);
  } catch {
    throw new Error('AI_GATEWAY_SERVICE_CLIENTS must be valid JSON');
  }
  return validateServiceClients(parsed, defaultRequestsPerMinute);
}

export function loadServiceClients(env, defaultRequestsPerMinute = 120) {
  const rawClients = env.AI_GATEWAY_SERVICE_CLIENTS?.trim();
  if (rawClients) {
    if (env.AI_GATEWAY_SERVICE_TOKEN?.trim() || env.AI_GATEWAY_SERVICE_TOKENS?.trim()) {
      throw new Error('AI_GATEWAY_SERVICE_CLIENTS cannot be combined with legacy service token variables');
    }
    return parseServiceClientsJson(rawClients, defaultRequestsPerMinute);
  }

  const source = env.AI_GATEWAY_SERVICE_TOKENS?.trim() || env.AI_GATEWAY_SERVICE_TOKEN?.trim();
  const tokens = normalizeTokens(
    (source || '').split(',').map((token) => token.trim()).filter(Boolean),
    'AI_GATEWAY_SERVICE_TOKEN(S)',
  );
  return validateServiceClients([{
    id: 'legacy-service',
    tokens,
    scopes: SERVICE_SCOPES,
    requestsPerMinute: defaultRequestsPerMinute,
  }], defaultRequestsPerMinute);
}

export function upsertServiceClient(rawClients, client, defaultRequestsPerMinute = 120) {
  const existing = rawClients?.trim()
    ? parseServiceClientsJson(rawClients, defaultRequestsPerMinute)
    : [];
  const next = existing.filter((entry) => entry.id !== client.id);
  next.push(client);
  return JSON.stringify(validateServiceClients(next, defaultRequestsPerMinute));
}

export function getServiceClientPrimaryToken(rawClients, clientId, defaultRequestsPerMinute = 120) {
  const clients = parseServiceClientsJson(rawClients, defaultRequestsPerMinute);
  const client = clients.find((entry) => entry.id === clientId);
  if (!client) throw new Error('Requested service client does not exist');
  return client.tokens[0];
}

export function findServiceClientPrimaryToken(rawClients, clientId, defaultRequestsPerMinute = 120) {
  const clients = parseServiceClientsJson(rawClients, defaultRequestsPerMinute);
  return clients.find((entry) => entry.id === clientId)?.tokens[0] || '';
}
