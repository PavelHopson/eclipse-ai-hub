import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflowPath = new URL('../.github/workflows/deploy-vps.yml', import.meta.url);

test('VPS deploy stays behind the protected production environment', async () => {
  const workflow = await readFile(workflowPath, 'utf8');

  assert.match(workflow, /^permissions:\s*\r?\n\s+contents: read$/mu);
  assert.match(workflow, /^\s{4}environment: production$/mu);
  assert.match(workflow, /^\s{4}timeout-minutes: 10$/mu);
  assert.match(workflow, /StrictHostKeyChecking=yes/u);
  assert.doesNotMatch(workflow, /pull_request:/u);
});
