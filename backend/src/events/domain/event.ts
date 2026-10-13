import type {
  EventKind,
  Identifier,
  MinorUnits,
  UtcTimestamp,
} from '../../shared/domain/value-types.js';
export interface SaleLine {
  sale_line_id: Identifier;
  product_id: Identifier;
  quantity: number;
  unit_price_minor: MinorUnits;
  line_amount_minor: MinorUnits;
}
export interface SaleInput {
  kind: 'sale';
  event_id: Identifier;
  receipt_id: Identifier;
  outlet_id: Identifier;
  occurred_at: UtcTimestamp;
  lines: SaleLine[];
}
export interface ReturnInputLine {
  return_line_id: Identifier;
  sale_line_id: Identifier;
  quantity: number;
}
export interface ReturnInput {
  kind: 'return';
  event_id: Identifier;
  outlet_id: Identifier;
  occurred_at: UtcTimestamp;
  sale_receipt_id: Identifier;
  lines: ReturnInputLine[];
}
export type EventInput = SaleInput | ReturnInput;
export interface ReceiptLine extends SaleLine {
  returned_quantity: number;
  returned_amount_minor: MinorUnits;
}
export interface SaleReceipt {
  receipt_id: Identifier;
  event_id: Identifier;
  outlet_id: Identifier;
  occurred_at: UtcTimestamp;
  gross_amount_minor: MinorUnits;
  lines: ReceiptLine[];
}
export interface ReturnLine extends ReturnInputLine {
  amount_minor: MinorUnits;
}
export interface ReturnEvent extends Omit<ReturnInput, 'lines'> {
  amount_minor: MinorUnits;
  lines: ReturnLine[];
}
export interface Acceptance {
  event_id: Identifier;
  outlet_id: Identifier;
  kind: EventKind;
  accepted_at: UtcTimestamp;
  amount_minor: MinorUnits;
  duplicate: boolean;
}
export interface AcceptedEvent {
  event_id: Identifier;
  canonical_payload: string;
  payload_hash: string;
  input: EventInput;
  acceptance: Acceptance;
}
