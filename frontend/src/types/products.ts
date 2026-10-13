import { isList, isMoney, isRecord, isString } from './validation';

export interface Product {
  product_id: string;
  sku: string;
  name: string;
  unit_price_minor: string;
}
export function isProduct(value: unknown): value is Product {
  return (
    isRecord(value) &&
    isString(value.product_id) &&
    isString(value.sku) &&
    isString(value.name) &&
    isMoney(value.unit_price_minor)
  );
}
export function isProductList(value: unknown): value is { items: Product[] } {
  return isList(value, isProduct);
}
