/* External deps */
import type { DataSource } from 'typeorm';
/* Internal deps */
import type { OutletSettings } from '../domain/outlet.js';
import type { OutletQuery } from '../application/ports/outlet-repositories.js';
import type { OutletSummary } from '../application/read-models/outlet-card.js';

export class PostgresOutletQuery implements OutletQuery {
  constructor(private readonly dataSource: DataSource) {}

  list(): Promise<OutletSummary[]> {
    return this.dataSource.query(
      'SELECT outlet_id, name, time_zone FROM outlets ORDER BY outlet_id',
    );
  }
  async settings(outletId: string): Promise<OutletSettings | null> {
    const rows: {
      outlet_id: string;
      daily_plan_minor: string;
      responsible_name: string;
      responsible_email: string;
    }[] = await this.dataSource.query(
      'SELECT outlet_id,daily_plan_minor,responsible_name,responsible_email FROM outlets WHERE outlet_id=$1',
      [outletId],
    );
    const row = rows[0];
    if (row === undefined) return null;
    return {
      outlet_id: row.outlet_id,
      daily_plan_minor: BigInt(row.daily_plan_minor),
      responsible_person: {
        name: row.responsible_name,
        email: row.responsible_email,
      },
    };
  }
}
