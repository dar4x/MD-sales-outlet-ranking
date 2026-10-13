import {
  Controller,
  Get,
  Query,
  ValidationPipe,
  UnprocessableEntityException,
  UseFilters,
} from '@nestjs/common';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { ListAlerts } from '../application/list-alerts.js';
import { EventErrorsFilter } from '../../events/presentation/event-errors.filter.js';
class AlertsDto {
  @IsIn(['true', 'false']) active_only = 'true';
  @IsOptional() @IsUUID() outlet_id?: string;
}
@Controller('alerts')
@UseFilters(EventErrorsFilter)
export class AlertsController {
  constructor(private readonly alerts: ListAlerts) {}
  @Get()
  async list(
    @Query(
      new ValidationPipe({
        expectedType: AlertsDto,
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        exceptionFactory: () =>
          new UnprocessableEntityException({
            code: 'invalid_request',
            message: 'Invalid alerts query.',
          }),
      }),
    )
    query: {
      active_only: string;
      outlet_id?: string;
    },
  ) {
    const episodes = await this.alerts.execute({
      active_only: query.active_only === 'true',
      outlet_id: query.outlet_id,
    });
    const items = episodes.map((episode) => {
      const facts = episode.facts;
      return {
        episode_id: episode.episode_id,
        outlet_id: episode.outlet_id,
        kind: facts.kind,
        local_date: episode.local_date,
        opened_at: episode.opened_at,
        resolved_at: episode.resolved_at,
        facts:
          facts.kind === 'stale'
            ? {
                last_activity_at: facts.last_activity_at,
                timeout_seconds: facts.timeout_seconds,
                recipient: facts.recipient,
              }
            : {
                daily_plan_minor: facts.daily_plan_minor.toString(),
                net_revenue_minor: facts.net_revenue_minor.toString(),
                cutoff_at: facts.cutoff_at,
                recipient: facts.recipient,
              },
      };
    });
    return { items };
  }
}
