import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import 'reflect-metadata';
import { AppModule } from '../src/app.module.js';
import { configureApplication } from '../src/configure-application.js';
import { IngestEvent } from '../src/events/application/ingest-event.js';
import type { ReturnInput } from '../src/events/domain/event.js';
import { PostgresTransactionRunner } from '../src/shared/infrastructure/postgres-transaction-runner.js';
import { SystemClock } from '../src/shared/infrastructure/system-clock.js';
import { PostgresRankingQuery } from '../src/rankings/infrastructure/postgres-ranking.query.js';
import {
  BISHKEK_OUTLET_ID,
  ALMATY_OUTLET_ID,
  BREAD_PRODUCT_ID,
  MILK_PRODUCT_ID,
} from './seed-data.js';
import { assertTestDatabase } from './test-database.js';

assertTestDatabase();
let app: INestApplication;
let database: DataSource;
let url: string;
const saleTime = '2026-10-13T05:00:00.000Z';
const returnTime = '2026-10-13T06:00:00.000Z';
function saleBody() {
  return {
    kind: 'sale',
    event_id: randomUUID(),
    receipt_id: randomUUID(),
    outlet_id: BISHKEK_OUTLET_ID,
    occurred_at: saleTime,
    lines: [
      {
        sale_line_id: randomUUID(),
        product_id: BREAD_PRODUCT_ID,
        quantity: 3,
        unit_price_minor: '101',
        line_amount_minor: '303',
      },
      {
        sale_line_id: randomUUID(),
        product_id: MILK_PRODUCT_ID,
        quantity: 2,
        unit_price_minor: '51',
        line_amount_minor: '102',
      },
    ],
  };
}
function refund(body: ReturnType<typeof saleBody>, quantity = 1): ReturnInput {
  return {
    kind: 'return',
    event_id: randomUUID(),
    outlet_id: body.outlet_id,
    occurred_at: returnTime,
    sale_receipt_id: body.receipt_id,
    lines: [
      {
        return_line_id: randomUUID(),
        sale_line_id: body.lines[0]!.sale_line_id,
        quantity,
      },
    ],
  };
}
async function post(body: unknown) {
  const response = await fetch(url + '/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}
await describe('Return ingestion', async () => {
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
    await database.query(
      'TRUNCATE return_lines, return_events, sale_lines, sale_receipts, accepted_events',
    );
  });
  await it('calculates partial refunds from historical prices and subtracts at return time only', async () => {
    const sale = saleBody();
    assert.equal((await post(sale)).status, 201);
    const first = await post(refund(sale));
    assert.equal(first.status, 201);
    assert.equal(first.body.amount_minor, '101');
    const query = new PostgresRankingQuery(database, 'KGS');
    const snapshot = await query.get('hour', '2026-10-13T06:30:00Z');
    const row = snapshot.rows.find((row) => row.outlet_id === sale.outlet_id)!;
    assert.equal(row.net_revenue_minor, '-101');
    assert.equal(row.receipt_count, 0);
    assert.equal(row.average_check_minor, null);
    assert.equal(row.previous_revenue_minor, '405');
    const second = await post(refund(sale, 2));
    assert.equal(second.status, 201);
    assert.equal(second.body.amount_minor, '202');
    const excessive = await post(refund(sale));
    assert.equal(excessive.status, 422);
    assert.equal(excessive.body.code, 'return_limit');
  });
  await it('serializes concurrent identical and competing returns without over-refunding', async () => {
    const sale = saleBody();
    await post(sale);
    const same = refund(sale);
    const results = await Promise.all(
      Array.from({ length: 10 }, () => post(same)),
    );
    assert.equal(results.filter((result) => result.status === 201).length, 1);
    assert.equal(results.filter((result) => result.status === 200).length, 9);
    const competing = await Promise.all([
      post(refund(sale, 2)),
      post(refund(sale, 2)),
    ]);
    assert.deepEqual(
      competing.map((result) => result.status).sort(),
      [201, 422],
    );
    const rows: { returned_quantity: string; returned_amount_minor: string }[] =
      await database.query(
        'SELECT returned_quantity, returned_amount_minor FROM sale_lines WHERE receipt_id = $1 AND sale_line_id = $2',
        [sale.receipt_id, sale.lines[0]!.sale_line_id],
      );
    assert.deepEqual(rows, [
      { returned_quantity: '3', returned_amount_minor: '303' },
    ]);
    const conflict = await post({
      ...same,
      lines: [{ ...same.lines[0], quantity: 2 }],
    });
    assert.equal(conflict.status, 409);
  });
  await it('rejects wrong outlets, missing references, early returns and client refund amounts atomically', async () => {
    const sale = saleBody();
    await post(sale);
    for (const body of [
      { ...refund(sale), outlet_id: ALMATY_OUTLET_ID },
      { ...refund(sale), sale_receipt_id: randomUUID() },
      { ...refund(sale), occurred_at: '2026-10-13T04:59:59Z' },
      { ...refund(sale), amount_minor: '1' },
      { ...refund(sale), lines: [] },
      { ...refund(sale), lines: [{ ...refund(sale).lines[0], quantity: 0 }] },
      {
        ...refund(sale),
        lines: [{ ...refund(sale).lines[0], sale_line_id: randomUUID() }],
      },
      {
        ...refund(sale),
        lines: [
          refund(sale).lines[0]!,
          { ...refund(sale).lines[0], sale_line_id: randomUUID() },
        ],
      },
    ])
      assert.equal((await post(body)).status, 422);
    const rows: { count: string }[] = await database.query(
      'SELECT count(*) FROM return_events',
    );
    assert.equal(rows[0]!.count, '0');
  });
  await it('rolls back saved refunds, cumulative totals and ledger when a later write fails', async () => {
    const sale = saleBody();
    await post(sale);
    const input = refund(sale);
    const runner = new PostgresTransactionRunner(database);
    const ingest = new IngestEvent(
      {
        run: (operation) =>
          runner.run(async (ports) => {
            const save = ports.receipts.saveReturn.bind(ports.receipts);
            ports.receipts.saveReturn = async (event) => {
              await save(event);
              throw new Error('failure after return lines');
            };
            return operation(ports);
          }),
      },
      new SystemClock(),
      { request: () => assert.fail('No refresh on rollback') },
    );
    await assert.rejects(ingest.execute(input), /failure after return lines/);
    const receipts: { returned_quantity: string }[] = await database.query(
      'SELECT returned_quantity FROM sale_lines WHERE receipt_id = $1',
      [sale.receipt_id],
    );
    assert.ok(receipts.every((row) => row.returned_quantity === '0'));
    const ledger: unknown[] = await database.query(
      'SELECT * FROM accepted_events WHERE event_id = $1',
      [input.event_id],
    );
    assert.equal(ledger.length, 0);
    assert.equal((await post(input)).status, 201);
  });
  await it('normalizes return UUID casing, offsets and line order for retries', async () => {
    const sale = saleBody();
    await post(sale);
    const input = refund(sale);
    input.lines.push({
      return_line_id: randomUUID(),
      sale_line_id: sale.lines[1]!.sale_line_id,
      quantity: 1,
    });
    const first = await post(input);
    const retry = await post({
      ...input,
      event_id: input.event_id.toUpperCase(),
      sale_receipt_id: input.sale_receipt_id.toUpperCase(),
      outlet_id: input.outlet_id.toUpperCase(),
      occurred_at: '2026-10-13T12:00:00+06:00',
      lines: [...input.lines]
        .reverse()
        .map((line) => ({
          ...line,
          sale_line_id: line.sale_line_id.toUpperCase(),
          return_line_id: line.return_line_id.toUpperCase(),
        })),
    });
    assert.equal(retry.status, 200);
    assert.deepEqual(retry.body, { ...first.body, duplicate: true });
  });
});
