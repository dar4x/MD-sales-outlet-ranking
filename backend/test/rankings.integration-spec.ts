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
});
