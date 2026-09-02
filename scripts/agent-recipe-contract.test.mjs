import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const schema = JSON.parse(await readFile(new URL('../contracts/agent.recipe.v1.schema.json', import.meta.url), 'utf8'));
const required = new Set(schema.required);

for (const field of ['schemaVersion', 'source', 'permissions', 'data', 'evaluation', 'budget', 'lifecycle']) {
  assert.ok(required.has(field), `${field} must be required`);
}

assert.equal(schema.properties.permissions.properties.network.enum[0], 'deny');
assert.equal(schema.properties.permissions.properties.tools.items.properties.approved.const, true);
assert.match(schema.properties.permissions.properties.tools.items.properties.descriptionHash.pattern, /sha256/);
assert.equal(schema.properties.evaluation.properties.humanReviewRequired.const, true);
assert.ok(schema.properties.lifecycle.properties.status.enum.includes('quarantine'));
assert.equal(schema.additionalProperties, false);

console.log('Agent recipe contract passed: fail-closed permissions, pinned tool descriptions and human review required.');