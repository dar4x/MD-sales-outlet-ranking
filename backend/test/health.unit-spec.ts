import assert from 'node:assert/strict';
import test from 'node:test';
import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DatabaseHealthQuery } from '../src/health/database-health.query.js';
import { HealthService } from '../src/health/health.service.js';

await test('health retains its success response', async (context) => {
  const query = new DatabaseHealthQuery(new DataSource({ type: 'postgres' }));
  context.mock.method(query, 'checkConnection', async () => {});
  assert.deepEqual(await new HealthService(query).getHealth(), {
    status: 'ok',
    database: 'up',
  });
});

await test('health sanitizes database failures with HTTP 503', async (context) => {
  const query = new DatabaseHealthQuery(new DataSource({ type: 'postgres' }));
  context.mock.method(query, 'checkConnection', () =>
    Promise.reject(new Error('Private driver connection details')),
  );
  await assert.rejects(
    new HealthService(query).getHealth(),
    (error: unknown) => {
      assert.ok(error instanceof ServiceUnavailableException);
      assert.equal(error.getStatus(), 503);
      assert.deepEqual(error.getResponse(), {
        statusCode: 503,
        message: 'Database unavailable',
        error: 'Service Unavailable',
      });
      return true;
    },
  );
});
