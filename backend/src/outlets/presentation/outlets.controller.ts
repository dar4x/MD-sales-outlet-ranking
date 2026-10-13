/* External deps */
import {
  Body,
  Patch,
  Controller,
  Get,
  UseFilters,
  Param,
  Query,
  ParseUUIDPipe,
  ValidationPipe,
  UnprocessableEntityException,
  NotFoundException,
} from '@nestjs/common';
/* Internal deps */
import { GetOutletCard } from '../application/get-outlet-card.js';
import { OutletWindowDto } from './outlet-query.dto.js';
import type { OutletCard } from '../application/read-models/outlet-card.js';
import type { RankingWindow } from '../../shared/domain/value-types.js';
import { GetOutletSettings } from '../application/get-outlet-settings.js';
import { UpdateOutletSettings } from '../application/update-outlet-settings.js';
import { ParseOutletSettingsPipe } from './parse-outlet-settings.pipe.js';
import type { OutletSettingsPatch } from '../domain/outlet.js';
import type { OutletSettingsView } from '../application/read-models/outlet-card.js';
import { ListOutlets } from '../application/list-outlets.js';
import type { OutletSummary } from '../application/read-models/outlet-card.js';
import { EventErrorsFilter } from '../../events/presentation/event-errors.filter.js';

@Controller('outlets')
@UseFilters(EventErrorsFilter)
export class OutletsController {
  constructor(
    private readonly listOutlets: ListOutlets,
    private readonly getCard: GetOutletCard,
    private readonly getSettings: GetOutletSettings,
    private readonly updateSettings: UpdateOutletSettings,
  ) {}

  @Get()
  async list(): Promise<{ items: OutletSummary[] }> {
    return { items: await this.listOutlets.execute() };
  }
  @Get(':id/card')
  async card(
    @Param(
      'id',
      new ParseUUIDPipe({
        exceptionFactory: () =>
          new UnprocessableEntityException({
            code: 'invalid_request',
            message: 'Invalid outlet ID.',
          }),
      }),
    )
    id: string,
    @Query(
      new ValidationPipe({
        expectedType: OutletWindowDto,
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        exceptionFactory: () =>
          new UnprocessableEntityException({
            code: 'invalid_request',
            message: 'Invalid window.',
          }),
      }),
    )
    query: { window: RankingWindow },
  ): Promise<OutletCard> {
    const card = await this.getCard.execute(id, query.window);
    if (card === null)
      throw new NotFoundException({
        code: 'outlet_not_found',
        message: 'Outlet not found.',
      });
    return card;
  }
  @Get(':id/settings')
  async settings(
    @Param(
      'id',
      new ParseUUIDPipe({
        exceptionFactory: () =>
          new UnprocessableEntityException({
            code: 'invalid_request',
            message: 'Invalid outlet ID.',
          }),
      }),
    )
    id: string,
  ): Promise<OutletSettingsView> {
    const settings = await this.getSettings.execute(id);
    if (settings === null)
      throw new NotFoundException({
        code: 'outlet_not_found',
        message: 'Outlet not found.',
      });
    return {
      ...settings,
      daily_plan_minor: settings.daily_plan_minor.toString(),
    };
  }
  @Patch(':id/settings')
  async patch(
    @Param(
      'id',
      new ParseUUIDPipe({
        exceptionFactory: () =>
          new UnprocessableEntityException({
            code: 'invalid_request',
            message: 'Invalid outlet ID.',
          }),
      }),
    )
    id: string,
    @Body(new ParseOutletSettingsPipe()) patch: OutletSettingsPatch,
  ): Promise<OutletSettingsView> {
    const outlet = await this.updateSettings.execute(id, patch);
    if (outlet === null)
      throw new NotFoundException({
        code: 'outlet_not_found',
        message: 'Outlet not found.',
      });
    return {
      outlet_id: outlet.outlet_id,
      daily_plan_minor: outlet.daily_plan_minor.toString(),
      responsible_person: outlet.responsible_person,
    };
  }
}
