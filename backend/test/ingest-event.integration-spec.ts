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
  ReceiptConflictError,
} from '../src/events/domain/event-errors.js';
import type { SaleInput } from '../src/events/domain/event.js';
import type { Clock } from '../src/shared/application/ports/clock.js';
import type {
  TransactionPorts,
  TransactionRunner,
} from '../src/shared/application/ports/transaction-runner.js';
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

// Wraps the real runner: the receipt and its lines are really inserted, then
// an error is thrown inside the same transaction, as if a later step failed.
class FailAfterReceiptRunner implements TransactionRunner {
  constructor(private readonly inner: PostgresTransactionRunner) {}

  run<Result>(
    operation: (ports: TransactionPorts) => Promise<Result>,
  ): Promise<Result> {
    return this.inner.run((ports) => {
      const failingPorts: TransactionPorts = {
        ...ports,
        receipts: {
          insert: async (receipt) => {
            await ports.receipts.insert(receipt);
            throw new Error('Simulated failure after receipt insert.');
          },
        },
      };
      return operation(failingPorts);
    });
  }
}

function assertValidationCode(expectedCode: string) {
  return (error: unknown): boolean =>
    error instanceof EventValidationError && error.code === expectedCode;
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
      quantity: string;
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
        quantity: '2',
        unit_price_minor: '5000',
        line_amount_minor: '10000',
      },
      {
        sale_line_id: sale.lines[1]!.sale_line_id,
        product_id: MILK_PRODUCT_ID,
        quantity: '1',
        unit_price_minor: '2500',
        line_amount_minor: '2500',
      },
    ]);
  });

  await it('rolls back the event, receipt and lines when a later step fails', async () => {
    const ingestEvent = new IngestEvent(
      new FailAfterReceiptRunner(new PostgresTransactionRunner(dataSource)),
      new FakeClock(),
    );
    const sale = buildSale(randomUUID());

    await assert.rejects(ingestEvent.execute(sale), /failure after receipt/);

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

  await it('rejects a receipt_id reused by another event and keeps the first', async () => {
    const ingestEvent = new IngestEvent(
      new PostgresTransactionRunner(dataSource),
      new FakeClock(),
    );
    const firstSale = buildSale(randomUUID());
    await ingestEvent.execute(firstSale);
    const secondSale: SaleInput = {
      ...buildSale(randomUUID()),
      receipt_id: firstSale.receipt_id,
    };

    await assert.rejects(ingestEvent.execute(secondSale), ReceiptConflictError);

    // The rejected event left no ledger row; the first receipt is unchanged.
    assert.equal(await countLedgerRows(secondSale.event_id), 0);
    assert.deepEqual(await countReceiptRows(firstSale.receipt_id), {
      receipts: 1,
      lines: 2,
    });
    const owners: { event_id: string }[] = await dataSource.query(
      'SELECT event_id FROM sale_receipts WHERE receipt_id = $1',
      [firstSale.receipt_id],
    );
    assert.deepEqual(owners, [{ event_id: firstSale.event_id }]);

    // The first event's retry is still an ordinary duplicate.
    const retry = await ingestEvent.execute(firstSale);
    assert.equal(retry.outcome, 'duplicate');
  });

  await it('accepts one of 10 parallel events sharing a receipt_id', async () => {
    const ingestEvent = new IngestEvent(
      new PostgresTransactionRunner(dataSource),
      new FakeClock(),
    );
    const receiptId = randomUUID();

    // Different event_ids, so the ledger accepts all of them; only the
    // receipt_id collides.
    const sales: SaleInput[] = [];
    for (let index = 0; index < 10; index += 1) {
      sales.push({ ...buildSale(randomUUID()), receipt_id: receiptId });
    }
    const calls = [];
    for (const sale of sales) {
      calls.push(ingestEvent.execute(sale));
    }
    const results = await Promise.allSettled(calls);

    let createdCount = 0;
    let receiptConflictCount = 0;
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.outcome === 'created') {
        createdCount += 1;
      } else if (
        result.status === 'rejected' &&
        result.reason instanceof ReceiptConflictError
      ) {
        receiptConflictCount += 1;
      }
    }
    assert.equal(createdCount, 1);
    assert.equal(receiptConflictCount, 9);

    // Losers rolled back their ledger rows: exactly one of the 10 remains.
    const eventIds: string[] = [];
    for (const sale of sales) {
      eventIds.push(sale.event_id);
    }
    const ledgerRows: { count: string }[] = await dataSource.query(
      'SELECT count(*) AS count FROM accepted_events WHERE event_id = ANY($1::uuid[])',
      [eventIds],
    );
    assert.equal(Number(ledgerRows[0]?.count), 1);
    assert.deepEqual(await countReceiptRows(receiptId), {
      receipts: 1,
      lines: 2,
    });
  });

  await it('rejects an unknown outlet and stores nothing', async () => {
    const ingestEvent = new IngestEvent(
      new PostgresTransactionRunner(dataSource),
      new FakeClock(),
    );
    const sale: SaleInput = {
      ...buildSale(randomUUID()),
      outlet_id: randomUUID(),
    };

    await assert.rejects(
      ingestEvent.execute(sale),
      assertValidationCode('unknown_outlet'),
    );
    assert.equal(await countLedgerRows(sale.event_id), 0);
    assert.deepEqual(await countReceiptRows(sale.receipt_id), {
      receipts: 0,
      lines: 0,
    });
  });

  await it('rejects an unknown product on a later line and stores nothing', async () => {
    const ingestEvent = new IngestEvent(
      new PostgresTransactionRunner(dataSource),
      new FakeClock(),
    );
    const sale = buildSale(randomUUID());
    const unknownProductId = randomUUID();
    // First line is valid; only the second line has an unknown product.
    sale.lines[1] = { ...sale.lines[1]!, product_id: unknownProductId };

    await assert.rejects(ingestEvent.execute(sale), (error: unknown) => {
      return (
        assertValidationCode('unknown_product')(error) &&
        error instanceof Error &&
        error.message.includes(sale.lines[1]!.sale_line_id) &&
        error.message.includes(unknownProductId)
      );
    });
    assert.equal(await countLedgerRows(sale.event_id), 0);
    assert.deepEqual(await countReceiptRows(sale.receipt_id), {
      receipts: 0,
      lines: 0,
    });
  });

  await it('reports the first unknown product when several lines are unknown', async () => {
    const ingestEvent = new IngestEvent(
      new PostgresTransactionRunner(dataSource),
      new FakeClock(),
    );
    const sale = buildSale(randomUUID());
    const firstUnknownId = randomUUID();
    sale.lines[0] = { ...sale.lines[0]!, product_id: firstUnknownId };
    sale.lines[1] = { ...sale.lines[1]!, product_id: randomUUID() };

    await assert.rejects(ingestEvent.execute(sale), (error: unknown) => {
      return (
        assertValidationCode('unknown_product')(error) &&
        error instanceof Error &&
        error.message.includes(firstUnknownId)
      );
    });
    assert.equal(await countLedgerRows(sale.event_id), 0);
  });

  await it('accepts valid and rejects unknown-product events in parallel', async () => {
    const ingestEvent = new IngestEvent(
      new PostgresTransactionRunner(dataSource),
      new FakeClock(),
    );

    // Same outlet for all 10, so they also queue on the outlet lock.
    const sales: SaleInput[] = [];
    for (let index = 0; index < 10; index += 1) {
      const sale = buildSale(randomUUID());
      if (index % 2 === 1) {
        sale.lines[1] = { ...sale.lines[1]!, product_id: randomUUID() };
      }
      sales.push(sale);
    }
    const calls = [];
    for (const sale of sales) {
      calls.push(ingestEvent.execute(sale));
    }
    const results = await Promise.allSettled(calls);

    let createdCount = 0;
    let unknownProductCount = 0;
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.outcome === 'created') {
        createdCount += 1;
      } else if (
        result.status === 'rejected' &&
        assertValidationCode('unknown_product')(result.reason)
      ) {
        unknownProductCount += 1;
      }
    }
    assert.equal(createdCount, 5);
    assert.equal(unknownProductCount, 5);

    for (let index = 0; index < sales.length; index += 1) {
      const expectedRows = index % 2 === 0 ? 1 : 0;
      const sale = sales[index]!;
      assert.equal(await countLedgerRows(sale.event_id), expectedRows);
      assert.deepEqual(await countReceiptRows(sale.receipt_id), {
        receipts: expectedRows,
        lines: expectedRows * 2,
      });
    }
  });

  await it('stores the largest safe integer quantity exactly', async () => {
    const ingestEvent = new IngestEvent(
      new PostgresTransactionRunner(dataSource),
      new FakeClock(),
    );
    const sale = buildSale(randomUUID());
    sale.lines[1] = {
      ...sale.lines[1]!,
      quantity: Number.MAX_SAFE_INTEGER,
      unit_price_minor: 0n,
      line_amount_minor: 0n,
    };

    await ingestEvent.execute(sale);

    const rows: { quantity: string }[] = await dataSource.query(
      'SELECT quantity FROM sale_lines WHERE receipt_id = $1 AND sale_line_id = $2',
      [sale.receipt_id, sale.lines[1].sale_line_id],
    );
    assert.deepEqual(rows, [{ quantity: '9007199254740991' }]);
  });

  await it('returns 409 for a known event_id changed to an unknown outlet', async () => {
    const ingestEvent = new IngestEvent(
      new PostgresTransactionRunner(dataSource),
      new FakeClock(),
    );
    const sale = buildSale(randomUUID());
    await ingestEvent.execute(sale);
    const changedSale: SaleInput = { ...sale, outlet_id: randomUUID() };

    await assert.rejects(ingestEvent.execute(changedSale), EventConflictError);
    assert.equal(await countLedgerRows(sale.event_id), 1);
    assert.deepEqual(await countReceiptRows(sale.receipt_id), {
      receipts: 1,
      lines: 2,
    });
  });

  await it('returns 409 for a known event_id changed to an unknown product', async () => {
    const ingestEvent = new IngestEvent(
      new PostgresTransactionRunner(dataSource),
      new FakeClock(),
    );
    const sale = buildSale(randomUUID());
    await ingestEvent.execute(sale);
    const changedSale = buildSale(sale.event_id);
    changedSale.receipt_id = sale.receipt_id;
    changedSale.lines[1] = {
      ...changedSale.lines[1]!,
      product_id: randomUUID(),
    };

    await assert.rejects(ingestEvent.execute(changedSale), EventConflictError);
    assert.equal(await countLedgerRows(sale.event_id), 1);
    assert.deepEqual(await countReceiptRows(sale.receipt_id), {
      receipts: 1,
      lines: 2,
    });
  });

  await it(
    'decides an unknown-outlet change by what is committed when it runs',
    { timeout: 10000 },
    async () => {
      const ingestEvent = new IngestEvent(
        new PostgresTransactionRunner(dataSource),
        new FakeClock(),
      );
      const sale = buildSale(randomUUID());
      const changedSale: SaleInput = { ...sale, outlet_id: randomUUID() };

      // Simulates request A in the middle of its transaction: its ledger row
      // is inserted but not committed yet.
      const requestA = dataSource.createQueryRunner();
      await requestA.connect();
      await requestA.startTransaction();
      try {
        await requestA.query(
          `INSERT INTO accepted_events (
             event_id, kind, outlet_id, occurred_at, payload_hash,
             canonical_payload, amount_minor, accepted_at
           )
           VALUES ($1, 'sale', $2, $3, 'hash-a', '{}'::jsonb, 0, $3)`,
          [sale.event_id, sale.outlet_id, '2026-10-13T06:00:00Z'],
        );

        // Request B does not wait for A: the event is not accepted yet, so B
        // sees an unknown outlet (422). This equals the serial order B, A.
        await assert.rejects(
          ingestEvent.execute(changedSale),
          assertValidationCode('unknown_outlet'),
        );

        await requestA.commitTransaction();
      } finally {
        await requestA.release();
      }

      // Once A has committed, the same request is a changed payload for an
      // accepted event_id (409), as the contract requires.
      await assert.rejects(
        ingestEvent.execute(changedSale),
        EventConflictError,
      );
    },
  );
});
