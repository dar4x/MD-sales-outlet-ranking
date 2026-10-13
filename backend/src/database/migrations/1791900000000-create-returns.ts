import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReturns1791900000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE sale_lines
      ADD COLUMN returned_quantity bigint NOT NULL DEFAULT 0 CHECK (returned_quantity >= 0 AND returned_quantity <= quantity),
      ADD COLUMN returned_amount_minor bigint NOT NULL DEFAULT 0 CHECK (returned_amount_minor >= 0 AND returned_amount_minor <= line_amount_minor)`);
    await runner.query(`CREATE TABLE return_events (
      event_id uuid PRIMARY KEY REFERENCES accepted_events(event_id),
      outlet_id uuid NOT NULL REFERENCES outlets(outlet_id),
      sale_receipt_id uuid NOT NULL REFERENCES sale_receipts(receipt_id),
      occurred_at timestamptz NOT NULL,
      amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
      UNIQUE (event_id, sale_receipt_id)
    )`);
    await runner.query(`CREATE TABLE return_lines (
      event_id uuid NOT NULL,
      return_line_id uuid NOT NULL,
      sale_receipt_id uuid NOT NULL,
      sale_line_id uuid NOT NULL,
      quantity bigint NOT NULL CHECK (quantity > 0 AND quantity <= 9007199254740991),
      amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
      PRIMARY KEY(event_id, return_line_id),
      FOREIGN KEY(event_id, sale_receipt_id) REFERENCES return_events(event_id, sale_receipt_id),
      FOREIGN KEY(sale_receipt_id, sale_line_id) REFERENCES sale_lines(receipt_id, sale_line_id)
    )`);
    await runner.query(
      'CREATE INDEX return_events_window ON return_events(outlet_id, occurred_at)',
    );
    await runner.query(
      'CREATE INDEX sale_receipts_window ON sale_receipts(outlet_id, occurred_at)',
    );
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TABLE return_lines');
    await runner.query('DROP TABLE return_events');
    await runner.query('DROP INDEX sale_receipts_window');
    await runner.query(
      'ALTER TABLE sale_lines DROP COLUMN returned_quantity, DROP COLUMN returned_amount_minor',
    );
  }
}
