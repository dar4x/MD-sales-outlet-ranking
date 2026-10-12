/* External deps */
import { Module } from '@nestjs/common';

/* Internal deps */
import { DatabaseModule } from '../database/database.module.js';
import { DatabaseHealthQuery } from './database-health.query.js';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [HealthController],
  providers: [HealthService, DatabaseHealthQuery],
})
export class HealthModule {}
