import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import 'reflect-metadata';
import { configureApplication } from '../src/configure-application.js';
import { EvaluateStaleAlerts } from '../src/alerts/application/evaluate-stale-alerts.js';
import { PostgresAlertEvaluationQuery } from '../src/alerts/infrastructure/postgres-alert-evaluation.query.js';
import { PostgresTransactionRunner } from '../src/shared/infrastructure/postgres-transaction-runner.js';
import { SystemClock } from '../src/shared/infrastructure/system-clock.js';
import type { RankingRefreshRequester } from '../src/rankings/application/ports/ranking-ports.js';
import type { RankingSnapshot } from '../src/rankings/application/read-models/ranking.js';
import { DispatchOutbox } from '../src/notifications/application/dispatch-outbox.js';
import {
  connect,
  acknowledge,
  waitForSnapshots,
} from './ranking-socket-client.js';
import { BISHKEK_OUTLET_ID, BREAD_PRODUCT_ID } from './seed-data.js';
import { assertTestDatabase } from './test-database.js';
assertTestDatabase();
process.env.ALERT_EVALUATION_INTERVAL_MS = '60000';
process.env.OUTBOX_POLL_INTERVAL_MS = '60000';
process.env.REALTIME_COALESCE_MS = '20';
const { RANKING_REFRESH_REQUESTER } =
  await import('../src/rankings/rankings.module.js');
const { AppModule } = await import('../src/app.module.js');
let app: INestApplication;
let db: DataSource;
let url: string;
let original: Record<string, unknown>;
const outletId = randomUUID();
const outletName = 'Flow ' + outletId;
async function post(body: unknown) {
  return fetch(url + '/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
async function patch(id: string, body: unknown) {
  return fetch(url + '/api/outlets/' + id + '/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
await describe('Complete backend transport integration', async () => {
  before(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    configureApplication(app);
    await app.listen(0, '127.0.0.1');
    url = await app.getUrl();
    db = app.get(DataSource);
    assertTestDatabase(String(db.options.database));
    original = (await (
      await fetch(url + '/api/outlets/' + BISHKEK_OUTLET_ID + '/settings')
    ).json()) as Record<string, unknown>;
    await db.query(
      'TRUNCATE outbox_jobs,alert_episodes,midday_assessments,return_lines,return_events,sale_lines,sale_receipts,accepted_events',
    );
    await db.query(
      'INSERT INTO outlets(outlet_id,name,time_zone,daily_plan_minor,responsible_name,responsible_email,activated_at) ' +
        "VALUES($1,$2,'UTC',1000,'Original contact','captured-flow@example.com',$3)",
      [outletId, outletName, new Date(Date.now() - 600000).toISOString()],
    );
  });
  after(async () => {
    await patch(BISHKEK_OUTLET_ID, {
      daily_plan_minor: original.daily_plan_minor,
      responsible_person: original.responsible_person,
    });
    await db.query(
      'TRUNCATE outbox_jobs,alert_episodes,midday_assessments,return_lines,return_events,sale_lines,sale_receipts,accepted_events',
    );
    await db.query('DELETE FROM outlets WHERE outlet_id=$1', [outletId]);
    await app.close();
  });
  await it('integrates return net metrics, settings, stale flags, HTTP alerts, two sockets and captured Mailpit delivery', async () => {
    const first = await connect(url);
    const second = await connect(url);
    const firstSnapshots: RankingSnapshot[] = [];
    const secondSnapshots: RankingSnapshot[] = [];
    first.on('rankings.snapshot', (snapshot: RankingSnapshot) => {
      firstSnapshots.push(snapshot);
    });
    second.on('rankings.snapshot', (snapshot: RankingSnapshot) => {
      secondSnapshots.push(snapshot);
    });
    try {
      await acknowledge(first, 'rankings.subscribe', { window: 'hour' });
      await acknowledge(second, 'rankings.subscribe', { window: 'hour' });
      await waitForSnapshots(firstSnapshots, 1);
      await waitForSnapshots(secondSnapshots, 1);
      const receiptId = randomUUID();
      const lineId = randomUUID();
      assert.equal(
        (
          await post({
            kind: 'sale',
            event_id: randomUUID(),
            receipt_id: receiptId,
            outlet_id: BISHKEK_OUTLET_ID,
            occurred_at: new Date(Date.now() - 2000).toISOString(),
            lines: [
              {
                sale_line_id: lineId,
                product_id: BREAD_PRODUCT_ID,
                quantity: 3,
                unit_price_minor: '101',
                line_amount_minor: '303',
              },
            ],
          })
        ).status,
        201,
      );
      await waitForSnapshots(firstSnapshots, 2);
      await waitForSnapshots(secondSnapshots, 2);
      const refund = {
        kind: 'return',
        event_id: randomUUID(),
        outlet_id: BISHKEK_OUTLET_ID,
        sale_receipt_id: receiptId,
        occurred_at: new Date(Date.now() - 1000).toISOString(),
        lines: [
          { return_line_id: randomUUID(), sale_line_id: lineId, quantity: 1 },
        ],
      };
      const accepted = await post(refund);
      assert.equal(accepted.status, 201);
      assert.equal(
        ((await accepted.json()) as { amount_minor: string }).amount_minor,
        '101',
      );
      await waitForSnapshots(firstSnapshots, 3);
      await waitForSnapshots(secondSnapshots, 3);
      assert.deepEqual(firstSnapshots.at(-1), secondSnapshots.at(-1));
      const row = firstSnapshots
        .at(-1)!
        .rows.find((row) => row.outlet_id === BISHKEK_OUTLET_ID)!;
      assert.equal(row.net_revenue_minor, '202');
      assert.equal(row.receipt_count, 1);
      assert.equal((await post(refund)).status, 200);
      assert.equal(
        (await patch(BISHKEK_OUTLET_ID, { daily_plan_minor: '1000' })).status,
        200,
      );
      await waitForSnapshots(firstSnapshots, 4);
      const card = (await (
        await fetch(
          url + '/api/outlets/' + BISHKEK_OUTLET_ID + '/card?window=hour',
        )
      ).json()) as {
        metrics: { net_revenue_minor: string };
        today_plan: { progress_bps: number };
      };
      assert.equal(card.metrics.net_revenue_minor, '202');
      assert.equal(card.today_plan.progress_bps, 2020);
      const query = new PostgresAlertEvaluationQuery(db);
      const evaluate = new EvaluateStaleAlerts(
        new PostgresTransactionRunner(db),
        {
          list: (asOf) => query.list(asOf, outletId),
          missedNoons: (asOf) => query.missedNoons(asOf),
        },
        new SystemClock(),
        300,
        app.get<RankingRefreshRequester>(RANKING_REFRESH_REQUESTER),
      );
      const count = firstSnapshots.length;
      await evaluate.execute();
      await waitForSnapshots(firstSnapshots, count + 1);
      await waitForSnapshots(secondSnapshots, count + 1);
      assert.equal(
        firstSnapshots.at(-1)!.rows.find((row) => row.outlet_id === outletId)!
          .stale,
        true,
      );
      assert.deepEqual(firstSnapshots.at(-1), secondSnapshots.at(-1));
      const alerts = (await (
        await fetch(url + '/api/alerts?outlet_id=' + outletId)
      ).json()) as {
        items: { kind: string; facts: { recipient: { email: string } } }[];
      };
      assert.equal(alerts.items.length, 1);
      assert.equal(alerts.items[0]!.kind, 'stale');
      assert.equal(
        alerts.items[0]!.facts.recipient.email,
        'captured-flow@example.com',
      );
      assert.equal(
        (
          await patch(outletId, {
            responsible_person: {
              name: 'Changed',
              email: 'changed@example.com',
            },
          })
        ).status,
        200,
      );
      await app.get(DispatchOutbox).execute();
      await evaluate.execute();
      const jobs: { status: string; recipient: string }[] = await db.query(
        "SELECT j.status,j.message->>'recipient' AS recipient FROM outbox_jobs j JOIN alert_episodes a USING(episode_id) WHERE a.outlet_id=$1",
        [outletId],
      );
      assert.deepEqual(jobs, [
        { status: 'sent', recipient: 'captured-flow@example.com' },
      ]);
      const mailbox = (await (
        await fetch('http://127.0.0.1:8025/api/v1/messages')
      ).json()) as {
        messages: { Subject: string; To: { Address: string }[] }[];
      };
      const message = mailbox.messages.find(
        (message) => message.Subject === 'Inactive outlet: ' + outletName,
      );
      assert.ok(message);
      assert.equal(message.To[0]!.Address, 'captured-flow@example.com');
      assert.equal(
        (await fetch(url + '/api/alerts?active_only=bad')).status,
        422,
      );
      assert.equal(
        (await fetch(url + '/api/alerts?outlet_id=bad')).status,
        422,
      );
      const current = (await (
        await fetch(url + '/api/rankings?window=hour')
      ).json()) as RankingSnapshot;
      assert.deepEqual(
        current.rows,
        firstSnapshots.at(-1)!.rows.map((row) => ({
          ...row,
          ends_at: current.as_of,
          starts_at: new Date(
            Date.parse(current.as_of) - 3600000,
          ).toISOString(),
        })),
      );
    } finally {
      first.close();
      second.close();
    }
  });
});
