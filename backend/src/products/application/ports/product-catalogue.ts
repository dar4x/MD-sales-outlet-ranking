import type { Identifier } from '../../../shared/domain/value-types.js';
import type { Product } from '../../domain/product.js';
export interface ProductLookup {
  find(productId: Identifier): Promise<Product | null>;
}
export interface ProductCatalogueQuery {
  list(): Promise<Product[]>;
}
