import assert from "node:assert/strict";
import { it } from "node:test";
import { buildReceipt } from "../src/receipt.js";
import { deliverReceipt } from "../src/loop.js";
import type { Totals } from "../src/types.js";
import { fakeServer } from "./fake-server.js";

await it("duplicate option sends the exact same body twice and counts the acknowledgment separately", async () => {
  const server = await fakeServer([201, 200]);
  const totals: Totals = {
    created: 0,
    duplicates: 0,
    rejected: 0,
    failed: 0,
    late: 0,
  };
  const receipt = buildReceipt(
    "outlet",
    [
      {
        product_id: "product",
        sku: "sku",
        name: "Product",
        unit_price_minor: "10",
      },
    ],
    1,
    1,
    new Date(),
    () => 0,
  );
  try {
    await deliverReceipt(
      server.url,
      receipt,
      totals,
      100,
      () => 0,
      () => {},
    );
    assert.equal(server.bodies.length, 2);
    assert.equal(server.bodies[0], JSON.stringify(receipt));
    assert.equal(server.bodies[1], server.bodies[0]);
    assert.equal(totals.created, 1);
    assert.equal(totals.duplicates, 1);
  } finally {
    await server.close();
  }
});
await it("does not resend a rejected receipt even with 100 percent duplicates", async () => {
  const server = await fakeServer([422]);
  const totals: Totals = {
    created: 0,
    duplicates: 0,
    rejected: 0,
    failed: 0,
    late: 0,
  };
  const receipt = buildReceipt(
    "outlet",
    [
      {
        product_id: "product",
        sku: "sku",
        name: "Product",
        unit_price_minor: "10",
      },
    ],
    1,
    1,
    new Date(),
    () => 0,
  );
  try {
    await deliverReceipt(
      server.url,
      receipt,
      totals,
      100,
      () => 0,
      () => {},
    );
    assert.equal(server.bodies.length, 1);
    assert.equal(totals.rejected, 1);
  } finally {
    await server.close();
  }
});
