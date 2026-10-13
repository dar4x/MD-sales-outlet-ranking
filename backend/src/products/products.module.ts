/* External deps */
import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
/* Internal deps */
import { DatabaseModule } from '../database/database.module.js';
import { ListProducts } from './application/list-products.js';
import { PostgresProductCatalogueQuery } from './infrastructure/postgres-product-catalogue.query.js';
import { ProductsController } from './presentation/products.controller.js';

@Module({
  imports: [DatabaseModule],
  controllers: [ProductsController],
  providers: [
    {
      provide: ListProducts,
      inject: [DataSource],
      useFactory: (dataSource: DataSource) =>
        new ListProducts(new PostgresProductCatalogueQuery(dataSource)),
    },
  ],
})
export class ProductsModule {}
