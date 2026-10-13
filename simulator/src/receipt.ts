import { randomUUID } from "node:crypto";
import type { Product, SaleReceipt } from "./types.js";

export function createRandom(seed?: string): () => number {
  if (seed === undefined) return Math.random;
  let state = 0;
  for (const character of seed) {
    state = (Math.imul(state, 31) + character.charCodeAt(0)) >>> 0;
  }
  return () => {
    // A small seeded integer generator for choices, not for receipt identities.
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function buildReceipt(
  outletId: string,
  products: Product[],
  minLines: number,
  maxLines: number,
  occurredAt: Date,
  random: () => number = Math.random,
): SaleReceipt {
  if (
    !Number.isSafeInteger(minLines) ||
    !Number.isSafeInteger(maxLines) ||
    minLines < 1 ||
    maxLines < minLines ||
    products.length < minLines
  ) {
    throw new Error("Invalid line bounds or too few catalogue products.");
  }
  const available = [...products];
  const count =
    minLines +
    Math.floor(random() * (Math.min(maxLines, products.length) - minLines + 1));
  const lines: SaleReceipt["lines"] = [];
  for (let index = 0; index < count; index += 1) {
    const productIndex = Math.floor(random() * available.length);
    const product = available.splice(productIndex, 1)[0]!;
    const quantity = 1 + Math.floor(random() * 5);
    lines.push({
      sale_line_id: randomUUID(),
      product_id: product.product_id,
      quantity,
      unit_price_minor: product.unit_price_minor,
      line_amount_minor: (
        BigInt(quantity) * BigInt(product.unit_price_minor)
      ).toString(),
    });
  }
  return {
    kind: "sale",
    event_id: randomUUID(),
    receipt_id: randomUUID(),
    outlet_id: outletId,
    occurred_at: occurredAt.toISOString(),
    lines,
  };
}
