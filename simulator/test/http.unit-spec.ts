import assert from "node:assert/strict";
import { it } from "node:test";
import { sendReceipt } from "../src/http.js";
import { buildReceipt } from "../src/receipt.js";
import { fakeServer } from "./fake-server.js";

const receipt = buildReceipt(
  "outlet",
  [
    {
      product_id: "product",
      sku: "sku",
      name: "Product",
      unit_price_minor: "100",
    },
  ],
  1,
  1,
  new Date("2026-10-13T06:00:00Z"),
  () => 0,
);

await it("retries 503 and dropped connections with the identical event and serialized body", async () => {
  for (const failure of [503, "drop"] as const) {
    const server = await fakeServer([failure, 201]);
    try {
      assert.equal(await sendReceipt(server.url, receipt, () => {}), "created");
      assert.equal(server.bodies.length, 2);
      assert.equal(server.bodies[0], JSON.stringify(receipt));
      assert.equal(server.bodies[1], server.bodies[0]);
    } finally {
      await server.close();
    }
  }
});
await it("never retries 409 or 422 and logs their error bodies", async () => {
  for (const status of [409, 422]) {
    const server = await fakeServer([status]);
    const logs: string[] = [];
    try {
      assert.equal(
        await sendReceipt(server.url, receipt, (line) => {
          logs.push(line);
        }),
        "rejected",
      );
      assert.equal(server.bodies.length, 1);
      assert.ok(
        logs.some(
          (line) =>
            line.includes("test response") && line.includes(String(status)),
        ),
      );
    } finally {
      await server.close();
    }
  }
});
await it("recognizes duplicate acknowledgments and exhausts bounded retry attempts", async () => {
  const duplicate = await fakeServer([200]);
  try {
    assert.equal(
      await sendReceipt(duplicate.url, receipt, () => {}),
      "duplicate",
    );
  } finally {
    await duplicate.close();
  }
  const failed = await fakeServer([503, 503]);
  try {
    assert.equal(await sendReceipt(failed.url, receipt, () => {}, 2), "failed");
    assert.equal(failed.bodies.length, 2);
    assert.equal(failed.bodies[0], failed.bodies[1]);
  } finally {
    await failed.close();
  }
});
