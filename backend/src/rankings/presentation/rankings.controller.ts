/* External deps */
import {
  Controller,
  Get,
  Query,
  UnprocessableEntityException,
  ValidationPipe,
  UseFilters,
} from '@nestjs/common';
/* Internal deps */
import { GetRankings } from '../application/get-rankings.js';
import type { RankingSnapshot } from '../application/read-models/ranking.js';
import type { RankingWindow } from '../../shared/domain/value-types.js';
import { RankingsQueryDto } from './rankings-query.dto.js';
import { EventErrorsFilter } from '../../events/presentation/event-errors.filter.js';

@Controller('rankings')
@UseFilters(EventErrorsFilter)
export class RankingsController {
  constructor(private readonly getRankings: GetRankings) {}

  @Get()
  get(
    // Object metadata lets this route's pipe own the contract's 422 response.
    @Query(
      new ValidationPipe({
        expectedType: RankingsQueryDto,
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        exceptionFactory: () =>
          new UnprocessableEntityException({
            code: 'invalid_request',
            message: 'Invalid rankings query.',
          }),
      }),
    )
    query: { window: RankingWindow },
  ): Promise<RankingSnapshot> {
    return this.getRankings.execute(query.window);
  }
}
