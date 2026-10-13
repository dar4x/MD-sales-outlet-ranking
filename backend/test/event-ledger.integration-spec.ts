/* External deps */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import 'reflect-metadata';

/* Internal deps */
import dataSource from '../src/database/data-source.js';
import type { AcceptedEvent } from '../src/events/domain/event.js';
import { PostgresEventLedgerRepository } from '../src/events/infrastructure/postgres-event-ledger.repository.js';

// Requires a running PostgreSQL with migrations applied (npm run migration:run).
// Each test uses a fresh event_id, so no table cleanup is needed.
function buildAcceptedEvent(eventId: string): AcceptedEvent {
  const outletId = randomUUID();
  const occurredAt = '2026-10-13T06:00:00.000Z';
  return {
    event_id: eventId,
    canonical_payload: JSON.stringify({ event_id: eventId, kind: 'sale' }),
    payload_hash: 'test-hash',
    input: {
      kind: 'sale',
      event_id: eventId,
      receipt_id: randomUUID(),
      outlet_id: outletId,
      occurred_at: occurredAt,
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

await describe('PostgresEventLedgerRepository', async () => {
  // One pool for the whole suite; a top-level after() hook closed it
  // before the second test had started.
  before(() => dataSource.initialize());
  after(() => dataSource.destroy());

  await it('insert stores a new event once', async () => {
    const repository = new PostgresEventLedgerRepository(dataSource.manager);
    const event = buildAcceptedEvent(randomUUID());

    const result = await repository.insert(event);

    assert.equal(result, 'inserted');
  });

  await it('insert reports a conflict for an existing event_id', async () => {
    const repository = new PostgresEventLedgerRepository(dataSource.manager);
    const event = buildAcceptedEvent(randomUUID());
    await repository.insert(event);

    const secondResult = await repository.insert(event);

    assert.equal(secondResult, 'event_conflict');
  });
});
