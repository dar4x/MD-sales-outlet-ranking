/* External deps */
import { Body, Controller, Post, Res, UseFilters } from '@nestjs/common';

/* Internal deps */
import { IngestEvent } from '../application/ingest-event.js';
import type { SaleInput } from '../domain/event.js';
import { EventErrorsFilter } from './event-errors.filter.js';
import { ParseSaleEventPipe } from './parse-sale-event.pipe.js';

// Acceptance as JSON: money is a decimal string, never a JS number.
interface AcceptanceResponse {
  event_id: string;
  outlet_id: string;
  kind: 'sale' | 'return';
  accepted_at: string;
  amount_minor: string;
  duplicate: boolean;
}

// Only the Express method used here (see event-errors.filter.ts).
interface StatusResponse {
  status(code: number): unknown;
}

@Controller('events')
@UseFilters(EventErrorsFilter)
export class EventsController {
  constructor(private readonly ingestEvent: IngestEvent) {}

  // SaleInput is an interface, so the global ValidationPipe skips this
  // parameter; ParseSaleEventPipe does all body validation.
  @Post()
  async ingest(
    @Body(new ParseSaleEventPipe()) sale: SaleInput,
    @Res({ passthrough: true }) response: StatusResponse,
  ): Promise<AcceptanceResponse> {
    const result = await this.ingestEvent.execute(sale);

    // 201 for a new event, 200 for an identical retry (API contract).
    response.status(result.outcome === 'created' ? 201 : 200);
    return {
      event_id: result.acceptance.event_id,
      outlet_id: result.acceptance.outlet_id,
      kind: result.acceptance.kind,
      accepted_at: result.acceptance.accepted_at,
      amount_minor: result.acceptance.amount_minor.toString(),
      duplicate: result.acceptance.duplicate,
    };
  }
}
