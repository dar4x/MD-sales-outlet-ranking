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
await it('GET /api/products returns the persisted catalogue with decimal-string prices', async () => {
  const app = await NestFactory.create(AppModule, { logger: false });
  try {
    configureApplication(app);
    await app.listen(0, '127.0.0.1');
    const response = await fetch((await app.getUrl()) + '/api/products');
    assert.equal(response.status, 200);
    const expected: unknown[] = await app
      .get(DataSource)
      .query(
        'SELECT product_id, sku, name, unit_price_minor::text FROM products ORDER BY product_id',
      );
    assert.deepEqual(await response.json(), { items: expected });
    assert.ok(expected.length > 0);
  } finally {
    await app.close();
  }
});
