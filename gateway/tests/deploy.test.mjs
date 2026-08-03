import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const supervisorSync = readFileSync(
  new URL('../../deploy/scripts/sync-gateway-supervisor.sh', import.meta.url),
  'utf8',
);

test('supervisor smoke supports scoped clients without exposing their token', () => {
  assert.match(supervisorSync, /AI_GATEWAY_SMOKE_CLIENT_ID:-eclipse-chat/);
  assert.match(supervisorSync, /service-clients\.mjs primary-token/);
  assert.match(supervisorSync, /AI_GATEWAY_SERVICE_TOKEN="\$SMOKE_SERVICE_TOKEN"/);
  assert.doesNotMatch(supervisorSync, /set -x|echo.*SMOKE_SERVICE_TOKEN/);
});
