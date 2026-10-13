/* External deps */
import { NestFactory } from '@nestjs/core';
import assert from 'node:assert/strict';
import { it } from 'node:test';
import { DataSource } from 'typeorm';
import 'reflect-metadata';
/* Internal deps */
import { AppModule } from '../src/app.module.js';
import { configureApplication } from '../src/configure-application.js';
import { assertTestDatabase } from './test-database.js';

assertTestDatabase();
await it('GET /api/outlets returns only persisted outlet identities and zones', async () => {
  const app = await NestFactory.create(AppModule, { logger: false });
  try {
    configureApplication(app);
    await app.listen(0, '127.0.0.1');
    const response = await fetch((await app.getUrl()) + '/api/outlets');
    assert.equal(response.status, 200);
    const expected: unknown[] = await app
      .get(DataSource)
      .query(
        'SELECT outlet_id, name, time_zone FROM outlets ORDER BY outlet_id',
      );
    assert.deepEqual(await response.json(), { items: expected });
    assert.ok(expected.length > 0);
  } finally {
    await app.close();
  }
});
