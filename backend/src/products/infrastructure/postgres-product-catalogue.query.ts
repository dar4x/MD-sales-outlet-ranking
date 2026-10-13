/* External deps */
import type { DataSource } from 'typeorm';
/* Internal deps */
import type { ProductCatalogueQuery } from '../application/ports/product-catalogue.js';
import type { Product } from '../domain/product.js';

export class PostgresProductCatalogueQuery implements ProductCatalogueQuery {
  constructor(private readonly dataSource: DataSource) {}

  async list(): Promise<Product[]> {
    const rows: {
      product_id: string;
      sku: string;
      name: string;
      unit_price_minor: string;
    }[] = await this.dataSource.query(
      'SELECT product_id, sku, name, unit_price_minor FROM products ORDER BY product_id',
    );
    const products: Product[] = [];
    for (const row of rows) {
      products.push({ ...row, unit_price_minor: BigInt(row.unit_price_minor) });
    }
    return products;
  }
}
