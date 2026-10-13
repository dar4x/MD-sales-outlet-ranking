/* External deps */
import type { EntityManager } from 'typeorm';

/* Internal deps */
import type { OutletActivityRepository } from '../application/ports/event-repositories.js';

export class PostgresOutletActivityRepository implements OutletActivityRepository {
  constructor(private readonly manager: EntityManager) {}

  // FOR UPDATE holds the outlet row until the transaction ends, so events of
  // one outlet are processed one after another. An empty result means the
  // outlet does not exist.
  async lock(outletId: string): Promise<boolean> {
    const rows: unknown[] = await this.manager.query(
      'SELECT outlet_id FROM outlets WHERE outlet_id = $1 FOR UPDATE',
      [outletId],
    );
    return rows.length > 0;
  }

  // GREATEST keeps the latest time: accepted_at is read from the clock
  // before the outlet lock, so two events can commit in the opposite order
  // of their timestamps. GREATEST ignores NULL, so the first event sets it.
  async recordAccepted(outletId: string, acceptedAt: string): Promise<void> {
    await this.manager.query(
      `UPDATE outlets
       SET last_accepted_at = GREATEST(last_accepted_at, $2)
       WHERE outlet_id = $1`,
      [outletId, acceptedAt],
    );
  }
}
