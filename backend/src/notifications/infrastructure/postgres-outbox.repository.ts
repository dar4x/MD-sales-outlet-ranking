import type { EntityManager } from 'typeorm';
import type { OutboxRepository } from '../application/ports/outbox-ports.js';
import type { OutboxJob, EmailMessage } from '../domain/outbox-job.js';
interface JobRow {
  job_id: string;
  episode_id: string;
  notification_key: string;
  message: EmailMessage;
  status: 'pending' | 'sent';
  attempts: number;
  next_attempt_at: Date;
  created_at: Date;
  sent_at: Date | null;
  last_error: string | null;
}
export class PostgresOutboxRepository implements OutboxRepository {
  constructor(private readonly manager: EntityManager) {}
  async insert(job: OutboxJob): Promise<'inserted' | 'notification_conflict'> {
    const rows: unknown[] = await this.manager.query(
      `INSERT INTO outbox_jobs(job_id,episode_id,notification_key,message,status,attempts,next_attempt_at,created_at,sent_at,last_error)
      VALUES($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING RETURNING job_id`,
      [
        job.job_id,
        job.episode_id,
        job.notification_key,
        JSON.stringify(job.message),
        job.status,
        job.attempts,
        job.next_attempt_at,
        job.created_at,
        job.sent_at,
        job.last_error,
      ],
    );
    return rows.length === 0 ? 'notification_conflict' : 'inserted';
  }
  async findDue(asOf: string, limit: number): Promise<OutboxJob[]> {
    const rows: JobRow[] = await this.manager.query(
      `SELECT * FROM outbox_jobs WHERE status='pending' AND next_attempt_at<=$1
      ORDER BY next_attempt_at,job_id LIMIT $2`,
      [asOf, limit],
    );
    return rows.map((row) => ({
      ...row,
      next_attempt_at: row.next_attempt_at.toISOString(),
      created_at: row.created_at.toISOString(),
      sent_at: row.sent_at?.toISOString() ?? null,
    }));
  }
  async markSent(jobId: string, sentAt: string): Promise<void> {
    await this.manager.query(
      `UPDATE outbox_jobs SET status='sent',sent_at=$2,attempts=attempts+1,last_error=NULL WHERE job_id=$1 AND status='pending'`,
      [jobId, sentAt],
    );
  }
  async recordAttempt(
    jobId: string,
    attempts: number,
    nextAttemptAt: string,
    error: string | null,
  ): Promise<void> {
    await this.manager.query(
      `UPDATE outbox_jobs SET attempts=$2,next_attempt_at=$3,last_error=$4 WHERE job_id=$1 AND status='pending'`,
      [jobId, attempts, nextAttemptAt, error],
    );
  }
}
