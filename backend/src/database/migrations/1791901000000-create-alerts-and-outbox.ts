import type { MigrationInterface, QueryRunner } from 'typeorm';
export class CreateAlertsAndOutbox1791901000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE alert_episodes (
      episode_id uuid PRIMARY KEY, outlet_id uuid NOT NULL REFERENCES outlets(outlet_id),
      kind text NOT NULL CHECK(kind IN ('stale','behind_plan')), local_date date,
      opened_at timestamptz NOT NULL, resolved_at timestamptz, facts jsonb NOT NULL,
      CHECK((kind='stale' AND local_date IS NULL) OR (kind='behind_plan' AND local_date IS NOT NULL))
    )`);
    await runner.query(
      `CREATE UNIQUE INDEX alert_one_open ON alert_episodes(outlet_id,kind) WHERE resolved_at IS NULL`,
    );
    await runner.query(
      `CREATE UNIQUE INDEX alert_one_noon ON alert_episodes(outlet_id,local_date) WHERE kind='behind_plan'`,
    );
    await runner.query(`CREATE TABLE midday_assessments (
      outlet_id uuid NOT NULL REFERENCES outlets(outlet_id),local_date date NOT NULL,
      cutoff_at timestamptz NOT NULL,assessed_at timestamptz NOT NULL,
      daily_plan_minor bigint NOT NULL CHECK(daily_plan_minor>0),net_revenue_minor numeric(40,0) NOT NULL,
      behind_plan boolean NOT NULL, PRIMARY KEY(outlet_id,local_date)
    )`);
    await runner.query(`CREATE TABLE outbox_jobs (
      job_id uuid PRIMARY KEY,episode_id uuid NOT NULL UNIQUE REFERENCES alert_episodes(episode_id),
      notification_key text NOT NULL UNIQUE,message jsonb NOT NULL,
      status text NOT NULL CHECK(status IN ('pending','sent')),attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
      next_attempt_at timestamptz NOT NULL,created_at timestamptz NOT NULL,sent_at timestamptz,last_error text
    )`);
    await runner.query(
      `CREATE INDEX outbox_due ON outbox_jobs(next_attempt_at) WHERE status='pending'`,
    );
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TABLE outbox_jobs');
    await runner.query('DROP TABLE midday_assessments');
    await runner.query('DROP TABLE alert_episodes');
  }
}
