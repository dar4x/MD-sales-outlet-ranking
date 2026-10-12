import { Module } from '@nestjs/common';
import { ApplicationConfigModule } from './config/application-config.module.js';

@Module({
  imports: [ApplicationConfigModule],
})
export class AppModule {}
