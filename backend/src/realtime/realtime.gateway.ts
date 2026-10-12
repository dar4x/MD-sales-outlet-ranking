/* External deps */
import { SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import type { WsResponse } from '@nestjs/websockets';

/* Internal deps */
import { RealtimeService } from './realtime.service.js';
import type { PongResponse } from './realtime.types.js';

@WebSocketGateway()
export class RealtimeGateway {
  constructor(private readonly realtimeService: RealtimeService) {}

  @SubscribeMessage('ping')
  handlePing(): WsResponse<PongResponse> {
    return { event: 'pong', data: this.realtimeService.getPong() };
  }
}
