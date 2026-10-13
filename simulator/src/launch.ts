import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import process from "node:process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { parseFlags } from "./cli.js";
import { loadCatalogue } from "./http.js";

async function launch(): Promise<void> {
  const children: ChildProcess[] = [];
  let stopping = false;
  const stop = (): void => {
    stopping = true;
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null)
        child.kill("SIGTERM");
    }
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  try {
    const args = process.argv.slice(2);
    const flags = parseFlags(args, process.env);
    if (flags.outlet !== undefined)
      throw new Error("start:all selects outlets; use start for --outlet.");
    const { outlets } = await loadCatalogue(flags.apiUrl);
    if (stopping) return;
    const forwarded: string[] = [];
    for (let index = 0; index < args.length; index += 2) {
      if (args[index] !== "--rate")
        forwarded.push(args[index]!, args[index + 1]!);
    }
    const firstRate = args.includes("--rate") ? flags.rate : 20;
    const finished: Promise<void>[] = [];
    for (let index = 0; index < Math.min(5, outlets.length); index += 1) {
      const outlet = outlets[index]!;
      const child = spawn(
        process.execPath,
        [
          fileURLToPath(new URL("./main.js", import.meta.url)),
          ...forwarded,
          "--outlet",
          outlet.outlet_id,
          "--rate",
          String(firstRate + index * 10),
        ],
        { stdio: ["ignore", "pipe", "pipe"] },
      );
      children.push(child);
      for (const stream of [child.stdout, child.stderr]) {
        createInterface({ input: stream }).on("line", (line) => {
          console.log("[" + outlet.name + "] " + line);
        });
      }
      finished.push(
        new Promise<void>((resolve) => {
          child.on("error", (error) => {
            console.error("[" + outlet.name + "] " + error.message);
            process.exitCode = 1;
            stop();
          });
          child.on("close", (code) => {
            if (code !== 0 && !stopping) {
              process.exitCode = 1;
              stop();
            }
            resolve();
          });
        }),
      );
    }
    await Promise.all(finished);
  } finally {
    stop();
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
  }
}

launch().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
