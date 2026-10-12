/* External deps */
import type { INestApplication } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { Server, ServerOptions } from 'socket.io';

export class SocketIoAdapter extends IoAdapter {
  constructor(
    app: INestApplication,
    private readonly frontendOrigin: string,
  ) {
    super(app);
  }

  override createIOServer(
    port: number,
    options: Partial<ServerOptions> = {},
  ): Server {
    // Nest's server factory is untyped; keep the assertion at this boundary.
    return super.createIOServer(port, {
      ...options,
      cors: { origin: this.frontendOrigin },
    }) as Server;
  }
}
