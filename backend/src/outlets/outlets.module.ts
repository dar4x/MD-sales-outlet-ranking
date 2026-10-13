/* External deps */
import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
/* Internal deps */
import { DatabaseModule } from '../database/database.module.js';
import { GetOutletCard } from './application/get-outlet-card.js';
import { PostgresOutletCardQuery } from './infrastructure/postgres-outlet-card.query.js';
import { SystemClock } from '../shared/infrastructure/system-clock.js';
import { GetOutletSettings } from './application/get-outlet-settings.js';
import { UpdateOutletSettings } from './application/update-outlet-settings.js';
import { PostgresTransactionRunner } from '../shared/infrastructure/postgres-transaction-runner.js';
import {
  RankingsModule,
  RANKING_REFRESH_REQUESTER,
} from '../rankings/rankings.module.js';
import type { RankingRefreshRequester } from '../rankings/application/ports/ranking-ports.js';
import { ListOutlets } from './application/list-outlets.js';
import { PostgresOutletQuery } from './infrastructure/postgres-outlet.query.js';
import { OutletsController } from './presentation/outlets.controller.js';

@Module({
  imports: [DatabaseModule, RankingsModule],
  controllers: [OutletsController],
  providers: [
    {
      provide: GetOutletSettings,
      inject: [DataSource],
      useFactory: (db: DataSource) =>
        new GetOutletSettings(new PostgresOutletQuery(db)),
    },
    {
      provide: UpdateOutletSettings,
      inject: [DataSource, RANKING_REFRESH_REQUESTER],
      useFactory: (db: DataSource, refresh: RankingRefreshRequester) =>
        new UpdateOutletSettings(new PostgresTransactionRunner(db), refresh),
    },
    {
      provide: GetOutletCard,
      inject: [DataSource],
      useFactory: (database: DataSource) =>
        new GetOutletCard(
          new PostgresOutletCardQuery(database),
          new SystemClock(),
        ),
    },
    {
      provide: ListOutlets,
      inject: [DataSource],
      useFactory: (dataSource: DataSource) =>
        new ListOutlets(new PostgresOutletQuery(dataSource)),
    },
  ],
})
export class OutletsModule {}
