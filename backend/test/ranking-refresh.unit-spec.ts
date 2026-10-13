import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { it } from 'node:test';
import { CoalescedRankingRefresh } from '../src/rankings/infrastructure/coalesced-ranking-refresh.js';

await it('coalesces 50 requests into exactly one refresh', async () => {
  let calls = 0;
  const refresh = new CoalescedRankingRefresh(
    async () => {
      calls += 1;
    },
    20,
    assert.fail,
  );
  try {
    for (let index = 0; index < 50; index += 1) refresh.request();
    await delay(80);
    assert.equal(calls, 1);
  } finally {
    refresh.onModuleDestroy();
  }
});
await it('waits for the trailing delay after the last request', async () => {
  let calls = 0;
  const refresh = new CoalescedRankingRefresh(
    async () => {
      calls += 1;
    },
    80,
    assert.fail,
  );
  try {
    refresh.request();
    await delay(50);
    refresh.request();
    await delay(50);
    assert.equal(calls, 0);
    await delay(80);
    assert.equal(calls, 1);
  } finally {
    refresh.onModuleDestroy();
  }
});
await it('runs exactly one more refresh for requests during a running refresh', async () => {
  let calls = 0;
  let active = 0;
  let maximumActive = 0;
  let release!: () => void;
  let started!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const firstStarted = new Promise<void>((resolve) => {
    started = resolve;
  });
  const refresh = new CoalescedRankingRefresh(
    async () => {
      calls += 1;
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      if (calls === 1) {
        started();
        await gate;
      }
      active -= 1;
    },
    10,
    assert.fail,
  );
  try {
    refresh.request();
    await firstStarted;
    for (let index = 0; index < 50; index += 1) refresh.request();
    assert.equal(calls, 1);
    release();
    await delay(60);
    assert.equal(calls, 2);
    assert.equal(maximumActive, 1);
  } finally {
    release();
    refresh.onModuleDestroy();
  }
});
await it('logs a failed refresh and accepts later requests', async () => {
  let calls = 0;
  const failures: unknown[] = [];
  const failure = new Error('query failed');
  const refresh = new CoalescedRankingRefresh(
    async () => {
      calls += 1;
      if (calls === 1) throw failure;
    },
    10,
    (error) => {
      failures.push(error);
    },
  );
  try {
    refresh.request();
    await delay(50);
    refresh.request();
    await delay(50);
    assert.equal(calls, 2);
    assert.deepEqual(failures, [failure]);
  } finally {
    refresh.onModuleDestroy();
  }
});
await it('cancels a queued refresh on shutdown', async () => {
  let calls = 0;
  const refresh = new CoalescedRankingRefresh(
    async () => {
      calls += 1;
    },
    20,
    assert.fail,
  );
  refresh.request();
  refresh.onModuleDestroy();
  refresh.request();
  await delay(60);
  assert.equal(calls, 0);
});
