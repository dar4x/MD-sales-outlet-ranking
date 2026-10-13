/* Internal deps */
import { EventValidationError } from './event-errors.js';
import type { SaleInput } from './event.js';

// Largest value of a PostgreSQL bigint column, where money is stored. The
// contract sets no business limit for money, so this is the storage limit.
const MAX_MINOR_UNITS = 9223372036854775807n;

// Runs before hashing, so a broken sale is rejected as 422 and never stored.
// Money stays in bigint: no Number conversion, so no float rounding.
export function validateSale(sale: SaleInput): void {
  if (sale.lines.length === 0) {
    throw new EventValidationError(
      'empty_lines',
      'A sale needs at least one line.',
    );
  }

  const seenLineIds = new Set<string>();
  let grossAmountMinor = 0n;
  for (const line of sale.lines) {
    if (seenLineIds.has(line.sale_line_id)) {
      throw new EventValidationError(
        'duplicate_line_id',
        `Line ${line.sale_line_id} appears more than once in the sale.`,
      );
    }
    seenLineIds.add(line.sale_line_id);

    // Checked before BigInt(quantity): BigInt(1.5) throws a RangeError,
    // which would surface as 500 instead of 422.
    if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) {
      throw new EventValidationError(
        'invalid_quantity',
        `Line ${line.sale_line_id} must have a whole quantity above zero.`,
      );
    }

    // API contract: prices are nonnegative (free items are allowed).
    if (line.unit_price_minor < 0n) {
      throw new EventValidationError(
        'invalid_price',
        `Line ${line.sale_line_id} must have a unit price of zero or more.`,
      );
    }

    const expectedAmount = BigInt(line.quantity) * line.unit_price_minor;
    if (line.line_amount_minor !== expectedAmount) {
      throw new EventValidationError(
        'line_amount_mismatch',
        `Line ${line.sale_line_id} amount must equal quantity x unit price.`,
      );
    }
    // The line amount equals quantity x price here, so checking it also
    // covers the price; the DB CHECK multiplies them in bigint.
    if (line.line_amount_minor > MAX_MINOR_UNITS) {
      throw new EventValidationError(
        'amount_out_of_range',
        `Line ${line.sale_line_id} amount is too large to store.`,
      );
    }
    grossAmountMinor += line.line_amount_minor;
  }

  // Every line can fit while their sum (the receipt total) does not.
  if (grossAmountMinor > MAX_MINOR_UNITS) {
    throw new EventValidationError(
      'amount_out_of_range',
      'The sale total is too large to store.',
    );
  }
}
