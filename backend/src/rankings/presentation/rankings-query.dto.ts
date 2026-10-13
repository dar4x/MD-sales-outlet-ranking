/* External deps */
import { IsIn } from 'class-validator';
/* Internal deps */
import type { RankingWindow } from '../../shared/domain/value-types.js';

export class RankingsQueryDto {
  @IsIn(['hour', 'business_day'])
  window: RankingWindow = 'business_day';
}
