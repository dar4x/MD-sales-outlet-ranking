import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';
import dataSource from '../src/database/data-source.js';
import { EvaluateStaleAlerts } from '../src/alerts/application/evaluate-stale-alerts.js';
import { PostgresAlertEvaluationQuery } from '../src/alerts/infrastructure/postgres-alert-evaluation.query.js';
import { PostgresTransactionRunner } from '../src/shared/infrastructure/postgres-transaction-runner.js';
import { IngestEvent } from '../src/events/application/ingest-event.js';
import { PostgresRankingQuery } from '../src/rankings/infrastructure/postgres-ranking.query.js';
import { BISHKEK_OUTLET_ID, BREAD_PRODUCT_ID } from './seed-data.js';
import { assertTestDatabase } from './test-database.js';
assertTestDatabase();
const runner = new PostgresTransactionRunner(dataSource);
const evaluate = new EvaluateStaleAlerts(
  runner,
  new PostgresAlertEvaluationQuery(dataSource),
  { now: () => '2026-10-13T05:05:00Z' },
  300,
  { request: () => {} },
);
let original: { activated_at: Date; last_accepted_at: Date | null }[];
async function rows() {
  return dataSource.query<
    { episode_id: string; resolved_at: Date | null; recipient: string }[]
  >(
    `SELECT a.episode_id,a.resolved_at,j.message->>'recipient' AS recipient
    FROM alert_episodes a JOIN outbox_jobs j USING(episode_id) WHERE a.outlet_id=$1 AND kind='stale' ORDER BY opened_at`,
    [BISHKEK_OUTLET_ID],
  );
}
await describe('Stale episodes', async () => {
  before(async () => {
    await dataSource.initialize();
    original = await dataSource.query(
      'SELECT activated_at,last_accepted_at FROM outlets WHERE outlet_id=$1',
      [BISHKEK_OUTLET_ID],
    );
  });
  after(async () => {
    await dataSource.query(
      'TRUNCATE outbox_jobs,alert_episodes,midday_assessments',
    );
    await dataSource.query(
      'UPDATE outlets SET activated_at=$2,last_accepted_at=$3 WHERE outlet_id=$1',
      [
        BISHKEK_OUTLET_ID,
        original[0]!.activated_at,
        original[0]!.last_accepted_at,
      ],
    );
    await dataSource.destroy();
  });
  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE outbox_jobs,alert_episodes,midday_assessments,return_lines,return_events,sale_lines,sale_receipts,accepted_events',
    );
    await dataSource.query(
      "UPDATE outlets SET activated_at='2026-10-13T05:00:00Z',last_accepted_at=NULL WHERE outlet_id=$1",
      [BISHKEK_OUTLET_ID],
    );
  });
  await it('uses activation fallback, exact timeout, one episode and one captured job under concurrent evaluation', async () => {
    await evaluate.execute('2026-10-13T05:04:59.999Z');
    assert.equal((await rows()).length, 0);
    await Promise.all([
      evaluate.execute('2026-10-13T05:05:00Z'),
      evaluate.execute('2026-10-13T05:05:00Z'),
    ]);
    await evaluate.execute('2026-10-13T05:06:00Z');
    assert.equal((await rows()).length, 1);
    const snapshot = await new PostgresRankingQuery(dataSource, 'KGS').get(
      'hour',
      '2026-10-13T05:06:00Z',
    );
    assert.equal(
      snapshot.rows.find((row) => row.outlet_id === BISHKEK_OUTLET_ID)!.stale,
      true,
    );
  });
  await it('resolves on committed activity, ignores retry activity and reopens with a new notification later', async () => {
    await evaluate.execute();
    const input = {
      kind: 'sale' as const,
      event_id: randomUUID(),
      receipt_id: randomUUID(),
      outlet_id: BISHKEK_OUTLET_ID,
      occurred_at: '2026-10-13T05:01:00Z',
      lines: [
        {
          sale_line_id: randomUUID(),
          product_id: BREAD_PRODUCT_ID,
          quantity: 1,
          unit_price_minor: 100n,
          line_amount_minor: 100n,
        },
      ],
    };
    const ingest = new IngestEvent(
      runner,
      { now: () => '2026-10-13T05:07:00Z' },
      { request: () => {} },
    );
    await ingest.execute(input);
    assert.ok((await rows())[0]!.resolved_at !== null);
    await new IngestEvent(
      runner,
      { now: () => '2026-10-13T05:20:00Z' },
      { request: () => {} },
    ).execute(input);
    await evaluate.execute('2026-10-13T05:12:00Z');
    assert.equal((await rows()).length, 2);
    assert.equal((await rows())[1]!.resolved_at, null);
  });
  await it('rolls episode creation back when atomic outbox insertion fails', async () => {
    const failed = new EvaluateStaleAlerts(
      {
        run: (operation) =>
          runner.run(async (ports) => {
            ports.outbox.insert = () =>
              Promise.reject(new Error('outbox failed'));
            return operation(ports);
          }),
      },
      new PostgresAlertEvaluationQuery(dataSource),
      { now: () => '2026-10-13T05:05:00Z' },
      300,
      { request: () => assert.fail('No uncommitted refresh') },
    );
    await assert.rejects(failed.execute(), /outbox failed/);
    const episodes: unknown[] = await dataSource.query(
      'SELECT * FROM alert_episodes WHERE outlet_id=$1',
      [BISHKEK_OUTLET_ID],
    );
    assert.equal(episodes.length, 0);
  });
});
