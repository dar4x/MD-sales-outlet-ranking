/* External deps */
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';
import { DataSource } from 'typeorm';
/* Internal deps */
import { AppModule } from '../src/app.module.js';
import { configureApplication } from '../src/configure-application.js';
import type { RankingSnapshot } from '../src/rankings/application/read-models/ranking.js';
import { BISHKEK_OUTLET_ID, BREAD_PRODUCT_ID } from './seed-data.js';
import { assertTestDatabase } from './test-database.js';

assertTestDatabase();
let app: INestApplication;
let url: string;
let database: DataSource;
await describe('GET /api/rankings', async () => {
  before(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    configureApplication(app);
    await app.listen(0, '127.0.0.1');
    url = await app.getUrl();
    database = app.get(DataSource);
  });
  after(() => app.close());
  beforeEach(async () => {
    assertTestDatabase(String(database.options.database));
    await database.query('TRUNCATE sale_lines, sale_receipts, accepted_events');
  });
  await it('ranks sales ingested through HTTP using a fresh SQL clock', async () => {
    const beforeRequest = Date.now();
    const occurredAt = new Date(beforeRequest - 1000).toISOString();
    for (const amount of ['100', '201']) {
      const response = await fetch(url + '/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'sale',
          event_id: randomUUID(),
          receipt_id: randomUUID(),
          outlet_id: BISHKEK_OUTLET_ID,
          occurred_at: occurredAt,
          lines: [
            {
              sale_line_id: randomUUID(),
              product_id: BREAD_PRODUCT_ID,
              quantity: 1,
              unit_price_minor: amount,
              line_amount_minor: amount,
            },
          ],
        }),
      });
      assert.equal(response.status, 201);
    }
    const response = await fetch(url + '/api/rankings?window=hour');
    assert.equal(response.status, 200);
    const snapshot = (await response.json()) as RankingSnapshot;
    assert.equal(snapshot.window, 'hour');
    assert.equal(snapshot.currency, 'KGS');
    assert.match(snapshot.snapshot_id, /^[0-9a-f-]{36}$/);
    assert.ok(Date.parse(snapshot.as_of) >= beforeRequest);
    assert.ok(Date.parse(snapshot.as_of) <= Date.now());
    const row = snapshot.rows.find(
      (row) => row.outlet_id === BISHKEK_OUTLET_ID,
    )!;
    assert.equal(row.net_revenue_minor, '301');
    assert.equal(row.receipt_count, 2);
    assert.equal(row.average_check_minor, '151');
    assert.equal(row.rank, 1);
    assert.equal(row.is_leader, true);
    const outlets: { outlet_id: string }[] = await database.query(
      'SELECT outlet_id FROM outlets ORDER BY outlet_id',
    );
    assert.deepEqual(
      snapshot.rows.map((row) => row.outlet_id).sort(),
      outlets.map((row) => row.outlet_id),
    );
    for (const item of snapshot.rows) {
      assert.equal(item.ends_at, snapshot.as_of);
      assert.equal(
        Date.parse(item.starts_at),
        Date.parse(snapshot.as_of) - 3600000,
      );
    }
    const next = (await (
      await fetch(url + '/api/rankings?window=hour')
    ).json()) as RankingSnapshot;
    assert.notEqual(next.snapshot_id, snapshot.snapshot_id);
    assert.ok(Date.parse(next.as_of) >= Date.parse(snapshot.as_of));
  });
  await it('defaults a missing window to business_day per the source contract', async () => {
    const response = await fetch(url + '/api/rankings');
    assert.equal(response.status, 200);
    const snapshot = (await response.json()) as RankingSnapshot;
    assert.equal(snapshot.window, 'business_day');
    assert.ok(
      snapshot.rows.every(
        (row) =>
          row.previous_revenue_minor === null && row.dynamics_bps === null,
      ),
    );
  });
  await it('rejects invalid, repeated and unknown query fields with 422', async () => {
    for (const query of [
      'window=day',
      'window=',
      'window=hour&window=business_day',
      'window=hour&as_of=2026-10-13T06:00:00Z',
    ]) {
      const response = await fetch(url + '/api/rankings?' + query);
      assert.equal(response.status, 422);
      assert.deepEqual(await response.json(), {
        code: 'invalid_request',
        message: 'Invalid rankings query.',
      });
    }
  });
});
