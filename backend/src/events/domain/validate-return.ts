import { EventValidationError } from './event-errors.js';
import type { ReturnInput, ReturnEvent, SaleReceipt } from './event.js';

export function validateReturn(input: ReturnInput): void {
  if (input.lines.length === 0)
    throw new EventValidationError(
      'empty_lines',
      'A return needs at least one line.',
    );
  const ids = new Set<string>();
  for (const line of input.lines) {
    if (ids.has(line.return_line_id))
      throw new EventValidationError(
        'duplicate_line_id',
        'Return line IDs must be unique.',
      );
    ids.add(line.return_line_id);
    if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) {
      throw new EventValidationError(
        'invalid_quantity',
        'Return quantity must be a positive safe integer.',
      );
    }
  }
}
export function calculateReturn(
  input: ReturnInput,
  receipt: SaleReceipt,
): ReturnEvent {
  if (receipt.outlet_id !== input.outlet_id)
    throw new EventValidationError(
      'wrong_outlet',
      'The receipt belongs to another outlet.',
    );
  if (Date.parse(input.occurred_at) < Date.parse(receipt.occurred_at)) {
    throw new EventValidationError(
      'return_before_sale',
      'A return cannot predate its sale.',
    );
  }
  const result: ReturnEvent = { ...input, amount_minor: 0n, lines: [] };
  for (const requested of input.lines) {
    const line = receipt.lines.find(
      (item) => item.sale_line_id === requested.sale_line_id,
    );
    if (line === undefined)
      throw new EventValidationError(
        'unknown_sale_line',
        'The sale line is not in this receipt.',
      );
    const amount = BigInt(requested.quantity) * line.unit_price_minor;
    if (
      requested.quantity > line.quantity - line.returned_quantity ||
      amount > line.line_amount_minor - line.returned_amount_minor
    ) {
      throw new EventValidationError(
        'return_limit',
        'Return exceeds the remaining quantity or amount.',
      );
    }
    // Update the loaded aggregate too, so repeated references in one return share the same remaining cap.
    line.returned_quantity += requested.quantity;
    line.returned_amount_minor += amount;
    result.lines.push({ ...requested, amount_minor: amount });
    result.amount_minor += amount;
  }
  return result;
}
