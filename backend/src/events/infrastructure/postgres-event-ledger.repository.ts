/* External deps */
import type { EntityManager } from 'typeorm';

/* Internal deps */
import type { EventKind } from '../../shared/domain/value-types.js';
import type { EventLedgerRepository } from '../application/ports/event-repositories.js';
import type { AcceptedEvent, StoredEvent } from '../domain/event.js';

// Raw row shape from node-postgres: bigint arrives as a string and
// timestamptz as a Date, so both are converted explicitly in find().
interface StoredEventRow {
  event_id: string;
  kind: EventKind;
  outlet_id: string;
  payload_hash: string;
  amount_minor: string;
  accepted_at: Date;
}

export class PostgresEventLedgerRepository implements EventLedgerRepository {
  constructor(private readonly manager: EntityManager) {}

  async find(eventId: string): Promise<StoredEvent | null> {
    const rows: StoredEventRow[] = await this.manager.query(
      `SELECT event_id, kind, outlet_id, payload_hash, amount_minor, accepted_at
       FROM accepted_events
       WHERE event_id = $1`,
      [eventId],
    );

    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    return {
      payload_hash: row.payload_hash,
      acceptance: {
        event_id: row.event_id,
        outlet_id: row.outlet_id,
        kind: row.kind,
        accepted_at: row.accepted_at.toISOString(),
        amount_minor: BigInt(row.amount_minor),
        // The stored row is the original acceptance; the caller marks retries.
        duplicate: false,
      },
    };
  }

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
