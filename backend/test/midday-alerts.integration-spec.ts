import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';
import dataSource from '../src/database/data-source.js';
import { EvaluateMiddayAlerts } from '../src/alerts/application/evaluate-midday-alerts.js';
import { PostgresAlertEvaluationQuery } from '../src/alerts/infrastructure/postgres-alert-evaluation.query.js';
import { PostgresTransactionRunner } from '../src/shared/infrastructure/postgres-transaction-runner.js';
import { IngestEvent } from '../src/events/application/ingest-event.js';
import { PostgresRankingQuery } from '../src/rankings/infrastructure/postgres-ranking.query.js';
import { BREAD_PRODUCT_ID } from './seed-data.js';
import { assertTestDatabase } from './test-database.js';
assertTestDatabase();
const outletId = randomUUID();
const runner = new PostgresTransactionRunner(dataSource);
const query = new PostgresAlertEvaluationQuery(dataSource);
const evaluate = new EvaluateMiddayAlerts(
  runner,
  query,
  { now: () => '2026-03-29T10:00:00Z' },
  { request: () => {} },
);
async function sale(amount: bigint, time = '2026-03-29T09:59:59Z') {
  const input = {
    kind: 'sale' as const,
    event_id: randomUUID(),
    receipt_id: randomUUID(),
    outlet_id: outletId,
    occurred_at: time,
    lines: [
      {
        sale_line_id: randomUUID(),
        product_id: BREAD_PRODUCT_ID,
        quantity: 1,
        unit_price_minor: amount,
        line_amount_minor: amount,
      },
    ],
  };
  await new IngestEvent(
    runner,
    { now: () => '2026-03-29T10:01:00Z' },
    { request: () => {} },
  ).execute(input);
  return input;
}
async function assessments() {
  return dataSource.query<
    {
      local_date: string;
      net_revenue_minor: string;
      daily_plan_minor: string;
      behind_plan: boolean;
    }[]
  >(
    'SELECT local_date::text,net_revenue_minor,daily_plan_minor,behind_plan FROM midday_assessments WHERE outlet_id=$1 ORDER BY local_date',
    [outletId],
  );
}
await describe('Civil-noon assessments', async () => {
  before(async () => {
    await dataSource.initialize();
    await dataSource.query(
      `INSERT INTO outlets(outlet_id,name,time_zone,daily_plan_minor,responsible_name,responsible_email,activated_at)
    VALUES($1,$2,'Europe/Berlin',1000,'Noon Manager','noon@example.com','2026-03-29T00:00:00Z')`,
      [outletId, 'Noon ' + outletId],
    );
  });
  after(async () => {
    await dataSource.query(
      'TRUNCATE outbox_jobs,alert_episodes,midday_assessments,return_lines,return_events,sale_lines,sale_receipts,accepted_events',
    );
    await dataSource.query('DELETE FROM outlets WHERE outlet_id=$1', [
      outletId,
    ]);
    await dataSource.destroy();
  });
  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE outbox_jobs,alert_episodes,midday_assessments,return_lines,return_events,sale_lines,sale_receipts,accepted_events',
    );
    await dataSource.query(
      "UPDATE outlets SET activated_at='2026-03-29T00:00:00Z',time_zone='Europe/Berlin',daily_plan_minor=1000,last_accepted_at=NULL WHERE outlet_id=$1",
      [outletId],
    );
  });
  await it('assesses only at local noon, uses strict equality and freezes passing decisions against late facts/settings', async () => {
    await sale(500n);
    await evaluate.execute('2026-03-29T09:59:59.999Z');
    assert.equal((await assessments()).length, 0);
    await Promise.all([evaluate.execute(), evaluate.execute()]);
    assert.deepEqual(
      (await assessments()).map((row) => row.behind_plan),
      [false],
    );
    await dataSource.query(
      'UPDATE outlets SET daily_plan_minor=1000000 WHERE outlet_id=$1',
      [outletId],
    );
    await sale(999n, '2026-03-29T08:00:00Z');
    await evaluate.execute('2026-03-29T11:00:00Z');
    assert.deepEqual(await assessments(), [
      {
        local_date: '2026-03-29',
        net_revenue_minor: '500',
        daily_plan_minor: '1000',
        behind_plan: false,
      },
    ]);
  });
  await it('subtracts refunds at their own noon-window time and expires at DST-aware midnight', async () => {
    const input = await sale(600n, '2026-03-29T09:00:00Z');
    await new IngestEvent(
      runner,
      { now: () => '2026-03-29T10:01:00Z' },
      { request: () => {} },
    ).execute({
      kind: 'return',
      event_id: randomUUID(),
      outlet_id: outletId,
      sale_receipt_id: input.receipt_id,
      occurred_at: '2026-03-29T09:30:00Z',
      lines: [
        {
          return_line_id: randomUUID(),
          sale_line_id: input.lines[0]!.sale_line_id,
          quantity: 1,
        },
      ],
    });
    await evaluate.execute();
    assert.equal((await assessments())[0]!.net_revenue_minor, '0');
    assert.equal((await assessments())[0]!.behind_plan, true);
    const ranking = new PostgresRankingQuery(dataSource, 'KGS');
    assert.equal(
      (await ranking.get('business_day', '2026-03-29T21:59:59Z')).rows.find(
        (row) => row.outlet_id === outletId,
      )!.behind_plan,
      true,
    );
    await evaluate.execute('2026-03-29T22:00:00Z');
    assert.equal(
      (await ranking.get('business_day', '2026-03-29T22:00:00Z')).rows.find(
        (row) => row.outlet_id === outletId,
      )!.behind_plan,
      false,
    );
    const rows: { resolved_at: Date }[] = await dataSource.query(
      "SELECT resolved_at FROM alert_episodes WHERE outlet_id=$1 AND kind='behind_plan'",
      [outletId],
    );
    assert.equal(
      rows[0]!.resolved_at.toISOString(),
      '2026-03-29T22:00:00.000Z',
    );
  });
  await it('catches up every missed date after restart once and captures recipients and plans', async () => {
    await dataSource.query(
      "UPDATE outlets SET activated_at='2026-03-27T00:00:00Z' WHERE outlet_id=$1",
      [outletId],
    );
    await evaluate.execute('2026-03-29T11:00:00Z');
    assert.equal((await assessments()).length, 3);
    await new EvaluateMiddayAlerts(
      runner,
      query,
      { now: () => '2026-03-29T12:00:00Z' },
      { request: () => {} },
    ).execute();
    const jobs: { count: string }[] = await dataSource.query(
      'SELECT count(*) FROM outbox_jobs j JOIN alert_episodes a USING(episode_id) WHERE a.outlet_id=$1',
      [outletId],
    );
    assert.equal(jobs[0]!.count, '3');
    const rows = await query.list(
      '2026-03-29T11:00:00Z',
      outletId,
      '2026-03-29',
    );
    assert.equal(rows[0]!.cutoff_at, '2026-03-29T10:00:00.000Z');
    await dataSource.query(
      "UPDATE outlets SET time_zone='Asia/Bishkek' WHERE outlet_id=$1",
      [outletId],
    );
    assert.equal(
      (await query.list('2026-03-29T11:00:00Z', outletId))[0]!.cutoff_at,
      '2026-03-29T06:00:00.000Z',
    );
  });
  await it('excludes exactly-noon events and rolls assessment and episode back if notification insertion fails', async () => {
    await sale(1000n, '2026-03-29T10:00:00Z');
    const failing = new EvaluateMiddayAlerts(
      {
        run: (operation) =>
          runner.run(async (ports) => {
            ports.outbox.insert = () =>
              Promise.reject(new Error('no notification'));
            return operation(ports);
          }),
      },
      query,
      { now: () => '2026-03-29T10:00:00Z' },
      { request: () => {} },
    );
    await assert.rejects(failing.execute(), /no notification/);
    assert.equal((await assessments()).length, 0);
    await evaluate.execute();
    assert.equal((await assessments())[0]!.net_revenue_minor, '0');
  });
});
