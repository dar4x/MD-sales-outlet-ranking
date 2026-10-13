import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { it } from 'node:test';
import { AlertScheduler } from '../src/alerts/infrastructure/alert-scheduler.js';
await it('periodically evaluates alerts, recovers after failure and stops cleanly', async () => {
  let calls = 0;
  const errors: unknown[] = [];
  const scheduler = new AlertScheduler(
    () => {
      calls += 1;
      return calls === 1
        ? Promise.reject(new Error('temporary query failure'))
        : Promise.resolve();
    },
    10,
    (error) => {
      errors.push(error);
    },
  );
  scheduler.onModuleInit();
  await delay(80);
  await scheduler.onModuleDestroy();
  assert.ok(calls >= 2);
  assert.equal(errors.length, 1);
  const stopped = calls;
  await delay(40);
  assert.equal(calls, stopped);
});
