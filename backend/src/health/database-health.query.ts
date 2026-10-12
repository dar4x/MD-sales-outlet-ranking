/* External deps */
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';

@Injectable()
export class DatabaseHealthQuery {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async checkConnection(): Promise<void> {
    await this.dataSource.query('SELECT 1');
  }
}
