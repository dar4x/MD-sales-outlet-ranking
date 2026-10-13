import type {
  EventLedgerRepository,
  OutletActivityRepository,
  SaleReceiptRepository,
} from '../../../events/application/ports/event-repositories.js';
import type { ProductLookup } from '../../../products/application/ports/product-catalogue.js';
import type { OutletRepository } from '../../../outlets/application/ports/outlet-repositories.js';
import type {
  AlertEpisodeRepository,
  MiddayAssessmentRepository,
} from '../../../alerts/application/ports/alert-repositories.js';
import type { AlertEvaluationQuery } from '../../../alerts/application/ports/alert-evaluation-query.js';
import type { OutboxRepository } from '../../../notifications/application/ports/outbox-ports.js';
export interface TransactionPorts {
  events: EventLedgerRepository;
  receipts: SaleReceiptRepository;
  activity: OutletActivityRepository;
  products: ProductLookup;
  outlets: OutletRepository;
  episodes: AlertEpisodeRepository;
  assessments: MiddayAssessmentRepository;
  alertEvaluation: AlertEvaluationQuery;
  outbox: OutboxRepository;
}
export interface TransactionRunner {
  run<Result>(
    operation: (ports: TransactionPorts) => Promise<Result>,
  ): Promise<Result>;
}
