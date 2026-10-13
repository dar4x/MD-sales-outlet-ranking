/* External deps */
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { after, before, beforeEach, describe, it } from 'node:test';
import 'reflect-metadata';
/* Internal deps */
import { BISHKEK_OUTLET_ID, BREAD_PRODUCT_ID } from './seed-data.js';
import { RankingsGateway } from '../src/rankings/presentation/rankings.gateway.js';
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
  beforeEach(async () => {
    const database = app.get(DataSource);
    assertTestDatabase(String(database.options.database));
    await database.query('TRUNCATE sale_lines, sale_receipts, accepted_events');
  });
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
      const rooms = app
        .get(RankingsGateway)
        .server.sockets.sockets.get(first.id!)!.rooms;
      assert.equal(rooms.has('rankings:hour'), false);
      assert.equal(rooms.has('rankings:business_day'), true);
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
  await it('publishes newly committed sales but not duplicate retries or rejected events', async () => {
    const socket = await connect(url);
    const snapshots: RankingSnapshot[] = [];
    socket.on('rankings.snapshot', (snapshot: RankingSnapshot) => {
      snapshots.push(snapshot);
    });
    try {
      await acknowledge(socket, 'rankings.subscribe', { window: 'hour' });
      await waitForSnapshots(snapshots, 1);
      const body = {
        kind: 'sale',
        event_id: randomUUID(),
        receipt_id: randomUUID(),
        outlet_id: BISHKEK_OUTLET_ID,
        occurred_at: new Date(Date.now() - 1000).toISOString(),
        lines: [
          {
            sale_line_id: randomUUID(),
            product_id: BREAD_PRODUCT_ID,
            quantity: 1,
            unit_price_minor: '100',
            line_amount_minor: '100',
          },
        ],
      };
      const post = (payload: unknown): Promise<Response> =>
        fetch(url + '/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      assert.equal((await post(body)).status, 201);
      await waitForSnapshots(snapshots, 2);
      const row = snapshots
        .at(-1)!
        .rows.find((row) => row.outlet_id === BISHKEK_OUTLET_ID)!;
      assert.equal(row.net_revenue_minor, '100');
      assert.equal(row.receipt_count, 1);
      const count = snapshots.length;
      assert.equal((await post(body)).status, 200);
      await delay(150);
      assert.equal(snapshots.length, count);
      assert.equal(
        (
          await post({
            ...body,
            occurred_at: new Date(Date.now() - 2000).toISOString(),
          })
        ).status,
        409,
      );
      assert.equal((await post({ kind: 'sale' })).status, 422);
      await delay(150);
      assert.equal(snapshots.length, count);
    } finally {
      socket.close();
    }
  });
});
