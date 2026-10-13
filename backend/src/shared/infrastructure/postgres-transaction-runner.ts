/* External deps */
import type { DataSource } from 'typeorm';

/* Internal deps */
import { PostgresEventLedgerRepository } from '../../events/infrastructure/postgres-event-ledger.repository.js';
import { PostgresOutletActivityRepository } from '../../events/infrastructure/postgres-outlet-activity.repository.js';
import { PostgresSaleReceiptRepository } from '../../events/infrastructure/postgres-sale-receipt.repository.js';
import { PostgresProductLookup } from '../../products/infrastructure/postgres-product-lookup.js';
import type {
  TransactionPorts,
  TransactionRunner,
} from '../application/ports/transaction-runner.js';

export class PostgresTransactionRunner implements TransactionRunner {
  constructor(private readonly dataSource: DataSource) {}

  run<Result>(
    operation: (ports: TransactionPorts) => Promise<Result>,
  ): Promise<Result> {
    return this.dataSource.transaction((manager) => {
      const ports: TransactionPorts = {
        events: new PostgresEventLedgerRepository(manager),
        receipts: new PostgresSaleReceiptRepository(manager),
        activity: new PostgresOutletActivityRepository(manager),
        products: new PostgresProductLookup(manager),
      };
      return operation(ports);
    });
  }
}
