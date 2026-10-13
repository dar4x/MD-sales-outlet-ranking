/* External deps */
import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';

/* Internal deps */
import { DatabaseModule } from '../database/database.module.js';
import { SystemClock } from '../shared/infrastructure/system-clock.js';
import { PostgresTransactionRunner } from '../shared/infrastructure/postgres-transaction-runner.js';
import { IngestEvent } from './application/ingest-event.js';
import { EventsController } from './presentation/events.controller.js';

// IngestEvent has no Nest decorators, so it is built here with a factory.
@Module({
  imports: [DatabaseModule],
  controllers: [EventsController],
  providers: [
    {
      provide: IngestEvent,
      inject: [DataSource],
      useFactory: (dataSource: DataSource) =>
        new IngestEvent(
          new PostgresTransactionRunner(dataSource),
          new SystemClock(),
        ),
    },
  ],
})
export class EventsModule {}
