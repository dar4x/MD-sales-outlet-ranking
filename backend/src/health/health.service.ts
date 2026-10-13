/* External deps */
import { Injectable, ServiceUnavailableException } from '@nestjs/common';

/* Internal deps */
import { DatabaseHealthQuery } from './database-health.query.js';
import type { HealthResponse } from './health.types.js';

@Injectable()
export class HealthService {
  constructor(private readonly databaseHealthQuery: DatabaseHealthQuery) {}

  async getHealth(): Promise<HealthResponse> {
    try {
      await this.databaseHealthQuery.checkConnection();
      return { status: 'ok', database: 'up' };
    } catch {
      throw new ServiceUnavailableException('Database unavailable');
    }
  }
}
