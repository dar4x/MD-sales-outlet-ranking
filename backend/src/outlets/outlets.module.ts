/* External deps */
import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
/* Internal deps */
import { DatabaseModule } from '../database/database.module.js';
import { GetOutletCard } from './application/get-outlet-card.js';
import { PostgresOutletCardQuery } from './infrastructure/postgres-outlet-card.query.js';
import { SystemClock } from '../shared/infrastructure/system-clock.js';
import { ListOutlets } from './application/list-outlets.js';
import { PostgresOutletQuery } from './infrastructure/postgres-outlet.query.js';
import { OutletsController } from './presentation/outlets.controller.js';

@Module({
  imports: [DatabaseModule],
  controllers: [OutletsController],
  providers: [
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
