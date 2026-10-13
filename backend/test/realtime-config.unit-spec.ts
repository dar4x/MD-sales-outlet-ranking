import 'reflect-metadata';
import assert from 'node:assert/strict';
import { it } from 'node:test';
import { validateEnvironment } from '../src/config/environment.validation.js';

const valid = { ...process.env };
delete valid.REALTIME_REFRESH_INTERVAL_MS;
delete valid.REALTIME_COALESCE_MS;

await it('defaults realtime intervals and converts configured strings', () => {
  const defaults = validateEnvironment(valid);
  assert.equal(defaults.REALTIME_REFRESH_INTERVAL_MS, 5000);
  assert.equal(defaults.REALTIME_COALESCE_MS, 250);
  const custom = validateEnvironment({
    ...valid,
    REALTIME_REFRESH_INTERVAL_MS: '50',
    REALTIME_COALESCE_MS: '10',
  });
  assert.equal(custom.REALTIME_REFRESH_INTERVAL_MS, 50);
  assert.equal(custom.REALTIME_COALESCE_MS, 10);
});
await it('rejects zero, negative, fractional and overflowing realtime delays', () => {
  for (const key of ['REALTIME_REFRESH_INTERVAL_MS', 'REALTIME_COALESCE_MS']) {
    for (const value of ['0', '-1', '1.5', '2147483648', 'oops']) {
      assert.throws(() => validateEnvironment({ ...valid, [key]: value }));
    }
  }
});
