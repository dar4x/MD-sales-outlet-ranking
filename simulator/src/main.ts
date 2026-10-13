import process from "node:process";
import { parseFlags } from "./cli.js";
import { runSimulator } from "./loop.js";

const controller = new AbortController();
const stop = (): void => {
  controller.abort();
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
try {
  const flags = parseFlags(process.argv.slice(2), process.env);
  await runSimulator(flags, controller.signal);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  process.removeListener("SIGINT", stop);
  process.removeListener("SIGTERM", stop);
}
