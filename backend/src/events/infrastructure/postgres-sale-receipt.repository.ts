/* External deps */
import type { EntityManager } from 'typeorm';

/* Internal deps */
import type { SaleReceiptRepository } from '../application/ports/event-repositories.js';
import type { SaleReceipt, ReturnEvent } from '../domain/event.js';

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
  async findForUpdate(receiptId: string): Promise<SaleReceipt | null> {
    const rows: {
      receipt_id: string;
      event_id: string;
      outlet_id: string;
      occurred_at: Date;
      gross_amount_minor: string;
    }[] = await this.manager.query(
      'SELECT * FROM sale_receipts WHERE receipt_id = $1 FOR UPDATE',
      [receiptId],
    );
    const row = rows[0];
    if (row === undefined) return null;
    const stored: {
      sale_line_id: string;
      product_id: string;
      quantity: string;
      unit_price_minor: string;
      line_amount_minor: string;
      returned_quantity: string;
      returned_amount_minor: string;
    }[] = await this.manager.query(
      'SELECT * FROM sale_lines WHERE receipt_id = $1 ORDER BY sale_line_id',
      [receiptId],
    );
    return {
      ...row,
      occurred_at: row.occurred_at.toISOString(),
      gross_amount_minor: BigInt(row.gross_amount_minor),
      lines: stored.map((line) => ({
        ...line,
        quantity: Number(line.quantity),
        unit_price_minor: BigInt(line.unit_price_minor),
        line_amount_minor: BigInt(line.line_amount_minor),
        returned_quantity: Number(line.returned_quantity),
        returned_amount_minor: BigInt(line.returned_amount_minor),
      })),
    };
  }
  async saveReturn(event: ReturnEvent): Promise<void> {
    await this.manager.query(
      `INSERT INTO return_events(event_id,outlet_id,sale_receipt_id,occurred_at,amount_minor)
      VALUES ($1,$2,$3,$4,$5)`,
      [
        event.event_id,
        event.outlet_id,
        event.sale_receipt_id,
        event.occurred_at,
        event.amount_minor.toString(),
      ],
    );
    for (const line of event.lines) {
      await this.manager.query(
        `INSERT INTO return_lines(event_id,return_line_id,sale_receipt_id,sale_line_id,quantity,amount_minor)
        VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          event.event_id,
          line.return_line_id,
          event.sale_receipt_id,
          line.sale_line_id,
          line.quantity.toString(),
          line.amount_minor.toString(),
        ],
      );
      await this.manager.query(
        `UPDATE sale_lines SET returned_quantity = returned_quantity + $3,
        returned_amount_minor = returned_amount_minor + $4 WHERE receipt_id = $1 AND sale_line_id = $2`,
        [
          event.sale_receipt_id,
          line.sale_line_id,
          line.quantity.toString(),
          line.amount_minor.toString(),
        ],
      );
    }
  }
}
