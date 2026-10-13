/* External deps */
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';

/* Internal deps */
import type { EnvironmentVariables } from './config/environment.validation.js';
import { SocketIoAdapter } from './realtime/socket-io.adapter.js';

export function configureApplication(app: INestApplication): void {
  const config =
    app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);

  // Valid JSON scalars reach the transport validators and receive contract 422 errors.
  (app as NestExpressApplication).useBodyParser('json', { strict: false });
  app.setGlobalPrefix('api');
  app.enableCors({ origin: config.get('FRONTEND_ORIGIN', { infer: true }) });
  app.useWebSocketAdapter(
    new SocketIoAdapter(app, config.get('FRONTEND_ORIGIN', { infer: true })),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableShutdownHooks();
}
