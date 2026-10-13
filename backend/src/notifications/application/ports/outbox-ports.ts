import type {
  Identifier,
  UtcTimestamp,
} from '../../../shared/domain/value-types.js';
import type { EmailMessage, OutboxJob } from '../../domain/outbox-job.js';
export interface OutboxRepository {
  insert(job: OutboxJob): Promise<'inserted' | 'notification_conflict'>;
  findDue(asOf: UtcTimestamp, limit: number): Promise<OutboxJob[]>;
  markSent(jobId: Identifier, sentAt: UtcTimestamp): Promise<void>;
  recordAttempt(
    jobId: Identifier,
    attempts: number,
    nextAttemptAt: UtcTimestamp,
    error: string | null,
  ): Promise<void>;
}
export interface Mailer {
  send(message: EmailMessage): Promise<void>;
}
