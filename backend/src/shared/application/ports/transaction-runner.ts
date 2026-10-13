import type { EventLedgerRepository } from '../../../events/application/ports/event-repositories.js';
// Only ports implemented so far; add receipts, outlets, alerts, outbox here
// when their features arrive.
export interface TransactionPorts {
  events: EventLedgerRepository;
}
export interface TransactionRunner {
  run<Result>(
    operation: (ports: TransactionPorts) => Promise<Result>,
  ): Promise<Result>;
}
