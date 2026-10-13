/* Internal deps */
import type { ProductCatalogueQuery } from './ports/product-catalogue.js';
import type { Product } from '../domain/product.js';

export class ListProducts {
  constructor(private readonly catalogue: ProductCatalogueQuery) {}

  execute(): Promise<Product[]> {
    return this.catalogue.list();
  }
}
