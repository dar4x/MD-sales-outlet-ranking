export interface Flags {
  apiUrl: string;
  outlet?: string;
  rate: number;
  minLines: number;
  maxLines: number;
  duplicatePercent: number;
  outageEverySeconds: number;
  outageDurationSeconds: number;
  seed?: string;
}

export function parseFlags(
  args: string[],
  environment: Record<string, string | undefined>,
): Flags {
  const flags: Flags = {
    apiUrl: environment.SIMULATOR_API_URL ?? "http://127.0.0.1:3000/api",
    rate: 30,
    minLines: 1,
    maxLines: 4,
    duplicatePercent: 0,
    outageEverySeconds: 0,
    outageDurationSeconds: 0,
  };
  const seen = new Set<string>();
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index]!;
    const value = args[index + 1];
    if (value === undefined || value.trim() === "" || value.startsWith("--")) {
      throw new Error("Missing value for " + name);
    }
    if (seen.has(name)) throw new Error("Repeated flag: " + name);
    seen.add(name);
    switch (name) {
      case "--api-url":
        flags.apiUrl = value;
        break;
      case "--outlet":
        flags.outlet = value;
        break;
      case "--rate":
        flags.rate = Number(value);
        break;
      case "--min-lines":
        flags.minLines = Number(value);
        break;
      case "--max-lines":
        flags.maxLines = Number(value);
        break;
      case "--duplicate-percent":
        flags.duplicatePercent = Number(value);
        break;
      case "--outage-every-seconds":
        flags.outageEverySeconds = Number(value);
        break;
      case "--outage-duration-seconds":
        flags.outageDurationSeconds = Number(value);
        break;
      case "--seed":
        flags.seed = value;
        break;
      default:
        throw new Error("Unknown flag: " + name);
    }
  }
  const url = new URL(flags.apiUrl);
  if (!["http:", "https:"].includes(url.protocol) || url.search || url.hash) {
    throw new Error(
      "--api-url must be an HTTP(S) URL without query or fragment.",
    );
  }
  flags.apiUrl = flags.apiUrl.replace(/\/+$/, "");
  if (
    !Number.isFinite(flags.rate) ||
    flags.rate <= 0 ||
    60000 / flags.rate > 2147483647
  ) {
    throw new Error("--rate must be positive with a schedulable interval.");
  }
  if (
    !Number.isSafeInteger(flags.minLines) ||
    !Number.isSafeInteger(flags.maxLines) ||
    flags.minLines < 1 ||
    flags.maxLines < flags.minLines
  ) {
    throw new Error(
      "Line bounds must be positive integers with min-lines <= max-lines.",
    );
  }
  if (
    !Number.isFinite(flags.duplicatePercent) ||
    flags.duplicatePercent < 0 ||
    flags.duplicatePercent > 100
  ) {
    throw new Error("--duplicate-percent must be between 0 and 100.");
  }
  for (const seconds of [
    flags.outageEverySeconds,
    flags.outageDurationSeconds,
  ]) {
    if (
      !Number.isFinite(seconds) ||
      seconds < 0 ||
      seconds * 1000 > 2147483647
    ) {
      throw new Error("Outage seconds must be nonnegative and schedulable.");
    }
  }
  if (
    (flags.outageEverySeconds === 0) !== (flags.outageDurationSeconds === 0) ||
    (flags.outageEverySeconds > 0 &&
      flags.outageDurationSeconds >= flags.outageEverySeconds)
  ) {
    throw new Error(
      "Use both outage flags together; duration must be shorter than the interval.",
    );
  }
  return flags;
}
