/* External deps */
import type { DataSource } from 'typeorm';
/* Internal deps */
import type { OutletQuery } from '../application/ports/outlet-repositories.js';
import type { OutletSummary } from '../application/read-models/outlet-card.js';

export class PostgresOutletQuery implements OutletQuery {
  constructor(private readonly dataSource: DataSource) {}

  list(): Promise<OutletSummary[]> {
    return this.dataSource.query(
      'SELECT outlet_id, name, time_zone FROM outlets ORDER BY outlet_id',
    );
  }
}
