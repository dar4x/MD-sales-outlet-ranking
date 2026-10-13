import assert from "node:assert/strict";
import { it } from "node:test";
import { parseFlags } from "../src/cli.js";
import { runSimulator } from "../src/loop.js";
import type { SaleReceipt } from "../src/types.js";
import { fakeServer } from "./fake-server.js";

await it("outage queues receipts then flushes in order with original occurred_at, including shutdown flush", async () => {
  const server = await fakeServer([]);
  const controller = new AbortController();
  const queued: { eventId: string; occurredAt: string }[] = [];
  let beforeOutage = 0;
  const timer = setTimeout(() => controller.abort(), 540);
  try {
    const flags = parseFlags(
      [
        "--api-url",
        server.url,
        "--rate",
        "4000",
        "--outage-every-seconds",
        "0.2",
        "--outage-duration-seconds",
        "0.15",
        "--seed",
        "outage",
      ],
      {},
    );
    const totals = await runSimulator(flags, controller.signal, (line) => {
      if (line.startsWith("outage started"))
        beforeOutage = server.bodies.length;
      const match = line.match(/^queued event_id=(\S+) occurred_at=(\S+)$/);
      if (match) {
        assert.equal(
          server.bodies.length,
          beforeOutage,
          "No POSTs during simulated outage",
        );
        queued.push({ eventId: match[1]!, occurredAt: match[2]! });
      }
    });
    assert.ok(queued.length >= 3);
    const receipts = server.bodies.map(
      (body) => JSON.parse(body) as SaleReceipt,
    );
    const late = receipts.filter((receipt) =>
      queued.some((item) => item.eventId === receipt.event_id),
    );
    assert.deepEqual(
      late.map((receipt) => ({
        eventId: receipt.event_id,
        occurredAt: receipt.occurred_at,
      })),
      queued,
    );
    assert.equal(totals.late, queued.length);
    assert.equal(totals.created, receipts.length);
    assert.equal(totals.failed, 0);
    assert.equal(totals.rejected, 0);
  } finally {
    clearTimeout(timer);
    controller.abort();
    await server.close();
  }
});
