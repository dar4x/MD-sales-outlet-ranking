/* External deps */
import { Module } from '@nestjs/common';

/* Internal deps */
import { ApplicationConfigModule } from './config/application-config.module.js';

@Module({
  imports: [ApplicationConfigModule],
})
export class AppModule {}
