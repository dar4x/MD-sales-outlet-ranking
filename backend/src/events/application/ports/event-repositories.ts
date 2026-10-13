/* Internal deps */
import type {
  Identifier,
  UtcTimestamp,
} from '../../../shared/domain/value-types.js';
import type {
  AcceptedEvent,
  ReturnEvent,
  SaleReceipt,
  StoredEvent,
} from '../../domain/event.js';
export interface EventLedgerRepository {
  find(eventId: Identifier): Promise<StoredEvent | null>;
  insert(event: AcceptedEvent): Promise<'inserted' | 'event_conflict'>;
}
export interface SaleReceiptRepository {
  findForUpdate(receiptId: Identifier): Promise<SaleReceipt | null>;
  insert(receipt: SaleReceipt): Promise<'inserted' | 'receipt_conflict'>;
  saveReturn(receipt: SaleReceipt, event: ReturnEvent): Promise<void>;
}
export interface OutletActivityRepository {
  lock(outletId: Identifier): Promise<boolean>;
  recordAccepted(outletId: Identifier, acceptedAt: UtcTimestamp): Promise<void>;
}
