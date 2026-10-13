import type {
  EventLedgerRepository,
  SaleReceiptRepository,
} from '../../../events/application/ports/event-repositories.js';
// Only ports implemented so far; add outlets, alerts, outbox here
// when their features arrive.
export interface TransactionPorts {
  events: EventLedgerRepository;
  receipts: SaleReceiptRepository;
}
export interface TransactionRunner {
  run<Result>(
    operation: (ports: TransactionPorts) => Promise<Result>,
  ): Promise<Result>;
}
