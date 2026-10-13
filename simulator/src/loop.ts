import type { Flags } from "./cli.js";
import { loadCatalogue, sendReceipt } from "./http.js";
import { buildReceipt, createRandom } from "./receipt.js";
import type { SaleReceipt, Totals } from "./types.js";

export async function deliverReceipt(
  apiUrl: string,
  receipt: SaleReceipt,
  totals: Totals,
  duplicatePercent = 0,
  random: () => number = Math.random,
  log: (message: string) => void = console.log,
): Promise<boolean> {
  const outcome = await sendReceipt(apiUrl, receipt, log);
  if (outcome === "created") totals.created += 1;
  else if (outcome === "duplicate") totals.duplicates += 1;
  else if (outcome === "rejected") totals.rejected += 1;
  else totals.failed += 1;
  const succeeded = outcome === "created" || outcome === "duplicate";
  if (succeeded && random() * 100 < duplicatePercent) {
    const duplicate = await sendReceipt(apiUrl, receipt, log);
    if (duplicate === "duplicate") totals.duplicates += 1;
    else if (duplicate === "created") {
      totals.created += 1;
      log("Duplicate resend unexpectedly returned 201; expected 200.");
    } else if (duplicate === "rejected") totals.rejected += 1;
    else totals.failed += 1;
  }
  return succeeded;
}

export async function runSimulator(
  flags: Flags,
  signal: AbortSignal,
  log: (message: string) => void = console.log,
): Promise<Totals> {
  const { outlets, products } = await loadCatalogue(flags.apiUrl);
  let outlet = outlets[0]!;
  if (flags.outlet !== undefined) {
    const selected = outlets.find(
      (item) => item.outlet_id === flags.outlet || item.name === flags.outlet,
    );
    if (selected === undefined)
      throw new Error("Unknown outlet: " + flags.outlet);
    outlet = selected;
  }
  if (products.length < flags.minLines)
    throw new Error("Too few catalogue products for --min-lines.");
  const random = createRandom(flags.seed);
  const totals: Totals = {
    created: 0,
    duplicates: 0,
    rejected: 0,
    failed: 0,
    late: 0,
  };
  const queue: { receipt: SaleReceipt; late: boolean }[] = [];
  let offline = false;
  let nextOutageAt = Date.now() + flags.outageEverySeconds * 1000;
  let outageUntil = 0;
  const flush = async (): Promise<void> => {
    while (queue.length > 0) {
      const pending = queue[0]!;
      const succeeded = await deliverReceipt(
        flags.apiUrl,
        pending.receipt,
        totals,
        flags.duplicatePercent,
        random,
        log,
      );
      if (pending.late && succeeded) {
        totals.late += 1;
        log(
          "late event_id=" +
            pending.receipt.event_id +
            " occurred_at=" +
            pending.receipt.occurred_at,
        );
      }
      queue.shift();
    }
  };
  const printStats = (prefix: string): void => {
    log(
      prefix +
        " outlet=" +
        outlet.name +
        " created=" +
        totals.created +
        " duplicates=" +
        totals.duplicates +
        " rejected=" +
        totals.rejected +
        " failed=" +
        totals.failed +
        " late=" +
        totals.late +
        " queued=" +
        queue.length,
    );
  };
  const statsTimer = setInterval(() => printStats("stats"), 10000);
  try {
    log("started outlet=" + outlet.name + " rate=" + flags.rate);
    while (!signal.aborted) {
      const now = Date.now();
      if (offline && now >= outageUntil) {
        offline = false;
        log("outage ended; flushing " + queue.length + " queued receipts");
      }
      if (!offline && flags.outageEverySeconds > 0 && now >= nextOutageAt) {
        offline = true;
        outageUntil = now + flags.outageDurationSeconds * 1000;
        nextOutageAt = now + flags.outageEverySeconds * 1000;
        log("outage started outlet=" + outlet.name);
      }
      const receipt = buildReceipt(
        outlet.outlet_id,
        products,
        flags.minLines,
        flags.maxLines,
        new Date(),
        random,
      );
      queue.push({ receipt, late: offline });
      if (offline) {
        log(
          "queued event_id=" +
            receipt.event_id +
            " occurred_at=" +
            receipt.occurred_at,
        );
      } else {
        await flush();
      }
      // Jitter changes timing only; money arithmetic stays in BigInt.
      const interval = Math.max(
        1,
        (60000 / flags.rate) * (0.7 + random() * 0.6),
      );
      await new Promise<void>((resolve) => {
        const stop = (): void => {
          clearTimeout(timer);
          signal.removeEventListener("abort", stop);
          resolve();
        };
        const timer = setTimeout(stop, interval);
        if (signal.aborted) stop();
        else signal.addEventListener("abort", stop, { once: true });
      });
    }
    // Shutdown ignores the simulated outage and attempts every pending receipt.
    await flush();
    printStats("final");
    return totals;
  } finally {
    clearInterval(statsTimer);
  }
}
