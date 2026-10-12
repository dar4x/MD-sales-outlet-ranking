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
    const configuredOptions = {
      ...options,
      cors: { origin: this.frontendOrigin },
    };

    // Nest declares full options; its Socket.IO factory accepts partial options.
    return super.createIOServer(port, configuredOptions as ServerOptions);
  }
}
