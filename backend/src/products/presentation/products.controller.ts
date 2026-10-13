/* External deps */
import { Controller, Get, UseFilters } from '@nestjs/common';
/* Internal deps */
import { ListProducts } from '../application/list-products.js';
import { EventErrorsFilter } from '../../events/presentation/event-errors.filter.js';

@Controller('products')
@UseFilters(EventErrorsFilter)
export class ProductsController {
  constructor(private readonly listProducts: ListProducts) {}

  @Get()
  async list(): Promise<{
    items: {
      product_id: string;
      sku: string;
      name: string;
      unit_price_minor: string;
    }[];
  }> {
    const products = await this.listProducts.execute();
    const items = [];
    for (const product of products) {
      items.push({
        ...product,
        unit_price_minor: product.unit_price_minor.toString(),
      });
    }
    return { items };
  }
}
