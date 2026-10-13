/* Internal deps */
import type { RankingRefreshRequester } from '../../rankings/application/ports/ranking-ports.js';
import type { Clock } from '../../shared/application/ports/clock.js';
import type { TransactionRunner } from '../../shared/application/ports/transaction-runner.js';
import { createSaleReceipt } from '../domain/create-sale-receipt.js';
import {
  EventConflictError,
  EventValidationError,
  ReceiptConflictError,
} from '../domain/event-errors.js';
import type { Acceptance, SaleInput, EventInput } from '../domain/event.js';
import { validateReturn, calculateReturn } from '../domain/validate-return.js';
import { validateSale } from '../domain/validate-sale.js';
import {
  canonicalizeSale,
  canonicalizeReturn,
  hashPayload,
} from './canonical-event.js';
import type { EventLedgerRepository } from './ports/event-repositories.js';
import type { ProductLookup } from '../../products/application/ports/product-catalogue.js';

export interface IngestEventResult {
  outcome: 'created' | 'duplicate';
  acceptance: Acceptance;
}

export class IngestEvent {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly clock: Clock,
    private readonly refreshRequester: RankingRefreshRequester,
  ) {}

  async execute(sale: EventInput): Promise<IngestEventResult> {
    // Validate first: a broken sale must give 422, and canonicalizeSale
    // would throw on an unparsable date.
    if (sale.kind === 'sale') validateSale(sale);
    else validateReturn(sale);

    const receipt = sale.kind === 'sale' ? createSaleReceipt(sale) : null;
    const canonicalPayload =
      sale.kind === 'sale' ? canonicalizeSale(sale) : canonicalizeReturn(sale);
    const payloadHash = hashPayload(canonicalPayload);
    const acceptance: Acceptance = {
      event_id: sale.event_id,
      outlet_id: sale.outlet_id,
      kind: sale.kind,
      accepted_at: this.clock.now(),
      amount_minor: receipt?.gross_amount_minor ?? 0n,
      duplicate: false,
    };

    const result = await this.transactions.run<IngestEventResult>(
      async (ports) => {
        // The outlet row is locked first, so every event of one outlet takes
        // locks in the same order: outlet, then ledger, then receipt.
        const outletExists = await ports.activity.lock(sale.outlet_id);
        if (!outletExists) {
          // The ledger has a foreign key to outlets, so no insert is possible.
          // Reading it only picks the error code: the contract says a changed
          // payload for a known event_id is 409. Nothing is written after
          // this read, so it cannot race another insert.
          const storedForUnknownOutlet = await ports.events.find(sale.event_id);
          if (storedForUnknownOutlet !== null) {
            throw new EventConflictError(sale.event_id);
          }
          throw new EventValidationError(
            'unknown_outlet',
            `Outlet ${sale.outlet_id} does not exist.`,
          );
        }

        // Never SELECT-then-INSERT: the event_id primary key decides which of
        // several concurrent requests is the new one.
        const insertResult = await ports.events.insert({
          event_id: sale.event_id,
          canonical_payload: canonicalPayload,
          payload_hash: payloadHash,
          input: sale,
          acceptance,
        });
        if (insertResult === 'event_conflict') {
          return this.handleRetry(sale.event_id, payloadHash, ports.events);
        }

        if (sale.kind === 'sale' && receipt !== null) {
          await this.checkProducts(sale, ports.products);
          const receiptResult = await ports.receipts.insert(receipt);
          if (receiptResult === 'receipt_conflict')
            throw new ReceiptConflictError(sale.receipt_id);
        } else if (sale.kind === 'return') {
          const original = await ports.receipts.findForUpdate(
            sale.sale_receipt_id,
          );
          if (original === null)
            throw new EventValidationError(
              'unknown_receipt',
              'The sale receipt does not exist.',
            );
          const refund = calculateReturn(sale, original);
          await ports.receipts.saveReturn(refund);
          acceptance.amount_minor = refund.amount_minor;
          await ports.events.updateAmount(sale.event_id, refund.amount_minor);
        }

        // Only a newly accepted event reaches this line: retries, conflicts
        // and validation failures returned or threw above, so they never
        // refresh outlet activity.
        await ports.activity.recordAccepted(
          sale.outlet_id,
          acceptance.accepted_at,
        );
        return { outcome: 'created', acceptance };
      },
    );
    // TransactionRunner resolves only after commit; retries never request a read.
    if (result.outcome === 'created') {
      this.refreshRequester.request();
    }
    return result;
  }

  private async handleRetry(
    eventId: string,
    payloadHash: string,
    events: EventLedgerRepository,
  ): Promise<IngestEventResult> {
    const stored = await events.find(eventId);
    if (stored === null) {
      throw new Error(`Ledger row for event ${eventId} not found.`);
    }
    if (stored.payload_hash !== payloadHash) {
      throw new EventConflictError(eventId);
    }
    return {
      outcome: 'duplicate',
      acceptance: { ...stored.acceptance, duplicate: true },
    };
  }

  private async checkProducts(
    sale: SaleInput,
    products: ProductLookup,
  ): Promise<void> {
    for (const line of sale.lines) {
      const product = await products.find(line.product_id);
      if (product === null) {
        throw new EventValidationError(
          'unknown_product',
          `Line ${line.sale_line_id} refers to unknown product ${line.product_id}.`,
        );
      }
    }
  }
}
