import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import 'reflect-metadata';
import { AppModule } from '../src/app.module.js';
import { configureApplication } from '../src/configure-application.js';
import { BISHKEK_OUTLET_ID } from './seed-data.js';
import { assertTestDatabase } from './test-database.js';
assertTestDatabase();
let app: INestApplication;
let url: string;
let original: Record<string, unknown>;
async function patch(body: unknown, id = BISHKEK_OUTLET_ID) {
  return fetch(url + '/api/outlets/' + id + '/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
await describe('Outlet details and settings HTTP', async () => {
  before(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    configureApplication(app);
    await app.listen(0, '127.0.0.1');
    url = await app.getUrl();
    original = (await (
      await fetch(url + '/api/outlets/' + BISHKEK_OUTLET_ID + '/settings')
    ).json()) as Record<string, unknown>;
  });
  after(async () => {
    await patch({
      daily_plan_minor: original.daily_plan_minor,
      responsible_person: original.responsible_person,
    });
    await app.close();
  });
  await it('updates supplied fields only, encodes money exactly and changes card plan', async () => {
    let response = await patch({ daily_plan_minor: '9007199254740993' });
    assert.equal(response.status, 200);
    let settings = (await response.json()) as Record<string, unknown>;
    assert.equal(settings.daily_plan_minor, '9007199254740993');
    assert.deepEqual(settings.responsible_person, original.responsible_person);
    response = await patch({
      responsible_person: { name: 'New Manager', email: 'new@example.com' },
    });
    assert.equal(response.status, 200);
    settings = (await response.json()) as Record<string, unknown>;
    assert.equal(settings.daily_plan_minor, '9007199254740993');
    assert.deepEqual(settings.responsible_person, {
      name: 'New Manager',
      email: 'new@example.com',
    });
    const card = (await (
      await fetch(
        url + '/api/outlets/' + BISHKEK_OUTLET_ID + '/card?window=hour',
      )
    ).json()) as {
      settings: Record<string, unknown>;
      today_plan: Record<string, unknown>;
      series: unknown[];
    };
    assert.deepEqual(card.settings, settings);
    assert.equal(card.today_plan.daily_plan_minor, '9007199254740993');
    assert.equal(card.series.length, 12);
  });
  await it('rejects invalid settings and card inputs, and distinguishes absent outlets', async () => {
    for (const body of [
      {},
      [],
      null,
      { extra: 1 },
      { daily_plan_minor: '0' },
      { daily_plan_minor: 1 },
      { daily_plan_minor: '9223372036854775808' },
      { daily_plan_minor: null },
      { responsible_person: { name: '', email: 'bad' } },
      {
        responsible_person: { name: 'Name', email: 'ok@example.com', extra: 1 },
      },
      { responsible_person: [] },
      { responsible_person: { name: '   ', email: 'ok@example.com' } },
    ]) {
      assert.equal((await patch(body)).status, 422, JSON.stringify(body));
    }
    assert.equal(
      (await patch({ daily_plan_minor: '1' }, randomUUID())).status,
      404,
    );
    assert.equal(
      (await fetch(url + '/api/outlets/' + randomUUID() + '/card')).status,
      404,
    );
    assert.equal((await fetch(url + '/api/outlets/bad/card')).status, 422);
    assert.equal(
      (
        await fetch(
          url + '/api/outlets/' + BISHKEK_OUTLET_ID + '/card?window=bad',
        )
      ).status,
      422,
    );
    assert.equal(
      (await fetch(url + '/api/outlets/' + BISHKEK_OUTLET_ID + '/card')).status,
      200,
    );
  });
});
