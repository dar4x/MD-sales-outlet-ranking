/* External deps */
import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';

/* Internal deps */
import {
  RankingsModule,
  RANKING_REFRESH_REQUESTER,
} from '../rankings/rankings.module.js';
import type { RankingRefreshRequester } from '../rankings/application/ports/ranking-ports.js';
import { DatabaseModule } from '../database/database.module.js';
import { SystemClock } from '../shared/infrastructure/system-clock.js';
import { PostgresTransactionRunner } from '../shared/infrastructure/postgres-transaction-runner.js';
import { IngestEvent } from './application/ingest-event.js';
import { EventsController } from './presentation/events.controller.js';

// IngestEvent has no Nest decorators, so it is built here with a factory.
@Module({
  imports: [DatabaseModule, RankingsModule],
  controllers: [EventsController],
  providers: [
    {
      provide: IngestEvent,
      inject: [DataSource, RANKING_REFRESH_REQUESTER],
      useFactory: (
        dataSource: DataSource,
        refreshRequester: RankingRefreshRequester,
      ) =>
        new IngestEvent(
          new PostgresTransactionRunner(dataSource),
          new SystemClock(),
          refreshRequester,
        ),
    },
  ],
})
export class EventsModule {}
