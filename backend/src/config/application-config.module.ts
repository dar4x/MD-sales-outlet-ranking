/* External deps */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'node:path';

/* Internal deps */
import { validateEnvironment } from './environment.validation.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolve(import.meta.dirname, '../../../.env'),
      validate: validateEnvironment,
    }),
  ],
  exports: [ConfigModule],
})
export class ApplicationConfigModule {}
