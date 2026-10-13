/* External deps */
import { Logger } from '@nestjs/common';
import {
  Ack,
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
/* Internal deps */
import { GetRankings } from '../application/get-rankings.js';

@WebSocketGateway()
export class RankingsGateway {
  @WebSocketServer()
  server!: Server;
  private readonly logger = new Logger(RankingsGateway.name);

  constructor(private readonly getRankings: GetRankings) {}

  @SubscribeMessage('rankings.subscribe')
  async subscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
    @Ack() acknowledge?: (response: unknown) => void,
  ): Promise<void> {
    if (
      typeof payload !== 'object' ||
      payload === null ||
      Array.isArray(payload) ||
      !('window' in payload) ||
      Object.keys(payload).length !== 1 ||
      (payload.window !== 'hour' && payload.window !== 'business_day')
    ) {
      acknowledge?.({
        ok: false,
        error: {
          code: 'invalid_request',
          message: 'Expected a ranking window: hour or business_day.',
        },
      });
      return;
    }
    const window = payload.window;
    // The default in-process Socket.IO adapter changes rooms synchronously.
    void client.leave('rankings:hour');
    void client.leave('rankings:business_day');
    void client.join('rankings:' + window);
    acknowledge?.({ ok: true, window });
    try {
      const snapshot = await this.getRankings.execute(window);
      // A switch, unsubscribe or disconnect may happen while SQL is running.
      if (client.connected && client.rooms.has('rankings:' + window)) {
        client.emit('rankings.snapshot', snapshot);
      }
    } catch (error) {
      this.logger.error('Initial ranking snapshot failed.', error);
    }
  }

  @SubscribeMessage('rankings.unsubscribe')
  unsubscribe(@ConnectedSocket() client: Socket): { ok: true } {
    void client.leave('rankings:hour');
    void client.leave('rankings:business_day');
    return { ok: true };
  }
}
