/* External deps */
import { Controller, Get, UseFilters } from '@nestjs/common';
/* Internal deps */
import { ListOutlets } from '../application/list-outlets.js';
import type { OutletSummary } from '../application/read-models/outlet-card.js';
import { EventErrorsFilter } from '../../events/presentation/event-errors.filter.js';

@Controller('outlets')
@UseFilters(EventErrorsFilter)
export class OutletsController {
  constructor(private readonly listOutlets: ListOutlets) {}

  @Get()
  async list(): Promise<{ items: OutletSummary[] }> {
    return { items: await this.listOutlets.execute() };
  }
}
