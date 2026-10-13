/* External deps */
import type { DataSource } from 'typeorm';

/* Internal deps */
import { PostgresEventLedgerRepository } from '../../events/infrastructure/postgres-event-ledger.repository.js';
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
      };
      return operation(ports);
    });
  }
}
