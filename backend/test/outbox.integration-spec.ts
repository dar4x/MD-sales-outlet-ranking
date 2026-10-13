import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';
import dataSource from '../src/database/data-source.js';
import { PostgresAlertRepository } from '../src/alerts/infrastructure/postgres-alert.repository.js';
import { PostgresOutboxRepository } from '../src/notifications/infrastructure/postgres-outbox.repository.js';
import { DispatchOutbox } from '../src/notifications/application/dispatch-outbox.js';
import { OutboxWorker } from '../src/notifications/infrastructure/outbox-worker.js';
import { SmtpMailer } from '../src/notifications/infrastructure/smtp-mailer.js';
import { BISHKEK_OUTLET_ID } from './seed-data.js';
import { assertTestDatabase } from './test-database.js';
assertTestDatabase();
const time = '2026-10-13T06:00:00.000Z';
async function job(subject = 'Test alert ' + randomUUID()) {
  const episodeId = randomUUID();
  const jobId = randomUUID();
  const message = {
    recipient: 'captured@example.com',
    subject,
    text: 'Тест сообщения\n.line\nend',
    message_id: '<' + jobId + '@sales-ranking.local>',
  };
  await dataSource.transaction(async (manager) => {
    await new PostgresAlertRepository(manager).insert({
      episode_id: episodeId,
      outlet_id: BISHKEK_OUTLET_ID,
      local_date: null,
      opened_at: time,
      resolved_at: null,
      facts: {
        kind: 'stale',
        last_activity_at: time,
        timeout_seconds: 300,
        recipient: { name: 'Captured', email: message.recipient },
      },
    });
    await new PostgresOutboxRepository(manager).insert({
      job_id: jobId,
      episode_id: episodeId,
      notification_key: 'alert:' + episodeId,
      message,
      status: 'pending',
      attempts: 0,
      next_attempt_at: time,
      created_at: time,
      sent_at: null,
      last_error: null,
    });
  });
  return { jobId, message };
}
await describe('Persisted outbox delivery', async () => {
  before(() => dataSource.initialize());
  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE outbox_jobs,alert_episodes,midday_assessments',
    );
  });
  after(async () => {
    await dataSource.query(
      'TRUNCATE outbox_jobs,alert_episodes,midday_assessments',
    );
    await dataSource.destroy();
  });
  await it('persists failed attempts, respects backoff, retries the captured ID and does not resend sent jobs', async () => {
    const created = await job();
    let now = time;
    const ids: string[] = [];
    const mailer = {
      send: (message: { message_id: string }) => {
        ids.push(message.message_id);
        return ids.length === 1
          ? Promise.reject(new Error('SMTP down'))
          : Promise.resolve();
      },
    };
    const dispatch = new DispatchOutbox(
      new PostgresOutboxRepository(dataSource.manager),
      mailer,
      { now: () => now },
      1000,
    );
    await dispatch.execute();
    const rows: {
      attempts: number;
      next_attempt_at: Date;
      last_error: string;
      status: string;
    }[] = await dataSource.query(
      'SELECT attempts,next_attempt_at,last_error,status FROM outbox_jobs WHERE job_id=$1',
      [created.jobId],
    );
    assert.equal(rows[0]!.attempts, 1);
    assert.equal(rows[0]!.last_error, 'SMTP down');
    assert.equal(
      rows[0]!.next_attempt_at.toISOString(),
      '2026-10-13T06:00:01.000Z',
    );
    await dispatch.execute();
    assert.equal(ids.length, 1);
    now = '2026-10-13T06:00:01.000Z';
    await dispatch.execute();
    await dispatch.execute();
    assert.deepEqual(ids, [
      created.message.message_id,
      created.message.message_id,
    ]);
    const sent: { status: string; attempts: number }[] = await dataSource.query(
      'SELECT status,attempts FROM outbox_jobs WHERE job_id=$1',
      [created.jobId],
    );
    assert.deepEqual(sent, [{ status: 'sent', attempts: 2 }]);
  });
  await it('prevents parallel workers using a session advisory lock without leases', async () => {
    await job();
    let calls = 0;
    let started!: () => void;
    let release!: () => void;
    const start = new Promise<void>((resolve) => {
      started = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const mailer = {
      send: async () => {
        calls += 1;
        started();
        await gate;
      },
    };
    const first = new OutboxWorker(
      dataSource,
      mailer,
      { now: () => time },
      60000,
      1000,
      (error) => assert.fail(String(error)),
    );
    const second = new OutboxWorker(
      dataSource,
      mailer,
      { now: () => time },
      60000,
      1000,
      (error) => assert.fail(String(error)),
    );
    const running = first.tick();
    try {
      await start;
      await second.tick();
      assert.equal(calls, 1);
      release();
      await running;
      await second.tick();
      assert.equal(calls, 1);
    } finally {
      release();
      await running;
      await first.onModuleDestroy();
      await second.onModuleDestroy();
    }
  });
  await it('delivers captured recipient, UTF-8 body and stable Message-ID to real Mailpit over SMTP', async () => {
    const created = await job('Mailpit verification ' + randomUUID());
    const dispatch = new DispatchOutbox(
      new PostgresOutboxRepository(dataSource.manager),
      new SmtpMailer(
        process.env.SMTP_HOST ?? '127.0.0.1',
        Number(process.env.SMTP_PORT ?? 1025),
        'alerts@example.com',
      ),
      { now: () => time },
      1000,
    );
    await dispatch.execute();
    const response = await fetch('http://127.0.0.1:8025/api/v1/messages');
    assert.equal(response.status, 200);
    const mailbox = (await response.json()) as {
      messages: { ID: string; Subject: string }[];
    };
    const delivered = mailbox.messages.find(
      (message) => message.Subject === created.message.subject,
    );
    assert.ok(delivered);
    const detail = (await (
      await fetch('http://127.0.0.1:8025/api/v1/message/' + delivered.ID)
    ).json()) as { Text: string; MessageID: string; To: { Address: string }[] };
    assert.ok(detail.Text.includes('Тест сообщения'));
    assert.ok(detail.Text.includes('.line'));
    assert.equal(detail.To[0]!.Address, created.message.recipient);
    assert.equal(detail.MessageID, created.message.message_id.slice(1, -1));
    const sent: { status: string }[] = await dataSource.query(
      'SELECT status FROM outbox_jobs WHERE job_id=$1',
      [created.jobId],
    );
    assert.equal(sent[0]!.status, 'sent');
  });
  await it('can resend after SMTP acceptance followed by a failed sent write, preserving the Message-ID', async () => {
    const created = await job();
    const repository = new PostgresOutboxRepository(dataSource.manager);
    const ids: string[] = [];
    const mailer = {
      send: (message: { message_id: string }) => {
        ids.push(message.message_id);
        return Promise.resolve();
      },
    };
    const interrupted = new DispatchOutbox(
      {
        insert: (job) => repository.insert(job),
        findDue: (time, limit) => repository.findDue(time, limit),
        markSent: () => Promise.reject(new Error('after SMTP acceptance')),
        recordAttempt: (id, attempts, next, error) =>
          repository.recordAttempt(id, attempts, next, error),
      },
      mailer,
      { now: () => time },
      1000,
    );
    await assert.rejects(interrupted.execute(), /after SMTP acceptance/);
    await new DispatchOutbox(
      repository,
      mailer,
      { now: () => time },
      1000,
    ).execute();
    assert.deepEqual(ids, [
      created.message.message_id,
      created.message.message_id,
    ]);
  });
});
