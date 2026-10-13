/* External deps */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import 'reflect-metadata';

/* Internal deps */
import dataSource from '../src/database/data-source.js';
import { IngestEvent } from '../src/events/application/ingest-event.js';
import {
  EventConflictError,
  EventValidationError,
} from '../src/events/domain/event-errors.js';
import type { SaleInput } from '../src/events/domain/event.js';
import type { Clock } from '../src/shared/application/ports/clock.js';
import { PostgresTransactionRunner } from '../src/shared/infrastructure/postgres-transaction-runner.js';
import {
  ALMATY_OUTLET_ID,
  BISHKEK_OUTLET_ID,
  BREAD_PRODUCT_ID,
  MILK_PRODUCT_ID,
} from './seed-data.js';

// Requires a running PostgreSQL with migrations applied (npm run migration:run).
// Each test uses a fresh event_id, so no table cleanup is needed.
const FIRST_ACCEPTED_AT = '2026-10-13T06:00:05.000Z';
const LATER_ACCEPTED_AT = '2026-10-13T06:10:00.000Z';

// A clock the test can move forward to prove retries keep accepted_at.
class FakeClock implements Clock {
  current = FIRST_ACCEPTED_AT;

  now(): string {
    return this.current;
  }
}

function buildSale(eventId: string): SaleInput {
  return {
    kind: 'sale',
    event_id: eventId,
    receipt_id: randomUUID(),
    outlet_id: BISHKEK_OUTLET_ID,
    occurred_at: '2026-10-13T12:00:00+06:00',
    lines: [
      {
        sale_line_id: randomUUID(),
        product_id: BREAD_PRODUCT_ID,
        quantity: 2,
        unit_price_minor: 5000n,
        line_amount_minor: 10000n,
      },
      {
        sale_line_id: randomUUID(),
        product_id: MILK_PRODUCT_ID,
        quantity: 1,
        unit_price_minor: 2500n,
        line_amount_minor: 2500n,
      },
    ],
  };
}

async function countLedgerRows(eventId: string): Promise<number> {
  const rows: { count: string }[] = await dataSource.query(
    'SELECT count(*) AS count FROM accepted_events WHERE event_id = $1',
    [eventId],
  );
  return Number(rows[0]?.count);
}

async function countReceiptRows(
  receiptId: string,
): Promise<{ receipts: number; lines: number }> {
  const rows: { receipts: string; lines: string }[] = await dataSource.query(
    `SELECT
       (SELECT count(*) FROM sale_receipts WHERE receipt_id = $1) AS receipts,
       (SELECT count(*) FROM sale_lines WHERE receipt_id = $1) AS lines`,
    [receiptId],
  );
  return { receipts: Number(rows[0]?.receipts), lines: Number(rows[0]?.lines) };
}

await describe('IngestEvent', async () => {
  before(() => dataSource.initialize());
  after(() => dataSource.destroy());

  await it('accepts a new sale with the summed amount', async () => {
    const ingestEvent = new IngestEvent(
      new PostgresTransactionRunner(dataSource),
      new FakeClock(),
    );
    const sale = buildSale(randomUUID());

    const result = await ingestEvent.execute(sale);

    assert.deepEqual(result, {
      outcome: 'created',
      acceptance: {
        event_id: sale.event_id,
        outlet_id: sale.outlet_id,
        kind: 'sale',
        accepted_at: FIRST_ACCEPTED_AT,
        amount_minor: 12500n,
        duplicate: false,
      },
    });
  });

  await it('stores the receipt and its lines with the accepted event', async () => {
    const ingestEvent = new IngestEvent(
      new PostgresTransactionRunner(dataSource),
      new FakeClock(),
    );
    const sale = buildSale(randomUUID());

    await ingestEvent.execute(sale);

    const receiptRows: {
      event_id: string;
      outlet_id: string;
      occurred_at: Date;
      gross_amount_minor: string;
    }[] = await dataSource.query(
      `SELECT event_id, outlet_id, occurred_at, gross_amount_minor
       FROM sale_receipts WHERE receipt_id = $1`,
      [sale.receipt_id],
    );
    assert.deepEqual(receiptRows, [
      {
        event_id: sale.event_id,
        outlet_id: BISHKEK_OUTLET_ID,
        occurred_at: new Date('2026-10-13T06:00:00Z'),
        gross_amount_minor: '12500',
      },
    ]);

    const lineRows: {
      sale_line_id: string;
      product_id: string;
      quantity: number;
      unit_price_minor: string;
      line_amount_minor: string;
    }[] = await dataSource.query(
      `SELECT sale_line_id, product_id, quantity, unit_price_minor,
              line_amount_minor
       FROM sale_lines WHERE receipt_id = $1 ORDER BY line_amount_minor DESC`,
      [sale.receipt_id],
    );
    assert.deepEqual(lineRows, [
      {
        sale_line_id: sale.lines[0]!.sale_line_id,
        product_id: BREAD_PRODUCT_ID,
        quantity: 2,
        unit_price_minor: '5000',
        line_amount_minor: '10000',
      },
      {
        sale_line_id: sale.lines[1]!.sale_line_id,
        product_id: MILK_PRODUCT_ID,
        quantity: 1,
        unit_price_minor: '2500',
        line_amount_minor: '2500',
      },
    ]);
  });

  await it('rolls back the accepted event when a line cannot be stored', async () => {
    const ingestEvent = new IngestEvent(
      new PostgresTransactionRunner(dataSource),
      new FakeClock(),
    );
    const sale = buildSale(randomUUID());
    // The second line references a product that is not seeded, so its
    // INSERT fails after the ledger row and the receipt row were written.
    sale.lines[1] = { ...sale.lines[1]!, product_id: randomUUID() };

    await assert.rejects(ingestEvent.execute(sale), /foreign key constraint/);

    assert.equal(await countLedgerRows(sale.event_id), 0);
    assert.deepEqual(await countReceiptRows(sale.receipt_id), {
      receipts: 0,
      lines: 0,
    });
  });

  await it('returns the original acceptance for an identical retry', async () => {
    const clock = new FakeClock();
    const ingestEvent = new IngestEvent(
      new PostgresTransactionRunner(dataSource),
      clock,
    );
    const sale = buildSale(randomUUID());
    await ingestEvent.execute(sale);
    clock.current = LATER_ACCEPTED_AT;

    const retry = await ingestEvent.execute(sale);

    assert.equal(retry.outcome, 'duplicate');
    assert.equal(retry.acceptance.duplicate, true);
    assert.equal(retry.acceptance.accepted_at, FIRST_ACCEPTED_AT);
    assert.equal(await countLedgerRows(sale.event_id), 1);
    assert.deepEqual(await countReceiptRows(sale.receipt_id), {
      receipts: 1,
      lines: 2,
    });
  });

  await it('treats reordered lines and another offset as the same event', async () => {
    const ingestEvent = new IngestEvent(
      new PostgresTransactionRunner(dataSource),
      new FakeClock(),
    );
    const sale = buildSale(randomUUID());
    await ingestEvent.execute(sale);
    const sameSaleInUtc: SaleInput = {
      ...sale,
      occurred_at: '2026-10-13T06:00:00Z',
      lines: [...sale.lines].reverse(),
    };

    const retry = await ingestEvent.execute(sameSaleInUtc);

    assert.equal(retry.outcome, 'duplicate');
  });

  await it('rejects the same event_id with a different payload', async () => {
    const ingestEvent = new IngestEvent(
      new PostgresTransactionRunner(dataSource),
      new FakeClock(),
    );
    const sale = buildSale(randomUUID());
    await ingestEvent.execute(sale);
    const changedSale: SaleInput = { ...sale, outlet_id: ALMATY_OUTLET_ID };

    await assert.rejects(ingestEvent.execute(changedSale), EventConflictError);
    assert.equal(await countLedgerRows(sale.event_id), 1);
  });

  await it('rejects an invalid sale before storing anything', async () => {
    const ingestEvent = new IngestEvent(
      new PostgresTransactionRunner(dataSource),
      new FakeClock(),
    );
    const sale = buildSale(randomUUID());
    sale.lines[0] = { ...sale.lines[0]!, line_amount_minor: 1n };

    await assert.rejects(ingestEvent.execute(sale), EventValidationError);
    assert.equal(await countLedgerRows(sale.event_id), 0);
    assert.deepEqual(await countReceiptRows(sale.receipt_id), {
      receipts: 0,
      lines: 0,
    });
  });

  await it('creates once and reports duplicates for 10 parallel identical calls', async () => {
    const ingestEvent = new IngestEvent(
      new PostgresTransactionRunner(dataSource),
      new FakeClock(),
    );
    const sale = buildSale(randomUUID());

    const calls = [];
    for (let index = 0; index < 10; index += 1) {
      calls.push(ingestEvent.execute(sale));
    }
    const results = await Promise.all(calls);

    let createdCount = 0;
    let duplicateCount = 0;
    for (const result of results) {
      if (result.outcome === 'created') {
        createdCount += 1;
      } else {
        duplicateCount += 1;
      }
    }
    assert.equal(createdCount, 1);
    assert.equal(duplicateCount, 9);
    assert.equal(await countLedgerRows(sale.event_id), 1);
    assert.deepEqual(await countReceiptRows(sale.receipt_id), {
      receipts: 1,
      lines: 2,
    });
  });

  await it('creates once and conflicts the rest for 10 parallel different payloads', async () => {
    const ingestEvent = new IngestEvent(
      new PostgresTransactionRunner(dataSource),
      new FakeClock(),
    );
    const eventId = randomUUID();

    // Same event_id and outlet, but every call has its own quantity on the
    // first line, so each payload hash is different.
    const calls = [];
    for (let index = 0; index < 10; index += 1) {
      const sale = buildSale(eventId);
      const quantity = index + 1;
      sale.lines[0] = {
        ...sale.lines[0]!,
        quantity,
        line_amount_minor: BigInt(quantity) * sale.lines[0]!.unit_price_minor,
      };
      calls.push(ingestEvent.execute(sale));
    }
    const results = await Promise.allSettled(calls);

    let createdCount = 0;
    let conflictCount = 0;
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.outcome === 'created') {
        createdCount += 1;
      } else if (
        result.status === 'rejected' &&
        result.reason instanceof EventConflictError
      ) {
        conflictCount += 1;
      }
    }
    assert.equal(createdCount, 1);
    assert.equal(conflictCount, 9);
    assert.equal(await countLedgerRows(eventId), 1);
  });
});
