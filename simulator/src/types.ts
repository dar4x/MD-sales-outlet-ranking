// Independent HTTP shapes. The simulator imports no backend code.
export interface Product {
  product_id: string;
  sku: string;
  name: string;
  unit_price_minor: string;
}
export interface Outlet {
  outlet_id: string;
  name: string;
  time_zone: string;
}
export interface SaleReceipt {
  kind: "sale";
  event_id: string;
  receipt_id: string;
  outlet_id: string;
  occurred_at: string;
  lines: {
    sale_line_id: string;
    product_id: string;
    quantity: number;
    unit_price_minor: string;
    line_amount_minor: string;
  }[];
}
export interface Totals {
  created: number;
  duplicates: number;
  rejected: number;
  failed: number;
  late: number;
}
