import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';
import dataSource from '../src/database/data-source.js';
import { PostgresOutletCardQuery } from '../src/outlets/infrastructure/postgres-outlet-card.query.js';
import { IngestEvent } from '../src/events/application/ingest-event.js';
import { PostgresTransactionRunner } from '../src/shared/infrastructure/postgres-transaction-runner.js';
import { BISHKEK_OUTLET_ID, BREAD_PRODUCT_ID } from './seed-data.js';
import { assertTestDatabase } from './test-database.js';
assertTestDatabase();
await describe('Outlet card query', async () => {
  before(() => dataSource.initialize());
  after(() => dataSource.destroy());
  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE return_lines,return_events,sale_lines,sale_receipts,accepted_events',
    );
  });
  await it('builds return-aware metrics, clipped series, top products and local plan', async () => {
    const ingest = new IngestEvent(
      new PostgresTransactionRunner(dataSource),
      { now: () => '2026-10-13T06:00:00Z' },
      { request: () => {} },
    );
    const receiptId = randomUUID();
    const lineId = randomUUID();
    await ingest.execute({
      kind: 'sale',
      event_id: randomUUID(),
      receipt_id: receiptId,
      outlet_id: BISHKEK_OUTLET_ID,
      occurred_at: '2026-10-13T05:00:00Z',
      lines: [
        {
          sale_line_id: lineId,
          product_id: BREAD_PRODUCT_ID,
          quantity: 3,
          unit_price_minor: 101n,
          line_amount_minor: 303n,
        },
      ],
    });
    await ingest.execute({
      kind: 'return',
      event_id: randomUUID(),
      outlet_id: BISHKEK_OUTLET_ID,
      sale_receipt_id: receiptId,
      occurred_at: '2026-10-13T05:30:00Z',
      lines: [
        { return_line_id: randomUUID(), sale_line_id: lineId, quantity: 1 },
      ],
    });
    const query = new PostgresOutletCardQuery(dataSource);
    const card = (await query.get(
      BISHKEK_OUTLET_ID,
      'hour',
      '2026-10-13T06:00:00Z',
    ))!;
    assert.equal(card.metrics.net_revenue_minor, '202');
    assert.equal(card.metrics.receipt_count, 1);
    assert.equal(
      BigInt(card.metrics.average_check_minor!.split('.')[0]!),
      202n,
    );
    assert.equal(card.series.length, 12);
    assert.equal(
      card.series.reduce(
        (sum, bin) => sum + BigInt(bin.metrics.net_revenue_minor),
        0n,
      ),
      202n,
    );
    assert.equal(card.top_products[0]!.net_quantity, 2);
    assert.equal(card.top_products[0]!.net_revenue_minor, '202');
    assert.equal(card.today_plan.local_date, '2026-10-13');
    assert.equal(card.today_plan.net_revenue_minor, '202');
    assert.equal(
      await query.get(randomUUID(), 'hour', '2026-10-13T06:00:00Z'),
      null,
    );
  });
  await it('uses UTC-distinguished hourly bins across both DST day lengths and clips the last bin', async () => {
    const query = new PostgresOutletCardQuery(dataSource);
    const berlin = '00000000-0000-4000-8000-000000000005';
    for (const [instant, count, start] of [
      ['2026-03-29T21:59:59.000Z', 23, '2026-03-28T23:00:00.000Z'],
      ['2026-10-25T22:59:59.000Z', 25, '2026-10-24T22:00:00.000Z'],
    ] as const) {
      const card = (await query.get(berlin, 'business_day', instant))!;
      assert.equal(card.series.length, count);
      assert.equal(card.series[0]!.starts_at, start);
      assert.equal(card.series.at(-1)!.ends_at, instant);
      assert.equal(card.metrics.net_revenue_minor, '0');
      assert.equal(card.metrics.average_check_minor, null);
      assert.equal(
        new Set(card.series.map((bin) => bin.starts_at)).size,
        count,
      );
    }
  });
});
