/* External deps */
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsString,
  IsUUID,
  Matches,
  ValidateNested,
} from 'class-validator';

// Money arrives as a decimal integer string (API contract), never a JSON
// number, so no value is rounded by JSON.parse.
const MONEY_PATTERN = /^(0|[1-9][0-9]*)$/;

// ISO 8601 with an explicit offset: Z or +hh:mm / -hh:mm. A time without
// an offset would be read in the server's zone, so it is rejected.
const TIMESTAMP_WITH_OFFSET_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

// Shape checks only. Business rules (empty lines, positive quantity, line
// amount, references) stay in the domain and application layers.
export class SaleLineDto {
  @IsUUID()
  sale_line_id!: string;

  @IsUUID()
  product_id!: string;

  @IsInt()
  quantity!: number;

  @IsString()
  @Matches(MONEY_PATTERN, { message: 'must be a decimal integer string' })
  unit_price_minor!: string;

  @IsString()
  @Matches(MONEY_PATTERN, { message: 'must be a decimal integer string' })
  line_amount_minor!: string;
}

export class SaleEventDto {
  @IsIn(['sale'])
  kind!: 'sale';

  @IsUUID()
  event_id!: string;

  @IsUUID()
  receipt_id!: string;

  @IsUUID()
  outlet_id!: string;

  @IsString()
  @Matches(TIMESTAMP_WITH_OFFSET_PATTERN, {
    message: 'must be an ISO 8601 timestamp with an explicit UTC offset',
  })
  @IsISO8601({ strict: true })
  occurred_at!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleLineDto)
  lines!: SaleLineDto[];
}
