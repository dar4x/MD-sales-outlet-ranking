/* External deps */
import { Injectable } from '@nestjs/common';

/* Internal deps */
import type { PongResponse } from './realtime.types.js';

@Injectable()
export class RealtimeService {
  getPong(): PongResponse {
    return { message: 'pong' };
  }
}
