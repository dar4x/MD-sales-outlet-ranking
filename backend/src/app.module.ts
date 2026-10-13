/* External deps */
import { Module } from '@nestjs/common';

/* Internal deps */
import { ApplicationConfigModule } from './config/application-config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { EventsModule } from './events/events.module.js';
import { HealthModule } from './health/health.module.js';
import { RankingsModule } from './rankings/rankings.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';

@Module({
  imports: [
    ApplicationConfigModule,
    DatabaseModule,
    EventsModule,
    HealthModule,
    RealtimeModule,
    RankingsModule,
  ],
})
export class AppModule {}
