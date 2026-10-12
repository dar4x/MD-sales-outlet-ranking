/* External deps */
import type { ConfigService } from '@nestjs/config';
import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';

/* Internal deps */
import type { EnvironmentVariables } from '../config/environment.validation.js';

export function createDatabaseOptions(
  config: ConfigService<EnvironmentVariables, true>,
): DataSourceOptions {
  return {
    type: 'postgres',
    host: config.get('POSTGRES_HOST', { infer: true }),
    port: config.get('POSTGRES_PORT', { infer: true }),
    username: config.get('POSTGRES_USER', { infer: true }),
    password: config.get('POSTGRES_PASSWORD', { infer: true }),
    database: config.get('POSTGRES_DB', { infer: true }),
    synchronize: false,
    migrationsRun: false,
    entities: [join(import.meta.dirname, '../**/*.entity.js')],
    migrations: [join(import.meta.dirname, 'migrations/*.js')],
  };
}
