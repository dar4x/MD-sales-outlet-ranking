/* External deps */
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/* Internal deps */
import type { EnvironmentVariables } from './config/environment.validation.js';

export function configureApplication(app: INestApplication): void {
  const config =
    app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);

  app.setGlobalPrefix('api');
  app.enableCors({ origin: config.get('FRONTEND_ORIGIN', { infer: true }) });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableShutdownHooks();
}
