/* External deps */
import type { MigrationInterface, QueryRunner } from 'typeorm';

// Every accepted event must belong to a seeded outlet. The constraint is
// validated against existing rows (no NOT VALID): if orphan rows exist, the
// migration fails and its transaction rolls back without changing any data.
export class AddAcceptedEventsOutletFk1791871329216 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE accepted_events
        ADD CONSTRAINT accepted_events_outlet_id_fkey
        FOREIGN KEY (outlet_id) REFERENCES outlets (outlet_id)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE accepted_events
        DROP CONSTRAINT accepted_events_outlet_id_fkey
    `);
  }
}
