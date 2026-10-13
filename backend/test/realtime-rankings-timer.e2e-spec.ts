/* External deps */
import { NestFactory } from '@nestjs/core';
import assert from 'node:assert/strict';
import { it } from 'node:test';
import 'reflect-metadata';
/* Internal deps */
import { configureApplication } from '../src/configure-application.js';
import type { RankingSnapshot } from '../src/rankings/application/read-models/ranking.js';
import {
  connect,
  acknowledge,
  waitForSnapshots,
} from './ranking-socket-client.js';
import { assertTestDatabase } from './test-database.js';

assertTestDatabase();
process.env.REALTIME_REFRESH_INTERVAL_MS = '50';
process.env.REALTIME_COALESCE_MS = '10';
const { AppModule } = await import('../src/app.module.js');

await it('timer publishes fresh snapshots without any new event', async () => {
  const app = await NestFactory.create(AppModule, { logger: false });
  configureApplication(app);
  await app.listen(0, '127.0.0.1');
  const socket = await connect(await app.getUrl());
  const snapshots: RankingSnapshot[] = [];
  socket.on('rankings.snapshot', (snapshot: RankingSnapshot) => {
    snapshots.push(snapshot);
  });
  try {
    assert.deepEqual(
      await acknowledge(socket, 'rankings.subscribe', { window: 'hour' }),
      { ok: true, window: 'hour' },
    );
    await waitForSnapshots(snapshots, 3);
    assert.notEqual(snapshots[0]!.snapshot_id, snapshots.at(-1)!.snapshot_id);
    assert.ok(
      Date.parse(snapshots.at(-1)!.as_of) > Date.parse(snapshots[0]!.as_of),
    );
  } finally {
    socket.close();
    await app.close();
  }
});
