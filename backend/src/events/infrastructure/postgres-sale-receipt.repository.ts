/* External deps */
import type { EntityManager } from 'typeorm';

/* Internal deps */
import type { SaleReceiptRepository } from '../application/ports/event-repositories.js';
import type { SaleReceipt } from '../domain/event.js';

export class PostgresSaleReceiptRepository implements SaleReceiptRepository {
  constructor(private readonly manager: EntityManager) {}

  // Receipt-ID reuse is not detected yet: a duplicate receipt_id raises a
  // unique violation that rolls back the whole transaction.
  async insert(receipt: SaleReceipt): Promise<'inserted' | 'receipt_conflict'> {
    await this.manager.query(
      `INSERT INTO sale_receipts (
         receipt_id, event_id, outlet_id, occurred_at, gross_amount_minor
       )
       VALUES ($1, $2, $3, $4, $5)`,
      [
        receipt.receipt_id,
        receipt.event_id,
        receipt.outlet_id,
        receipt.occurred_at,
        receipt.gross_amount_minor.toString(),
      ],
    );

    // One INSERT per line keeps the SQL plain; receipts have few lines.
    for (const line of receipt.lines) {
      await this.manager.query(
        `INSERT INTO sale_lines (
           receipt_id, sale_line_id, product_id, quantity,
           unit_price_minor, line_amount_minor
         )
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          receipt.receipt_id,
          line.sale_line_id,
          line.product_id,
          line.quantity,
          line.unit_price_minor.toString(),
          line.line_amount_minor.toString(),
        ],
      );
    }
    return 'inserted';
  }
}
