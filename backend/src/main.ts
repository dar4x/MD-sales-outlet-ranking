/* External deps */
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import 'reflect-metadata';

/* Internal deps */
import { AppModule } from './app.module.js';
import type { EnvironmentVariables } from './config/environment.validation.js';
import { configureApplication } from './configure-application.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config =
    app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);
  const host = config.get('BACKEND_HOST', { infer: true });
  const port = config.get('BACKEND_PORT', { infer: true });

  configureApplication(app);

  await app.listen(port, host);
  Logger.log(`Backend listening at ${await app.getUrl()}/api`, 'Bootstrap');
}

bootstrap().catch((error: unknown) => {
  Logger.error(error, 'Bootstrap');
  process.exitCode = 1;
});
