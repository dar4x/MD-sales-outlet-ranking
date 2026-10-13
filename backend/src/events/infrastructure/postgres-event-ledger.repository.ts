/* External deps */
import type { EntityManager } from 'typeorm';

/* Internal deps */
import type { AcceptedEvent } from '../domain/event.js';

export class PostgresEventLedgerRepository {
  constructor(private readonly manager: EntityManager) {}

  async insert(event: AcceptedEvent): Promise<'inserted' | 'event_conflict'> {
    // ON CONFLICT instead of SELECT-then-INSERT: two concurrent retries of
    // the same event cannot both pass a check, the primary key decides.
    // RETURNING gives back a row only when this call actually inserted.
    const insertedRows: unknown[] = await this.manager.query(
      `INSERT INTO accepted_events (
         event_id, kind, outlet_id, occurred_at, payload_hash,
         canonical_payload, amount_minor, accepted_at
       )
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
       ON CONFLICT (event_id) DO NOTHING
       RETURNING event_id`,
      [
        event.event_id,
        event.acceptance.kind,
        event.acceptance.outlet_id,
        event.input.occurred_at,
        event.payload_hash,
        event.canonical_payload,
        event.acceptance.amount_minor.toString(),
        event.acceptance.accepted_at,
      ],
    );

    if (insertedRows.length === 0) {
      return 'event_conflict';
    }
    return 'inserted';
  }
}
