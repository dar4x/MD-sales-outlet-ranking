/* External deps */
import type { MigrationInterface, QueryRunner } from 'typeorm';

// The API contract allows any JavaScript safe integer as a quantity
// (up to 2^53 - 1), which does not fit PostgreSQL integer (2^31 - 1).
export class WidenSaleLineQuantity1791873431921 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE sale_lines ALTER COLUMN quantity TYPE bigint',
    );
  }

  // Fails if a stored quantity no longer fits integer; that is intended,
  // since silently truncating a sale would be worse.
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE sale_lines ALTER COLUMN quantity TYPE integer',
    );
  }
}
