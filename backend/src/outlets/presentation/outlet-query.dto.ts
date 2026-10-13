import { IsIn } from 'class-validator';
import type { RankingWindow } from '../../shared/domain/value-types.js';
export class OutletWindowDto {
  @IsIn(['hour', 'business_day'])
  window: RankingWindow = 'business_day';
}
