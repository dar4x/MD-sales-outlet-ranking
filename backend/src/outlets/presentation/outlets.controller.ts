/* External deps */
import {
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
import { ListOutlets } from '../application/list-outlets.js';
import type { OutletSummary } from '../application/read-models/outlet-card.js';
import { EventErrorsFilter } from '../../events/presentation/event-errors.filter.js';

@Controller('outlets')
@UseFilters(EventErrorsFilter)
export class OutletsController {
  constructor(
    private readonly listOutlets: ListOutlets,
    private readonly getCard: GetOutletCard,
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
}
