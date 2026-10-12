/* External deps */
import { Module } from '@nestjs/common';

/* Internal deps */
import { ApplicationConfigModule } from './config/application-config.module.js';
import { DatabaseModule } from './database/database.module.js';

@Module({
  imports: [ApplicationConfigModule, DatabaseModule],
})
export class AppModule {}
