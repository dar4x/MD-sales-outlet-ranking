/* Internal deps */
import type { Clock } from '../../shared/application/ports/clock.js';
import type { TransactionRunner } from '../../shared/application/ports/transaction-runner.js';
import { EventConflictError } from '../domain/event-errors.js';
import type { Acceptance, SaleInput } from '../domain/event.js';
import { validateSale } from '../domain/validate-sale.js';
import { canonicalizeSale, hashPayload } from './canonical-event.js';

export interface IngestEventResult {
  outcome: 'created' | 'duplicate';
  acceptance: Acceptance;
}

export class IngestEvent {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly clock: Clock,
  ) {}

  async execute(sale: SaleInput): Promise<IngestEventResult> {
    // Validate first: a broken sale must give 422, and canonicalizeSale
    // would throw on an unparsable date.
    validateSale(sale);

    const canonicalPayload = canonicalizeSale(sale);
    const payloadHash = hashPayload(canonicalPayload);
    let amountMinor = 0n;
    for (const line of sale.lines) {
      amountMinor += line.line_amount_minor;
    }
    const acceptance: Acceptance = {
      event_id: sale.event_id,
      outlet_id: sale.outlet_id,
      kind: 'sale',
      accepted_at: this.clock.now(),
      amount_minor: amountMinor,
      duplicate: false,
    };

    return this.transactions.run(async (ports) => {
      // Insert first, never SELECT-then-INSERT: the event_id primary key
      // decides which of several concurrent requests is the new one.
      const insertResult = await ports.events.insert({
        event_id: sale.event_id,
        canonical_payload: canonicalPayload,
        payload_hash: payloadHash,
        input: sale,
        acceptance,
      });
      if (insertResult === 'inserted') {
        return { outcome: 'created', acceptance };
      }

      const stored = await ports.events.find(sale.event_id);
      if (stored === null) {
        // The insert just hit a conflict on this key, so the row must exist.
        throw new Error(`Ledger row for event ${sale.event_id} not found.`);
      }
      if (stored.payload_hash !== payloadHash) {
        throw new EventConflictError(sale.event_id);
      }
      // A retry returns the original acceptance, including its accepted_at.
      return {
        outcome: 'duplicate',
        acceptance: { ...stored.acceptance, duplicate: true },
      };
    });
  }
}
