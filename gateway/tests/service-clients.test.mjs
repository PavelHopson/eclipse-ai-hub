import assert from 'node:assert/strict';
import test from 'node:test';
import { execute } from '../scripts/service-clients.mjs';
import {
  getServiceClientPrimaryToken,
  parseServiceClientsJson,
  upsertServiceClient,
} from '../src/service-clients.mjs';

const CHAT_TOKEN = 'chat-service-token-with-at-least-32-characters';
const NEXT_CHAT_TOKEN = 'next-chat-token-with-at-least-32-characters';
const SENTINEL_TOKEN = 'sentinel-token-with-at-least-32-characters';
const DND_TOKEN = 'dnd-service-token-with-at-least-32-characters';

test('creates the first scoped client without legacy token variables', () => {
  const raw = upsertServiceClient('', {
    id: 'eclipse-chat',
    tokens: [CHAT_TOKEN],
    scopes: ['models:read', 'telemetry:read', 'chat:write'],
    requestsPerMinute: 90,
  });
  const clients = parseServiceClientsJson(raw);

  assert.equal(clients.length, 1);
  assert.equal(clients[0].id, 'eclipse-chat');
  assert.deepEqual(clients[0].tokens, [CHAT_TOKEN]);
});

test('upserts one client while preserving unrelated clients', () => {
  const current = JSON.stringify([{
    id: 'eclipse-chat',
    tokens: [CHAT_TOKEN],
    scopes: ['models:read', 'telemetry:read', 'chat:write'],
    requestsPerMinute: 90,
  }, {
    id: 'hopson-sentinel',
    tokens: [SENTINEL_TOKEN],
    scopes: ['models:read', 'chat:write'],
    requestsPerMinute: 30,
  }]);

  const raw = upsertServiceClient(current, {
    id: 'eclipse-chat',
    tokens: [NEXT_CHAT_TOKEN, CHAT_TOKEN],
    scopes: ['models:read', 'telemetry:read', 'chat:write'],
    requestsPerMinute: 90,
  });
  const clients = parseServiceClientsJson(raw);

  assert.equal(clients.length, 2);
  assert.deepEqual(clients.find((client) => client.id === 'hopson-sentinel')?.tokens, [SENTINEL_TOKEN]);
  assert.deepEqual(clients.find((client) => client.id === 'eclipse-chat')?.tokens, [NEXT_CHAT_TOKEN, CHAT_TOKEN]);
});

test('keeps the DnD client least-privileged', () => {
  const raw = upsertServiceClient('', {
    id: 'eclipse-dnd-forge',
    tokens: [DND_TOKEN],
    scopes: ['models:read', 'chat:write'],
    requestsPerMinute: 30,
  });
  const [client] = parseServiceClientsJson(raw);

  assert.deepEqual(client.scopes, ['models:read', 'chat:write']);
  assert.equal(client.scopes.includes('telemetry:read'), false);
});

test('rejects duplicate tokens across clients without echoing the token', () => {
  const current = JSON.stringify([{
    id: 'eclipse-chat',
    tokens: [CHAT_TOKEN],
    scopes: ['models:read'],
    requestsPerMinute: 90,
  }]);

  assert.throws(
    () => upsertServiceClient(current, {
      id: 'eclipse-dnd-forge',
      tokens: [CHAT_TOKEN],
      scopes: ['models:read', 'chat:write'],
      requestsPerMinute: 30,
    }),
    (error) => error instanceof Error
      && /tokens must be unique/.test(error.message)
      && !error.message.includes(CHAT_TOKEN),
  );
});

test('returns only the requested primary token for shell capture', () => {
  const raw = JSON.stringify([{
    id: 'eclipse-chat',
    tokens: [NEXT_CHAT_TOKEN, CHAT_TOKEN],
    scopes: ['models:read'],
    requestsPerMinute: 90,
  }]);

  assert.equal(getServiceClientPrimaryToken(raw, 'eclipse-chat'), NEXT_CHAT_TOKEN);
  assert.equal(execute('primary-token', {
    SERVICE_CLIENTS_JSON: raw,
    CLIENT_ID: 'eclipse-chat',
  }), NEXT_CHAT_TOKEN);
  assert.equal(execute('primary-token-if-present', {
    SERVICE_CLIENTS_JSON: raw,
    CLIENT_ID: 'eclipse-dnd-forge',
  }), '');
});

test('CLI validation fails closed for unsupported scopes and request budgets', () => {
  assert.throws(() => execute('upsert', {
    CLIENT_ID: 'eclipse-dnd-forge',
    CLIENT_TOKENS: DND_TOKEN,
    CLIENT_SCOPES: 'models:read,admin:write',
    CLIENT_REQUESTS_PER_MINUTE: '0',
  }), /unsupported scope|between 1 and 10000/);
});
