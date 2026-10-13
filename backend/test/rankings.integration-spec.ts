/* External deps */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';
/* Internal deps */
import dataSource from '../src/database/data-source.js';
import { PostgresRankingQuery } from '../src/rankings/infrastructure/postgres-ranking.query.js';
import { IngestEvent } from '../src/events/application/ingest-event.js';
import { PostgresTransactionRunner } from '../src/shared/infrastructure/postgres-transaction-runner.js';
import {
  BISHKEK_OUTLET_ID,
  ALMATY_OUTLET_ID,
  BREAD_PRODUCT_ID,
} from './seed-data.js';
import { assertTestDatabase } from './test-database.js';

assertTestDatabase();
const query = new PostgresRankingQuery(dataSource, 'KGS');
const asOf = '2026-10-13T06:00:00.000Z';
async function sale(
  outletId: string,
  occurredAt: string,
  amount = 100n,
): Promise<void> {
  await new IngestEvent(new PostgresTransactionRunner(dataSource), {
    now: () => asOf,
  }).execute({
    kind: 'sale',
    event_id: randomUUID(),
    receipt_id: randomUUID(),
    outlet_id: outletId,
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
  });
}
await describe('PostgresRankingQuery', async () => {
  before(() => dataSource.initialize());
  after(() => dataSource.destroy());
  beforeEach(async () => {
    assertTestDatabase(String(dataSource.options.database));
    await dataSource.query(
      'TRUNCATE sale_lines, sale_receipts, accepted_events',
    );
  });
  await it('counts hour sales and returns every persisted outlet', async () => {
    await sale(BISHKEK_OUTLET_ID, '2026-10-13T05:30:00Z', 100n);
    await sale(BISHKEK_OUTLET_ID, '2026-10-13T05:40:00Z', 200n);
    await sale(BISHKEK_OUTLET_ID, '2026-10-13T04:59:59Z', 999n);
    const snapshot = await query.get('hour', asOf);
    const outlets: { outlet_id: string }[] = await dataSource.query(
      'SELECT outlet_id FROM outlets ORDER BY outlet_id',
    );
    assert.deepEqual(
      snapshot.rows.map((row) => row.outlet_id).sort(),
      outlets.map((row) => row.outlet_id),
    );
    const row = snapshot.rows.find(
      (row) => row.outlet_id === BISHKEK_OUTLET_ID,
    )!;
    assert.equal(row.net_revenue_minor, '300');
    assert.equal(row.receipt_count, 2);
    assert.equal(snapshot.as_of, asOf);
    assert.equal(row.starts_at, '2026-10-13T05:00:00.000Z');
    assert.equal(row.ends_at, asOf);
    assert.equal(row.local_date, '2026-10-13');
  });
  await it('rounds averages exactly and keeps empty outlets null', async () => {
    await sale(BISHKEK_OUTLET_ID, '2026-10-13T05:30:00Z', 9223372036854775807n);
    await sale(BISHKEK_OUTLET_ID, '2026-10-13T05:40:00Z', 0n);
    const snapshot = await query.get('hour', asOf);
    const active = snapshot.rows.find(
      (row) => row.outlet_id === BISHKEK_OUTLET_ID,
    )!;
    assert.equal(active.average_check_minor, '4611686018427387904');
    for (const row of snapshot.rows) {
      if (row.outlet_id !== BISHKEK_OUTLET_ID) {
        assert.equal(row.net_revenue_minor, '0');
        assert.equal(row.receipt_count, 0);
        assert.equal(row.average_check_minor, null);
      }
    }
  });
  await it('assigns unique ranks by revenue then ascending outlet_id', async () => {
    await sale(ALMATY_OUTLET_ID, '2026-10-13T05:30:00Z', 100n);
    await sale(BISHKEK_OUTLET_ID, '2026-10-13T05:30:00Z', 100n);
    const snapshot = await query.get('hour', asOf);
    const outlets: { outlet_id: string }[] = await dataSource.query(
      'SELECT outlet_id FROM outlets ORDER BY outlet_id',
    );
    const expected = [BISHKEK_OUTLET_ID, ALMATY_OUTLET_ID];
    for (const outlet of outlets) {
      if (!expected.includes(outlet.outlet_id)) expected.push(outlet.outlet_id);
    }
    assert.deepEqual(
      snapshot.rows.map((row) => row.outlet_id),
      expected,
    );
    assert.deepEqual(
      snapshot.rows.map((row) => row.rank),
      expected.map((_, index) => index + 1),
    );
  });
  await it('uses half-open hour boundaries', async () => {
    await sale(BISHKEK_OUTLET_ID, '2026-10-13T05:00:00Z', 10n);
    await sale(BISHKEK_OUTLET_ID, asOf, 999n);
    await sale(BISHKEK_OUTLET_ID, '2026-10-13T04:59:59.999Z', 888n);
    const snapshot = await query.get('hour', asOf);
    const row = snapshot.rows.find(
      (row) => row.outlet_id === BISHKEK_OUTLET_ID,
    )!;
    assert.equal(row.net_revenue_minor, '10');
    assert.equal(row.receipt_count, 1);
  });
  await it('uses each outlet local midnight and excludes late previous-day sales', async () => {
    for (const [id, midnight] of [
      [BISHKEK_OUTLET_ID, '2026-10-12T18:00:00.000Z'],
      [ALMATY_OUTLET_ID, '2026-10-12T19:00:00.000Z'],
    ]) {
      const start = Date.parse(midnight!);
      await sale(id!, new Date(start - 1).toISOString(), 999n);
      await sale(id!, new Date(start).toISOString(), 10n);
      await sale(id!, new Date(start + 1).toISOString(), 20n);
      await sale(id!, asOf, 888n);
    }
    const snapshot = await query.get('business_day', asOf);
    for (const [id, midnight] of [
      [BISHKEK_OUTLET_ID, '2026-10-12T18:00:00.000Z'],
      [ALMATY_OUTLET_ID, '2026-10-12T19:00:00.000Z'],
    ]) {
      const row = snapshot.rows.find((row) => row.outlet_id === id)!;
      assert.equal(row.starts_at, midnight);
      assert.equal(row.net_revenue_minor, '30');
      assert.equal(row.receipt_count, 2);
      assert.equal(row.local_date, '2026-10-13');
      assert.equal(row.ends_at, asOf);
      assert.equal(row.previous_revenue_minor, null);
      assert.equal(row.dynamics_bps, null);
    }
  });
  await it('keeps local midnight across spring and autumn DST changes', async () => {
    const berlin = '00000000-0000-4000-8000-000000000005';
    for (const [end, start] of [
      ['2026-03-29T21:59:59.000Z', '2026-03-28T23:00:00.000Z'],
      ['2026-10-25T22:59:59.000Z', '2026-10-24T22:00:00.000Z'],
    ]) {
      await sale(berlin, new Date(Date.parse(start!) - 1).toISOString(), 999n);
      await sale(berlin, start!, 10n);
      await sale(berlin, new Date(Date.parse(end!) - 1).toISOString(), 20n);
      const snapshot = await query.get('business_day', end);
      const row = snapshot.rows.find((row) => row.outlet_id === berlin)!;
      assert.equal(row.starts_at, start);
      assert.equal(row.net_revenue_minor, '30');
      assert.equal(row.receipt_count, 2);
    }
  });
});
