/* Internal deps */
import type { ReceiptLine, SaleInput, SaleReceipt } from './event.js';

// Turns a validated sale into the receipt aggregate. Revenue is the sum of
// the validated line amounts; nothing is returned yet on a new receipt.
export function createSaleReceipt(sale: SaleInput): SaleReceipt {
  let grossAmountMinor = 0n;
  const lines: ReceiptLine[] = [];
  for (const line of sale.lines) {
    grossAmountMinor += line.line_amount_minor;
    lines.push({
      sale_line_id: line.sale_line_id,
      product_id: line.product_id,
      quantity: line.quantity,
      unit_price_minor: line.unit_price_minor,
      line_amount_minor: line.line_amount_minor,
      returned_quantity: 0,
      returned_amount_minor: 0n,
    });
  }

  return {
    receipt_id: sale.receipt_id,
    event_id: sale.event_id,
    outlet_id: sale.outlet_id,
    occurred_at: sale.occurred_at,
    gross_amount_minor: grossAmountMinor,
    lines,
  };
}
