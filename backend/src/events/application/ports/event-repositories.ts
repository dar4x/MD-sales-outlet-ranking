/* Internal deps */
import type { Identifier } from '../../../shared/domain/value-types.js';
import type {
  AcceptedEvent,
  SaleReceipt,
  StoredEvent,
} from '../../domain/event.js';
export interface EventLedgerRepository {
  find(eventId: Identifier): Promise<StoredEvent | null>;
  insert(event: AcceptedEvent): Promise<'inserted' | 'event_conflict'>;
}
// Return methods (findForUpdate, saveReturn) are added with the returns feature.
export interface SaleReceiptRepository {
  insert(receipt: SaleReceipt): Promise<'inserted' | 'receipt_conflict'>;
}
// recordAccepted (last_accepted_at) is added with the outlet activity step.
export interface OutletActivityRepository {
  lock(outletId: Identifier): Promise<boolean>;
}
