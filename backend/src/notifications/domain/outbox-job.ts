import type {
  Identifier,
  UtcTimestamp,
} from '../../shared/domain/value-types.js';
export interface EmailMessage {
  recipient: string;
  subject: string;
  text: string;
  message_id: string;
}
export interface OutboxJob {
  job_id: Identifier;
  episode_id: Identifier;
  notification_key: string;
  message: EmailMessage;
  status: 'pending' | 'sent';
  attempts: number;
  next_attempt_at: UtcTimestamp;
  created_at: UtcTimestamp;
  sent_at: UtcTimestamp | null;
  last_error: string | null;
}
