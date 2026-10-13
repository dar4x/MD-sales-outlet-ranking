/* External deps */
import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
/* Internal deps */
import type { EnvironmentVariables } from '../config/environment.validation.js';
import { DatabaseModule } from '../database/database.module.js';
import { PublishRankings } from './application/publish-rankings.js';
import { CoalescedRankingRefresh } from './infrastructure/coalesced-ranking-refresh.js';
import { GetRankings } from './application/get-rankings.js';
import { PostgresRankingQuery } from './infrastructure/postgres-ranking.query.js';
import { RankingsGateway } from './presentation/rankings.gateway.js';
import { RankingsController } from './presentation/rankings.controller.js';

export const RANKING_REFRESH_REQUESTER = Symbol('RankingRefreshRequester');
const logger = new Logger('RankingRefresh');

@Module({
  imports: [DatabaseModule],
  exports: [RANKING_REFRESH_REQUESTER],
  controllers: [RankingsController],
  providers: [
    RankingsGateway,
    {
      provide: PublishRankings,
      inject: [GetRankings, RankingsGateway],
      useFactory: (getRankings: GetRankings, gateway: RankingsGateway) =>
        new PublishRankings(getRankings, gateway),
    },
    {
      provide: RANKING_REFRESH_REQUESTER,
      inject: [PublishRankings, ConfigService],
      useFactory: (
        publishRankings: PublishRankings,
        config: ConfigService<EnvironmentVariables, true>,
      ) =>
        new CoalescedRankingRefresh(
          () => publishRankings.execute(),
          config.get('REALTIME_COALESCE_MS', { infer: true }),
          (error) => logger.error('Ranking refresh failed.', error),
        ),
    },
    {
      provide: GetRankings,
      inject: [DataSource, ConfigService],
      useFactory: (
        dataSource: DataSource,
        config: ConfigService<EnvironmentVariables, true>,
      ) =>
        new GetRankings(
          new PostgresRankingQuery(
            dataSource,
            config.get('CURRENCY', { infer: true }),
          ),
        ),
    },
  ],
})
export class RankingsModule {}
