/* External deps */
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
/* Internal deps */
import type { EnvironmentVariables } from '../config/environment.validation.js';
import { DatabaseModule } from '../database/database.module.js';
import { GetRankings } from './application/get-rankings.js';
import { PostgresRankingQuery } from './infrastructure/postgres-ranking.query.js';
import { RankingsController } from './presentation/rankings.controller.js';

@Module({
  imports: [DatabaseModule],
  controllers: [RankingsController],
  providers: [
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
