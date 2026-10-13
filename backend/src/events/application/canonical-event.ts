/* External deps */
import { createHash } from 'node:crypto';

/* Internal deps */
import type { SaleInput } from '../domain/event.js';

// Builds one fixed text form of a sale so that retries which differ only in
// JSON key order, line order or time zone offset produce the same hash.
// Only client-sent business fields are included; accepted_at is server-set.
export function canonicalizeSale(input: SaleInput): string {
  const sortedLines = [...input.lines].sort((left, right) => {
    if (left.sale_line_id < right.sale_line_id) {
      return -1;
    }
    if (left.sale_line_id > right.sale_line_id) {
      return 1;
    }
    return 0;
  });

  // Keys are written in alphabetical order by hand; JSON.stringify keeps
  // insertion order, so the output text is always the same.
  const canonicalLines = [];
  for (const line of sortedLines) {
    canonicalLines.push({
      line_amount_minor: line.line_amount_minor.toString(),
      product_id: line.product_id,
      quantity: line.quantity,
      sale_line_id: line.sale_line_id,
      unit_price_minor: line.unit_price_minor.toString(),
    });
  }

  const canonicalSale = {
    event_id: input.event_id,
    kind: input.kind,
    lines: canonicalLines,
    // Same instant with a different offset becomes the same UTC string.
    occurred_at: new Date(input.occurred_at).toISOString(),
    outlet_id: input.outlet_id,
    receipt_id: input.receipt_id,
  };
  return JSON.stringify(canonicalSale);
}

export function hashPayload(canonicalPayload: string): string {
  return createHash('sha256').update(canonicalPayload).digest('hex');
}
