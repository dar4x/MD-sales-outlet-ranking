/* External deps */
import type { MigrationInterface, QueryRunner } from 'typeorm';

// One accepted sale event = one receipt with its lines. The receipt keeps the
// historical unit price; products.unit_price_minor may change later.
export class CreateSaleReceipts1791871681261 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE sale_receipts (
        receipt_id uuid PRIMARY KEY,
        event_id uuid NOT NULL UNIQUE REFERENCES accepted_events (event_id),
        outlet_id uuid NOT NULL REFERENCES outlets (outlet_id),
        occurred_at timestamptz NOT NULL,
        gross_amount_minor bigint NOT NULL CHECK (gross_amount_minor >= 0)
      )
    `);

    // Line IDs are unique within their receipt, hence the composite key.
    // The amount CHECK repeats the application rule as a last safety net.
    await queryRunner.query(`
      CREATE TABLE sale_lines (
        receipt_id uuid NOT NULL REFERENCES sale_receipts (receipt_id),
        sale_line_id uuid NOT NULL,
        product_id uuid NOT NULL REFERENCES products (product_id),
        quantity integer NOT NULL CHECK (quantity > 0),
        unit_price_minor bigint NOT NULL CHECK (unit_price_minor >= 0),
        line_amount_minor bigint NOT NULL
          CHECK (line_amount_minor = quantity * unit_price_minor),
        PRIMARY KEY (receipt_id, sale_line_id)
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE sale_lines');
    await queryRunner.query('DROP TABLE sale_receipts');
  }
}
