import assert from 'node:assert/strict';
import { it } from 'node:test';
import { assertTestDatabase } from './test-database.js';

await it('refuses dev and missing database names', () => {
  assert.throws(() => assertTestDatabase('sales_ranking'));
  assert.throws(() => assertTestDatabase('postgres'));
  assert.doesNotThrow(() => assertTestDatabase('sales_ranking_test'));
});
