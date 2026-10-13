import type { DataSource } from 'typeorm';
import type { Mailer } from '../application/ports/outbox-ports.js';
import type { Clock } from '../../shared/application/ports/clock.js';
import { DispatchOutbox } from '../application/dispatch-outbox.js';
import { PostgresOutboxRepository } from './postgres-outbox.repository.js';

export class OutboxWorker {
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;
  private stopped = false;
  private active: Promise<void> | undefined;
  constructor(
    private readonly database: DataSource,
    private readonly mailer: Mailer,
    private readonly clock: Clock,
    private readonly intervalMs: number,
    private readonly retryMs: number,
    private readonly log: (error: unknown) => void,
  ) {}
  onModuleInit(): void {
    this.timer = setInterval(() => {
      if (!this.running && !this.stopped) this.active = this.tick();
    }, this.intervalMs);
  }
  async tick(): Promise<void> {
    if (this.running || this.stopped) return;
    this.running = true;
    const runner = this.database.createQueryRunner();
    let locked = false;
    try {
      await runner.connect();
      // Session advisory lock prevents two workers sending concurrently; a crash releases it without a lease.
      const rows: { locked: boolean }[] = await runner.manager.query<
        { locked: boolean }[]
      >('SELECT pg_try_advisory_lock(1791901000) AS locked');
      locked = rows[0]!.locked;
      if (locked)
        await new DispatchOutbox(
          new PostgresOutboxRepository(runner.manager),
          this.mailer,
          this.clock,
          this.retryMs,
        ).execute();
    } catch (error) {
      this.log(error);
    } finally {
      try {
        if (locked) await runner.query('SELECT pg_advisory_unlock(1791901000)');
      } catch (error) {
        this.log(error);
      } finally {
        try {
          await runner.release();
        } catch (error) {
          this.log(error);
        }
        this.running = false;
      }
    }
  }
  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    clearInterval(this.timer);
    await this.active;
  }
}
