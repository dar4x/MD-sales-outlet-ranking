/* External deps */
import { DataSource } from 'typeorm';
/* Internal deps */
import dataSource from '../src/database/data-source.js';
import { assertTestDatabase } from './test-database.js';

assertTestDatabase();
if (dataSource.options.type !== 'postgres') {
  throw new Error('Test setup requires PostgreSQL.');
}
const maintenance = new DataSource({
  ...dataSource.options,
  database: 'postgres',
});
await maintenance.initialize();
try {
  const databases: { datname: string }[] = await maintenance.query(
    'SELECT datname FROM pg_database WHERE datname = $1',
    ['sales_ranking_test'],
  );
  if (databases.length === 0) {
    await maintenance.query('CREATE DATABASE sales_ranking_test');
  }
} finally {
  await maintenance.destroy();
}
await dataSource.initialize();
try {
  await dataSource.runMigrations();
  console.log('sales_ranking_test migrations applied');
} finally {
  await dataSource.destroy();
}
