/* External deps */
import type { EntityManager } from 'typeorm';

/* Internal deps */
import type { SaleReceiptRepository } from '../application/ports/event-repositories.js';
import type { SaleReceipt } from '../domain/event.js';

export class PostgresSaleReceiptRepository implements SaleReceiptRepository {
  constructor(private readonly manager: EntityManager) {}

  async insert(receipt: SaleReceipt): Promise<'inserted' | 'receipt_conflict'> {
    // ON CONFLICT instead of catching a unique violation: a failed statement
    // would abort the transaction, while DO NOTHING keeps it usable and lets
    // the caller decide. A concurrent insert of the same receipt_id waits
    // here until the other transaction commits or rolls back.
    const insertedRows: unknown[] = await this.manager.query(
      `INSERT INTO sale_receipts (
         receipt_id, event_id, outlet_id, occurred_at, gross_amount_minor
       )
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (receipt_id) DO NOTHING
       RETURNING receipt_id`,
      [
        receipt.receipt_id,
        receipt.event_id,
        receipt.outlet_id,
        receipt.occurred_at,
        receipt.gross_amount_minor.toString(),
      ],
    );
    if (insertedRows.length === 0) {
      return 'receipt_conflict';
    }

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
          // Sent as text like money: exact for any safe integer quantity.
          line.quantity.toString(),
          line.unit_price_minor.toString(),
          line.line_amount_minor.toString(),
        ],
      );
    }
    return 'inserted';
  }
}
