import { isProductList } from '../types/products';
import type { Product } from '../types/products';
import { getJson } from './http-client';

export async function getProducts(signal: AbortSignal): Promise<Product[]> {
  const payload = await getJson('products', signal);
  if (!isProductList(payload)) throw new Error('Unexpected products response.');
  return payload.items;
}
