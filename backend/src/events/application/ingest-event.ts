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
import type { Acceptance, SaleInput } from '../domain/event.js';
import { validateSale } from '../domain/validate-sale.js';
import { canonicalizeSale, hashPayload } from './canonical-event.js';
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

  async execute(sale: SaleInput): Promise<IngestEventResult> {
    // Validate first: a broken sale must give 422, and canonicalizeSale
    // would throw on an unparsable date.
    validateSale(sale);

    const receipt = createSaleReceipt(sale);
    const canonicalPayload = canonicalizeSale(sale);
    const payloadHash = hashPayload(canonicalPayload);
    const acceptance: Acceptance = {
      event_id: sale.event_id,
      outlet_id: sale.outlet_id,
      kind: 'sale',
      accepted_at: this.clock.now(),
      amount_minor: receipt.gross_amount_minor,
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

        // Products are checked only for a new event, after the identity check,
        // so a changed payload for a known event_id stays 409. Throwing here
        // rolls back the ledger row inserted above.
        await this.checkProducts(sale, ports.products);

        // Same transaction as the ledger row: if the receipt or any line
        // fails, the accepted event is rolled back too.
        const receiptResult = await ports.receipts.insert(receipt);
        if (receiptResult === 'receipt_conflict') {
          throw new ReceiptConflictError(sale.receipt_id);
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
