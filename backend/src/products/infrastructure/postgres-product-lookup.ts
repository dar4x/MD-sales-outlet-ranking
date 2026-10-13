/* External deps */
import type { EntityManager } from 'typeorm';

/* Internal deps */
import type { ProductLookup } from '../application/ports/product-catalogue.js';
import type { Product } from '../domain/product.js';

// node-postgres returns bigint columns as strings.
interface ProductRow {
  product_id: string;
  sku: string;
  name: string;
  unit_price_minor: string;
}

export class PostgresProductLookup implements ProductLookup {
  constructor(private readonly manager: EntityManager) {}

  async find(productId: string): Promise<Product | null> {
    const rows: ProductRow[] = await this.manager.query(
      `SELECT product_id, sku, name, unit_price_minor
       FROM products
       WHERE product_id = $1`,
      [productId],
    );

    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    return {
      product_id: row.product_id,
      sku: row.sku,
      name: row.name,
      unit_price_minor: BigInt(row.unit_price_minor),
    };
  }
}
