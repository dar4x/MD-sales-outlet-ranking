/* External deps */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import 'reflect-metadata';

/* Internal deps */
import dataSource from '../src/database/data-source.js';
import type { AcceptedEvent } from '../src/events/domain/event.js';
import { PostgresEventLedgerRepository } from '../src/events/infrastructure/postgres-event-ledger.repository.js';
import { PostgresTransactionRunner } from '../src/shared/infrastructure/postgres-transaction-runner.js';

// Requires a running PostgreSQL with migrations applied (npm run migration:run).
function buildAcceptedEvent(eventId: string): AcceptedEvent {
  const outletId = randomUUID();
  return {
    event_id: eventId,
    canonical_payload: JSON.stringify({ event_id: eventId, kind: 'sale' }),
    payload_hash: 'test-hash',
    input: {
      kind: 'sale',
      event_id: eventId,
      receipt_id: randomUUID(),
      outlet_id: outletId,
      occurred_at: '2026-10-13T06:00:00.000Z',
      lines: [],
    },
    acceptance: {
      event_id: eventId,
      outlet_id: outletId,
      kind: 'sale',
      accepted_at: '2026-10-13T06:00:05.000Z',
      amount_minor: 15000n,
      duplicate: false,
    },
  };
}

await describe('PostgresTransactionRunner', async () => {
  before(() => dataSource.initialize());
  after(() => dataSource.destroy());

  await it('commits writes when the operation succeeds', async () => {
    const runner = new PostgresTransactionRunner(dataSource);
    const event = buildAcceptedEvent(randomUUID());

    await runner.run((ports) => ports.events.insert(event));

    const ledger = new PostgresEventLedgerRepository(dataSource.manager);
    assert.notEqual(await ledger.find(event.event_id), null);
  });

  await it('rolls back writes when the operation throws', async () => {
    const runner = new PostgresTransactionRunner(dataSource);
    const event = buildAcceptedEvent(randomUUID());

    await assert.rejects(
      runner.run(async (ports) => {
        await ports.events.insert(event);
        throw new Error('fail after insert');
      }),
      /fail after insert/,
    );

    const ledger = new PostgresEventLedgerRepository(dataSource.manager);
    assert.equal(await ledger.find(event.event_id), null);
  });
});
