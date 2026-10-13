/* External deps */
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { after, before, describe, it } from 'node:test';
import 'reflect-metadata';
/* Internal deps */
import { AppModule } from '../src/app.module.js';
import { configureApplication } from '../src/configure-application.js';
import type { RankingSnapshot } from '../src/rankings/application/read-models/ranking.js';
import { assertTestDatabase } from './test-database.js';
import {
  connect,
  acknowledge,
  waitForSnapshots,
} from './ranking-socket-client.js';

assertTestDatabase();
let app: INestApplication;
let url: string;
await describe('Realtime rankings subscriptions', async () => {
  before(async () => {
    process.env.REALTIME_REFRESH_INTERVAL_MS = '60000';
    process.env.REALTIME_COALESCE_MS = '40';
    app = await NestFactory.create(AppModule, { logger: false });
    configureApplication(app);
    await app.listen(0, '127.0.0.1');
    url = await app.getUrl();
  });
  after(() => app.close());
  await it('acknowledges subscribe, sends initial snapshot only to that client, switches and unsubscribes', async () => {
    const first = await connect(url);
    const second = await connect(url);
    const firstSnapshots: RankingSnapshot[] = [];
    const secondSnapshots: RankingSnapshot[] = [];
    first.on('rankings.snapshot', (snapshot: RankingSnapshot) => {
      firstSnapshots.push(snapshot);
    });
    second.on('rankings.snapshot', (snapshot: RankingSnapshot) => {
      secondSnapshots.push(snapshot);
    });
    try {
      assert.deepEqual(
        await acknowledge(first, 'rankings.subscribe', { window: 'hour' }),
        { ok: true, window: 'hour' },
      );
      await waitForSnapshots(firstSnapshots, 1);
      assert.equal(firstSnapshots[0]!.window, 'hour');
      assert.equal(secondSnapshots.length, 0);
      assert.deepEqual(
        await acknowledge(second, 'rankings.subscribe', { window: 'hour' }),
        { ok: true, window: 'hour' },
      );
      await waitForSnapshots(secondSnapshots, 1);
      assert.equal(firstSnapshots.length, 1);
      assert.deepEqual(
        await acknowledge(first, 'rankings.subscribe', {
          window: 'business_day',
        }),
        { ok: true, window: 'business_day' },
      );
      await waitForSnapshots(firstSnapshots, 2);
      assert.equal(firstSnapshots[1]!.window, 'business_day');
      assert.deepEqual(await acknowledge(first, 'rankings.unsubscribe', {}), {
        ok: true,
      });
    } finally {
      first.close();
      second.close();
    }
  });
  await it('rejects malformed subscriptions without joining a room', async () => {
    const socket = await connect(url);
    const snapshots: RankingSnapshot[] = [];
    socket.on('rankings.snapshot', (snapshot: RankingSnapshot) => {
      snapshots.push(snapshot);
    });
    try {
      for (const payload of [
        { window: 'day' },
        {},
        null,
        [],
        { window: 'hour', extra: true },
      ]) {
        assert.deepEqual(
          await acknowledge(socket, 'rankings.subscribe', payload),
          {
            ok: false,
            error: {
              code: 'invalid_request',
              message: 'Expected a ranking window: hour or business_day.',
            },
          },
        );
      }
      await delay(80);
      assert.equal(snapshots.length, 0);
    } finally {
      socket.close();
    }
  });
});
