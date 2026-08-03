import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync(
  new URL('../../.github/workflows/deploy-dnd-bff.yml', import.meta.url),
  'utf8',
);

test('DnD dark deployment is manual, pinned and production-gated', () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /confirm_dark_launch/);
  assert.match(workflow, /environment: production/);
  assert.match(workflow, /DND_COMMIT: [0-9a-f]{40}/);
  assert.match(workflow, /AI_HUB_COMMIT: [0-9a-f]{40}/);
  assert.match(workflow, /StrictHostKeyChecking=yes/);
  assert.match(workflow, /DND_EXPECTED_COMMIT/);
  assert.doesNotMatch(workflow, /StrictHostKeyChecking=no|set -x/);
});
