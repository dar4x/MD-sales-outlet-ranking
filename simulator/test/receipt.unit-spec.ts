import assert from "node:assert/strict";
import { it } from "node:test";
import { buildReceipt, createRandom } from "../src/receipt.js";

const products = [
  {
    product_id: "p1",
    sku: "one",
    name: "One",
    unit_price_minor: "9007199254740993",
  },
  { product_id: "p2", sku: "two", name: "Two", unit_price_minor: "3" },
  { product_id: "p3", sku: "free", name: "Free", unit_price_minor: "0" },
];
await it("builds complete receipts with distinct products, fresh lowercase UUIDs and exact money", () => {
  const now = new Date("2026-10-13T06:00:00.123Z");
  const receipt = buildReceipt("outlet", products, 3, 4, now, () => 0.5);
  assert.equal(receipt.kind, "sale");
  assert.equal(receipt.outlet_id, "outlet");
  assert.equal(receipt.occurred_at, now.toISOString());
  assert.equal(receipt.lines.length, 3);
  const ids = [receipt.event_id, receipt.receipt_id];
  const selected = new Set<string>();
  for (const line of receipt.lines) {
    ids.push(line.sale_line_id);
    selected.add(line.product_id);
    assert.ok(Number.isSafeInteger(line.quantity) && line.quantity > 0);
    const product = products.find(
      (product) => product.product_id === line.product_id,
    )!;
    assert.equal(line.unit_price_minor, product.unit_price_minor);
    assert.equal(
      line.line_amount_minor,
      (BigInt(line.quantity) * BigInt(product.unit_price_minor)).toString(),
    );
  }
  assert.equal(selected.size, 3);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids)
    assert.match(
      id,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  const next = buildReceipt("outlet", products, 1, 1, now, () => 0);
  assert.ok(next.event_id !== receipt.event_id);
  assert.ok(next.receipt_id !== receipt.receipt_id);
  assert.equal(next.lines[0]!.line_amount_minor, "9007199254740993");
});
await it("rejects too few catalogue products and invalid line bounds", () => {
  for (const [min, max] of [
    [0, 1],
    [2, 1],
    [1.5, 2],
    [4, 5],
  ]) {
    assert.throws(() =>
      buildReceipt("outlet", products, min!, max!, new Date()),
    );
  }
});
await it("uses the seed for reproducible product and quantity choices", () => {
  const first = createRandom("same");
  const second = createRandom("same");
  for (let index = 0; index < 20; index += 1) assert.equal(first(), second());
});
