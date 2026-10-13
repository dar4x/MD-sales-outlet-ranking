/* External deps */
import type { MigrationInterface, QueryRunner } from 'typeorm';

// Ledger of accepted events; the event_id primary key makes ingestion
// idempotent. accepted_at has no DEFAULT on purpose: the application sets it
// from the Clock port so tests control time and retries reuse the original.
export class CreateAcceptedEvents1791860818001 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE accepted_events (
        event_id uuid PRIMARY KEY,
        kind text NOT NULL CHECK (kind IN ('sale', 'return')),
        outlet_id uuid NOT NULL,
        occurred_at timestamptz NOT NULL,
        payload_hash text NOT NULL,
        canonical_payload jsonb NOT NULL,
        amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
        accepted_at timestamptz NOT NULL
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE accepted_events');
  }
}
