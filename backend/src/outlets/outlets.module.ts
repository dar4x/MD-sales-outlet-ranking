/* External deps */
import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
/* Internal deps */
import { DatabaseModule } from '../database/database.module.js';
import { ListOutlets } from './application/list-outlets.js';
import { PostgresOutletQuery } from './infrastructure/postgres-outlet.query.js';
import { OutletsController } from './presentation/outlets.controller.js';

@Module({
  imports: [DatabaseModule],
  controllers: [OutletsController],
  providers: [
    {
      provide: ListOutlets,
      inject: [DataSource],
      useFactory: (dataSource: DataSource) =>
        new ListOutlets(new PostgresOutletQuery(dataSource)),
    },
  ],
})
export class OutletsModule {}
