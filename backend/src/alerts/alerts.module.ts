import { Module, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import type { EnvironmentVariables } from '../config/environment.validation.js';
import { DatabaseModule } from '../database/database.module.js';
import {
  RankingsModule,
  RANKING_REFRESH_REQUESTER,
} from '../rankings/rankings.module.js';
import type { RankingRefreshRequester } from '../rankings/application/ports/ranking-ports.js';
import { PostgresTransactionRunner } from '../shared/infrastructure/postgres-transaction-runner.js';
import { SystemClock } from '../shared/infrastructure/system-clock.js';
import { EvaluateMiddayAlerts } from './application/evaluate-midday-alerts.js';
import { EvaluateAlerts } from './application/evaluate-alerts.js';
import { EvaluateStaleAlerts } from './application/evaluate-stale-alerts.js';
import { ListAlerts } from './application/list-alerts.js';
import { PostgresAlertEvaluationQuery } from './infrastructure/postgres-alert-evaluation.query.js';
import { PostgresAlertRepository } from './infrastructure/postgres-alert.repository.js';
import { AlertScheduler } from './infrastructure/alert-scheduler.js';
import { AlertsController } from './presentation/alerts.controller.js';
const logger = new Logger('AlertEvaluation');
@Module({
  imports: [DatabaseModule, RankingsModule],
  controllers: [AlertsController],
  providers: [
    {
      provide: EvaluateAlerts,
      inject: [EvaluateStaleAlerts, EvaluateMiddayAlerts],
      useFactory: (stale: EvaluateStaleAlerts, midday: EvaluateMiddayAlerts) =>
        new EvaluateAlerts(stale, midday, new SystemClock()),
    },
    {
      provide: EvaluateMiddayAlerts,
      inject: [DataSource, RANKING_REFRESH_REQUESTER],
      useFactory: (db: DataSource, refresh: RankingRefreshRequester) =>
        new EvaluateMiddayAlerts(
          new PostgresTransactionRunner(db),
          new PostgresAlertEvaluationQuery(db),
          new SystemClock(),
          refresh,
        ),
    },
    {
      provide: EvaluateStaleAlerts,
      inject: [DataSource, ConfigService, RANKING_REFRESH_REQUESTER],
      useFactory: (
        db: DataSource,
        config: ConfigService<EnvironmentVariables, true>,
        refresh: RankingRefreshRequester,
      ) =>
        new EvaluateStaleAlerts(
          new PostgresTransactionRunner(db),
          new PostgresAlertEvaluationQuery(db),
          new SystemClock(),
          config.get('STALE_TIMEOUT_SECONDS', { infer: true }),
          refresh,
        ),
    },
    {
      provide: ListAlerts,
      inject: [DataSource],
      useFactory: (db: DataSource) =>
        new ListAlerts(new PostgresAlertRepository(db.manager)),
    },
    {
      provide: AlertScheduler,
      inject: [EvaluateAlerts, ConfigService],
      useFactory: (
        evaluate: EvaluateAlerts,
        config: ConfigService<EnvironmentVariables, true>,
      ) =>
        new AlertScheduler(
          () => evaluate.execute(),
          config.get('ALERT_EVALUATION_INTERVAL_MS', { infer: true }),
          (error) => logger.error('Alert evaluation failed.', error),
        ),
    },
  ],
})
export class AlertsModule {}
