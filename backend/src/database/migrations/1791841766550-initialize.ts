/* External deps */
import type { MigrationInterface } from 'typeorm';

// Establish migration history without creating domain tables.
export class Initialize1791841766550 implements MigrationInterface {
  up(): Promise<void> {
    return Promise.resolve();
  }

  down(): Promise<void> {
    return Promise.resolve();
  }
}
