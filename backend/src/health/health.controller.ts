/* External deps */
import { Controller, Get } from '@nestjs/common';

/* Internal deps */
import { HealthService } from './health.service.js';
import type { HealthResponse, PingResponse } from './health.types.js';

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('ping')
  getPing(): PingResponse {
    return this.healthService.getPing();
  }

  @Get('health')
  getHealth(): Promise<HealthResponse> {
    return this.healthService.getHealth();
  }
}
