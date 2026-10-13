import type {
  EventLedgerRepository,
  OutletActivityRepository,
  SaleReceiptRepository,
} from '../../../events/application/ports/event-repositories.js';
import type { ProductLookup } from '../../../products/application/ports/product-catalogue.js';
// Only ports implemented so far; add outlets, alerts, outbox here
// when their features arrive.
export interface TransactionPorts {
  events: EventLedgerRepository;
  receipts: SaleReceiptRepository;
  activity: OutletActivityRepository;
  products: ProductLookup;
}
export interface TransactionRunner {
  run<Result>(
    operation: (ports: TransactionPorts) => Promise<Result>,
  ): Promise<Result>;
}
