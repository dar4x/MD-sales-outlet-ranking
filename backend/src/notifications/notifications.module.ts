import { Module, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import type { EnvironmentVariables } from '../config/environment.validation.js';
import { DatabaseModule } from '../database/database.module.js';
import { SystemClock } from '../shared/infrastructure/system-clock.js';
import { DispatchOutbox } from './application/dispatch-outbox.js';
import { PostgresOutboxRepository } from './infrastructure/postgres-outbox.repository.js';
import { SmtpMailer } from './infrastructure/smtp-mailer.js';
import { OutboxWorker } from './infrastructure/outbox-worker.js';
const logger = new Logger('Outbox');
@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: SmtpMailer,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) =>
        new SmtpMailer(
          config.get('SMTP_HOST', { infer: true }),
          config.get('SMTP_PORT', { infer: true }),
          config.get('SMTP_FROM', { infer: true }),
        ),
    },
    {
      provide: DispatchOutbox,
      inject: [DataSource, SmtpMailer, ConfigService],
      useFactory: (
        db: DataSource,
        mailer: SmtpMailer,
        config: ConfigService<EnvironmentVariables, true>,
      ) =>
        new DispatchOutbox(
          new PostgresOutboxRepository(db.manager),
          mailer,
          new SystemClock(),
          config.get('OUTBOX_RETRY_DELAY_MS', { infer: true }),
        ),
    },
    {
      provide: OutboxWorker,
      inject: [DataSource, SmtpMailer, ConfigService],
      useFactory: (
        db: DataSource,
        mailer: SmtpMailer,
        config: ConfigService<EnvironmentVariables, true>,
      ) =>
        new OutboxWorker(
          db,
          mailer,
          new SystemClock(),
          config.get('OUTBOX_POLL_INTERVAL_MS', { infer: true }),
          config.get('OUTBOX_RETRY_DELAY_MS', { infer: true }),
          (error) => logger.error('Outbox dispatch failed.', error),
        ),
    },
  ],
})
export class NotificationsModule {}
