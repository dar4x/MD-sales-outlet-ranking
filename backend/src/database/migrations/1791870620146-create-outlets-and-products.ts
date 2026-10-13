/* External deps */
import type { MigrationInterface, QueryRunner } from 'typeorm';

// Outlets and products are seeded by the server (no CRUD in scope), so the
// seed lives in the migration with fixed IDs to make results reproducible.
export class CreateOutletsAndProducts1791870620146 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE outlets (
        outlet_id uuid PRIMARY KEY,
        name text NOT NULL UNIQUE,
        time_zone text NOT NULL,
        daily_plan_minor bigint NOT NULL CHECK (daily_plan_minor > 0),
        responsible_name text NOT NULL,
        responsible_email text NOT NULL,
        activated_at timestamptz NOT NULL,
        last_accepted_at timestamptz
      )
    `);
    await queryRunner.query(`
      CREATE TABLE products (
        product_id uuid PRIMARY KEY,
        sku text NOT NULL UNIQUE,
        name text NOT NULL,
        unit_price_minor bigint NOT NULL CHECK (unit_price_minor >= 0)
      )
    `);

    // Five distinct IANA zones. Asia/Almaty and Asia/Tashkent are both UTC+5
    // today but stay separate zones; Europe/Berlin is the one with DST.
    // Plans are in KGS minor units (tyiyn): 5000000 = 50 000 KGS.
    await queryRunner.query(`
      INSERT INTO outlets (
        outlet_id, name, time_zone, daily_plan_minor,
        responsible_name, responsible_email, activated_at
      )
      VALUES
        ('00000000-0000-4000-8000-000000000001', 'Bishkek Center', 'Asia/Bishkek',
         5000000, 'Aibek Asanov', 'bishkek.manager@example.com', '2026-10-01T00:00:00Z'),
        ('00000000-0000-4000-8000-000000000002', 'Almaty Mall', 'Asia/Almaty',
         4000000, 'Dana Nurlanova', 'almaty.manager@example.com', '2026-10-01T00:00:00Z'),
        ('00000000-0000-4000-8000-000000000003', 'Tashkent Bazaar', 'Asia/Tashkent',
         3000000, 'Jasur Karimov', 'tashkent.manager@example.com', '2026-10-01T00:00:00Z'),
        ('00000000-0000-4000-8000-000000000004', 'Moscow Arbat', 'Europe/Moscow',
         6000000, 'Olga Smirnova', 'moscow.manager@example.com', '2026-10-01T00:00:00Z'),
        ('00000000-0000-4000-8000-000000000005', 'Berlin Mitte', 'Europe/Berlin',
         3500000, 'Lena Fischer', 'berlin.manager@example.com', '2026-10-01T00:00:00Z')
    `);

    await queryRunner.query(`
      INSERT INTO products (product_id, sku, name, unit_price_minor)
      VALUES
        ('00000000-0000-4000-9000-000000000001', 'BREAD-001', 'Bread loaf', 4500),
        ('00000000-0000-4000-9000-000000000002', 'MILK-001', 'Milk 1 L', 9000),
        ('00000000-0000-4000-9000-000000000003', 'TEA-001', 'Green tea 100 g', 15000),
        ('00000000-0000-4000-9000-000000000004', 'RICE-001', 'Rice 1 kg', 12000),
        ('00000000-0000-4000-9000-000000000005', 'OIL-001', 'Sunflower oil 1 L', 18500),
        ('00000000-0000-4000-9000-000000000006', 'SUGAR-001', 'Sugar 1 kg', 8000)
    `);

    // A CHECK constraint cannot query pg_timezone_names, so the seeded zones
    // are verified here; an unknown zone aborts the migration.
    // manager.query is used for its typed result; it runs on the same
    // connection and transaction as queryRunner.
    const unknownZones = await queryRunner.manager.query<
      { time_zone: string }[]
    >(`
      SELECT time_zone FROM outlets
      WHERE time_zone NOT IN (SELECT name FROM pg_timezone_names)
    `);
    if (unknownZones.length > 0) {
      throw new Error('Unknown IANA time zone in outlet seed data.');
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE products');
    await queryRunner.query('DROP TABLE outlets');
  }
}
