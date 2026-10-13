import type { EntityManager } from 'typeorm';
import type { OutletRepository } from '../application/ports/outlet-repositories.js';
import type { Outlet, OutletSettingsPatch } from '../domain/outlet.js';

interface OutletRow {
  outlet_id: string;
  name: string;
  time_zone: string;
  daily_plan_minor: string;
  responsible_name: string;
  responsible_email: string;
  activated_at: Date;
  last_accepted_at: Date | null;
}
export function mapOutlet(row: OutletRow): Outlet {
  return {
    outlet_id: row.outlet_id,
    name: row.name,
    time_zone: row.time_zone,
    daily_plan_minor: BigInt(row.daily_plan_minor),
    responsible_person: {
      name: row.responsible_name,
      email: row.responsible_email,
    },
    activated_at: row.activated_at.toISOString(),
    last_accepted_at: row.last_accepted_at?.toISOString() ?? null,
  };
}
export class PostgresOutletRepository implements OutletRepository {
  constructor(private readonly manager: EntityManager) {}
  async findForUpdate(outletId: string): Promise<Outlet | null> {
    const rows: OutletRow[] = await this.manager.query(
      'SELECT * FROM outlets WHERE outlet_id=$1 FOR UPDATE',
      [outletId],
    );
    return rows[0] === undefined ? null : mapOutlet(rows[0]);
  }
  async updateSettings(
    outletId: string,
    patch: OutletSettingsPatch,
  ): Promise<Outlet | null> {
    const rows: OutletRow[] = await this.manager.query(
      `WITH updated AS (UPDATE outlets SET
      daily_plan_minor=COALESCE($2::bigint,daily_plan_minor),
      responsible_name=COALESCE($3::text,responsible_name), responsible_email=COALESCE($4::text,responsible_email)
      WHERE outlet_id=$1 RETURNING *) SELECT * FROM updated`,
      [
        outletId,
        patch.daily_plan_minor?.toString() ?? null,
        patch.responsible_person?.name ?? null,
        patch.responsible_person?.email ?? null,
      ],
    );
    return rows[0] === undefined ? null : mapOutlet(rows[0]);
  }
}
