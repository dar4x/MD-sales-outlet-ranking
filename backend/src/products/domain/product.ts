import type {
  Identifier,
  MinorUnits,
} from '../../shared/domain/value-types.js';
export interface Product {
  product_id: Identifier;
  sku: string;
  name: string;
  unit_price_minor: MinorUnits;
}
