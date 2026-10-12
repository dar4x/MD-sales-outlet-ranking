/* External deps */
import { Module } from '@nestjs/common';

/* Internal deps */
import { RealtimeGateway } from './realtime.gateway.js';
import { RealtimeService } from './realtime.service.js';

@Module({
  providers: [RealtimeGateway, RealtimeService],
})
export class RealtimeModule {}
