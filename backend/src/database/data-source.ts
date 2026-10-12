/* External deps */
import { ConfigService } from '@nestjs/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';

/* Internal deps */
import { validateEnvironment } from '../config/environment.validation.js';
import { createDatabaseOptions } from './database.options.js';

// CLI scripts load the root .env before importing this module.
const environment = validateEnvironment(process.env);
const config = new ConfigService<typeof environment, true>({ ...environment });

export default new DataSource(createDatabaseOptions(config));
