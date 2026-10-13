import { assertTestDatabase } from './test-database.js';
assertTestDatabase();
/* External deps */
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import 'reflect-metadata';

/* Internal deps */
import { AppModule } from '../src/app.module.js';
import { configureApplication } from '../src/configure-application.js';
import { IngestEvent } from '../src/events/application/ingest-event.js';
import {
  BISHKEK_OUTLET_ID,
  BREAD_PRODUCT_ID,
  MILK_PRODUCT_ID,
} from './seed-data.js';

// Real HTTP against the whole application. Requires a running PostgreSQL
// with migrations applied; run with POSTGRES_DB pointing at a test database.
let app: INestApplication;
let eventsUrl = '';

function buildSaleBody(eventId: string): Record<string, unknown> {
  return {
    kind: 'sale',
    event_id: eventId,
    receipt_id: randomUUID(),
    outlet_id: BISHKEK_OUTLET_ID,
    occurred_at: '2026-10-13T12:00:00+06:00',
    lines: [
      {
        sale_line_id: randomUUID(),
        product_id: BREAD_PRODUCT_ID,
        quantity: 2,
        unit_price_minor: '4500',
        line_amount_minor: '9000',
      },
      {
        sale_line_id: randomUUID(),
        product_id: MILK_PRODUCT_ID,
        quantity: 1,
        unit_price_minor: '9000',
        line_amount_minor: '9000',
      },
    ],
  };
}

async function postEvent(
  body: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const response = await fetch(eventsUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await response.json()) as Record<string, unknown>;
  return { status: response.status, json };
}

await describe('POST /api/events', async () => {
  before(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    configureApplication(app);
    await app.listen(0, '127.0.0.1');
    eventsUrl = `${await app.getUrl()}/api/events`;
  });
  after(() => app.close());

  await it('returns 201 and the acceptance for a new sale', async () => {
    const body = buildSaleBody(randomUUID());

    const { status, json } = await postEvent(body);

    assert.equal(status, 201);
    assert.equal(json.event_id, body.event_id);
    assert.equal(json.outlet_id, BISHKEK_OUTLET_ID);
    assert.equal(json.kind, 'sale');
    assert.equal(json.amount_minor, '18000');
    assert.equal(json.duplicate, false);
    assert.match(String(json.accepted_at), /^\d{4}-\d{2}-\d{2}T.*Z$/);
    assert.deepEqual(Object.keys(json).sort(), [
      'accepted_at',
      'amount_minor',
      'duplicate',
      'event_id',
      'kind',
      'outlet_id',
    ]);
  });

  await it('returns 200 with the original acceptance for an identical retry', async () => {
    const body = buildSaleBody(randomUUID());
    const first = await postEvent(body);

    const retry = await postEvent(body);

    assert.equal(retry.status, 200);
    assert.deepEqual(retry.json, { ...first.json, duplicate: true });
  });

  await it('returns 409 event_conflict for a changed payload', async () => {
    const body = buildSaleBody(randomUUID());
    await postEvent(body);

    const { status, json } = await postEvent({
      ...body,
      occurred_at: '2026-10-13T13:00:00+06:00',
    });

    assert.equal(status, 409);
    assert.equal(json.code, 'event_conflict');
    assert.equal(typeof json.message, 'string');
  });

  await it('returns 409 receipt_conflict for a reused receipt_id', async () => {
    const body = buildSaleBody(randomUUID());
    await postEvent(body);

    const { status, json } = await postEvent({
      ...buildSaleBody(randomUUID()),
      receipt_id: body.receipt_id,
    });

    assert.equal(status, 409);
    assert.equal(json.code, 'receipt_conflict');
  });

  await it('returns 422 invalid_request with details for a bad body', async () => {
    const { status, json } = await postEvent({
      ...buildSaleBody(randomUUID()),
      occurred_at: '2026-10-13T12:00:00',
      unexpected: true,
    });

    assert.equal(status, 422);
    assert.equal(json.code, 'invalid_request');
    const details = json.details as string[];
    assert.ok(details.some((detail) => detail.startsWith('occurred_at:')));
    assert.ok(details.some((detail) => detail.startsWith('unexpected:')));
  });

  await it('returns 422 for business rule failures', async () => {
    const body = buildSaleBody(randomUUID());
    const lines = body.lines as Record<string, unknown>[];
    lines[0] = { ...lines[0], line_amount_minor: '9001' };

    const { status, json } = await postEvent(body);

    assert.equal(status, 422);
    assert.deepEqual(Object.keys(json).sort(), ['code', 'message']);
    assert.equal(json.code, 'line_amount_mismatch');
  });

  await it('returns 422 invalid_request for malformed returns', async () => {
    const { status, json } = await postEvent({ kind: 'return' });

    assert.equal(status, 422);
    assert.equal(json.code, 'invalid_request');
  });

  await it('returns 422 for an unknown outlet or product', async () => {
    const unknownOutlet = await postEvent({
      ...buildSaleBody(randomUUID()),
      outlet_id: randomUUID(),
    });
    const productBody = buildSaleBody(randomUUID());
    const lines = productBody.lines as Record<string, unknown>[];
    lines[1] = { ...lines[1], product_id: randomUUID() };
    const unknownProduct = await postEvent(productBody);

    assert.equal(unknownOutlet.status, 422);
    assert.equal(unknownOutlet.json.code, 'unknown_outlet');
    assert.equal(unknownProduct.status, 422);
    assert.equal(unknownProduct.json.code, 'unknown_product');
  });

  await it('returns 400 for malformed JSON', async () => {
    const response = await fetch(eventsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"kind": "sale",',
    });

    assert.equal(response.status, 400);
  });

  await it('answers 10 parallel identical requests with one 201 and nine 200', async () => {
    const body = buildSaleBody(randomUUID());

    const calls = [];
    for (let index = 0; index < 10; index += 1) {
      calls.push(postEvent(body));
    }
    const responses = await Promise.all(calls);

    let createdCount = 0;
    let retryCount = 0;
    for (const response of responses) {
      if (response.status === 201) {
        createdCount += 1;
      } else if (response.status === 200) {
        retryCount += 1;
      }
    }
    assert.equal(createdCount, 1);
    assert.equal(retryCount, 9);
  });
  await it('returns 422 for an array used as a sale line', async () => {
    const body = buildSaleBody(randomUUID());
    const result = await postEvent({ ...body, lines: [body.lines] });
    assert.equal(result.status, 422);
    assert.equal(result.json.code, 'invalid_request');
  });
  await it('returns 422 timestamp_precision for sub-millisecond input', async () => {
    const result = await postEvent({
      ...buildSaleBody(randomUUID()),
      occurred_at: '2026-10-13T06:00:00.0001Z',
    });
    assert.equal(result.status, 422);
    assert.equal(result.json.code, 'timestamp_precision');
  });
  await it('returns the original acceptance when UUID casing changes', async () => {
    const body = buildSaleBody(randomUUID());
    const first = await postEvent(body);
    const lines = body.lines as Record<string, unknown>[];
    const retry = await postEvent({
      ...body,
      event_id: String(body.event_id).toUpperCase(),
      receipt_id: String(body.receipt_id).toUpperCase(),
      outlet_id: String(body.outlet_id).toUpperCase(),
      lines: lines.map((line) => ({
        ...line,
        sale_line_id: String(line.sale_line_id).toUpperCase(),
        product_id: String(line.product_id).toUpperCase(),
      })),
    });
    assert.equal(first.status, 201);
    assert.equal(retry.status, 200);
    assert.deepEqual(retry.json, { ...first.json, duplicate: true });
  });

  await it('returns 422 for sale line IDs differing only in UUID casing', async () => {
    const body = buildSaleBody(randomUUID());
    const lines = body.lines as Record<string, unknown>[];
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const result = await postEvent({
      ...body,
      lines: [
        { ...lines[0], sale_line_id: id },
        { ...lines[1], sale_line_id: id.toUpperCase() },
      ],
    });
    assert.equal(result.status, 422);
    assert.equal(result.json.code, 'duplicate_line_id');
  });
  await it('sanitizes database connection failures as 503', async () => {
    const ingest = app.get(IngestEvent);
    const originalExecute = ingest.execute.bind(ingest);
    const failures = [
      Object.assign(new Error('private host and credentials'), {
        code: 'ECONNREFUSED',
      }),
      Object.assign(new Error('private SQL'), {
        driverError: { code: '08006' },
      }),
      Object.assign(new Error('private server'), { code: '57P01' }),
      new Error('Connection terminated unexpectedly'),
    ];
    try {
      for (const failure of failures) {
        ingest.execute = () => Promise.reject(failure);
        const response = await postEvent(buildSaleBody(randomUUID()));
        assert.equal(response.status, 503);
        assert.deepEqual(response.json, {
          code: 'database_unavailable',
          message: 'Database connection is unavailable.',
        });
      }
    } finally {
      ingest.execute = originalExecute;
    }
  });

  await it('does not mislabel other SQL or application errors as 503', async () => {
    const ingest = app.get(IngestEvent);
    const originalExecute = ingest.execute.bind(ingest);
    try {
      for (const failure of [
        Object.assign(new Error('private SQL'), {
          driverError: { code: '23505' },
        }),
        Object.assign(new Error('missing table'), { code: '42P01' }),
        new Error('private application details'),
      ]) {
        ingest.execute = () => Promise.reject(failure);
        const response = await postEvent(buildSaleBody(randomUUID()));
        assert.equal(response.status, 500);
        assert.deepEqual(response.json, {
          statusCode: 500,
          message: 'Internal server error',
        });
      }
    } finally {
      ingest.execute = originalExecute;
    }
  });
});
