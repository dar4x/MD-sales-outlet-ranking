/* External deps */
import { Controller, Get } from '@nestjs/common';

/* Internal deps */
import { HealthService } from './health.service.js';
import type { HealthResponse } from './health.types.js';

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  getHealth(): Promise<HealthResponse> {
    return this.healthService.getHealth();
  }
}
