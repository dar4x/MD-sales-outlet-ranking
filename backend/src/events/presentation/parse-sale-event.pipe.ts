/* External deps */
import type { PipeTransform } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import type { ValidationError } from 'class-validator';
import { validateSync } from 'class-validator';

/* Internal deps */
import { EventValidationError } from '../domain/event-errors.js';
import type { SaleInput, SaleLine } from '../domain/event.js';
import { SaleEventDto } from './sale-event.dto.js';

// Turns the raw POST /api/events body into a SaleInput. Every rejection is
// an EventValidationError, so the controller can answer 422 in one place.
export class ParseSaleEventPipe implements PipeTransform<unknown, SaleInput> {
  transform(body: unknown): SaleInput {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      throw new EventValidationError(
        'invalid_request',
        'The request body must be a JSON object.',
      );
    }
    // Returns are part of the contract but arrive in a later branch.
    if ('kind' in body && body.kind === 'return') {
      throw new EventValidationError(
        'unsupported_kind',
        'Return events are not supported yet.',
      );
    }

    if ('lines' in body && Array.isArray(body.lines)) {
      for (const line of body.lines) {
        if (typeof line !== 'object' || line === null || Array.isArray(line)) {
          throw new EventValidationError(
            'invalid_request',
            'Each sale line must be a JSON object.',
          );
        }
      }
    }

    const dto = plainToInstance(SaleEventDto, body);
    // forbidNonWhitelisted: the contract says unknown fields are rejected.
    const errors = validateSync(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length > 0) {
      throw new EventValidationError(
        'invalid_request',
        'The request body is not a valid sale event.',
        describeErrors(errors, ''),
      );
    }

    if (/\.\d{4,}/.test(dto.occurred_at)) {
      throw new EventValidationError(
        'timestamp_precision',
        'occurred_at must have at most three fractional-second digits.',
      );
    }

    const lines: SaleLine[] = [];
    for (const line of dto.lines) {
      lines.push({
        sale_line_id: line.sale_line_id,
        product_id: line.product_id,
        quantity: line.quantity,
        // Safe: MONEY_PATTERN allows only digits.
        unit_price_minor: BigInt(line.unit_price_minor),
        line_amount_minor: BigInt(line.line_amount_minor),
      });
    }
    return {
      kind: 'sale',
      event_id: dto.event_id,
      receipt_id: dto.receipt_id,
      outlet_id: dto.outlet_id,
      occurred_at: dto.occurred_at,
      lines,
    };
  }
}

// Flattens nested class-validator errors into "lines.0.quantity: ..." lines.
function describeErrors(
  errors: ValidationError[],
  parentPath: string,
): string[] {
  const details: string[] = [];
  for (const error of errors) {
    const path =
      parentPath === '' ? error.property : `${parentPath}.${error.property}`;
    for (const message of Object.values(error.constraints ?? {})) {
      details.push(`${path}: ${message}`);
    }
    if (error.children !== undefined && error.children.length > 0) {
      details.push(...describeErrors(error.children, path));
    }
  }
  return details;
}
