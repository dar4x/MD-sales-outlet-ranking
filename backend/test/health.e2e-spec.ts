import { assertTestDatabase } from './test-database.js';
assertTestDatabase();
/* External deps */
import { NestFactory } from '@nestjs/core';
import assert from 'node:assert/strict';
import test from 'node:test';
import 'reflect-metadata';
/* Internal deps */
import { AppModule } from '../src/app.module.js';
import { configureApplication } from '../src/configure-application.js';

await test('GET /api/health checks the real PostgreSQL connection', async (context) => {
  const app = await NestFactory.create(AppModule, { logger: false });
  context.after(() => app.close());
  configureApplication(app);
  await app.listen(0, '127.0.0.1');
  const response = await fetch(`${await app.getUrl()}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok', database: 'up' });
});
