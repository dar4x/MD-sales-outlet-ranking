import type { OutboxRepository, Mailer } from './ports/outbox-ports.js';
import type { Clock } from '../../shared/application/ports/clock.js';

export class DispatchOutbox {
  constructor(
    private readonly jobs: OutboxRepository,
    private readonly mailer: Mailer,
    private readonly clock: Clock,
    private readonly retryDelayMs: number,
  ) {}
  async execute(): Promise<void> {
    for (const job of await this.jobs.findDue(this.clock.now(), 20)) {
      try {
        await this.mailer.send(job.message);
      } catch (error) {
        const attempts = job.attempts + 1;
        const delay = Math.min(
          this.retryDelayMs * 2 ** Math.min(attempts - 1, 20),
          300000,
        );
        await this.jobs.recordAttempt(
          job.job_id,
          attempts,
          new Date(Date.parse(this.clock.now()) + delay).toISOString(),
          error instanceof Error ? error.message : String(error),
        );
        continue;
      }
      // SMTP acceptance and this write cannot be atomic: a crash here may resend the same Message-ID.
      await this.jobs.markSent(job.job_id, this.clock.now());
    }
  }
}
