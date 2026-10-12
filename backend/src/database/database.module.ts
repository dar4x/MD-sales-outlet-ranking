/* External deps */
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

/* Internal deps */
import { ApplicationConfigModule } from '../config/application-config.module.js';
import { createDatabaseOptions } from './database.options.js';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ApplicationConfigModule],
      inject: [ConfigService],
      useFactory: createDatabaseOptions,
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
