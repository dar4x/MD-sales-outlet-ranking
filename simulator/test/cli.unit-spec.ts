import assert from "node:assert/strict";
import { it } from "node:test";
import { parseFlags } from "../src/cli.js";

await it("uses defaults, environment URL and explicit overrides", () => {
  const defaults = parseFlags([], {});
  assert.equal(defaults.apiUrl, "http://127.0.0.1:3000/api");
  assert.equal(defaults.rate, 30);
  assert.equal(defaults.minLines, 1);
  assert.equal(defaults.maxLines, 4);
  assert.equal(defaults.duplicatePercent, 0);
  assert.equal(defaults.outageEverySeconds, 0);
  assert.equal(defaults.outageDurationSeconds, 0);
  assert.equal(
    parseFlags([], { SIMULATOR_API_URL: "http://localhost:4000/api/" }).apiUrl,
    "http://localhost:4000/api",
  );
  const custom = parseFlags(
    [
      "--api-url",
      "http://localhost:3001/api",
      "--outlet",
      "Bishkek Center",
      "--rate",
      "60",
      "--min-lines",
      "2",
      "--max-lines",
      "5",
      "--duplicate-percent",
      "10",
      "--outage-every-seconds",
      "10",
      "--outage-duration-seconds",
      "3",
      "--seed",
      "abc",
    ],
    {},
  );
  assert.equal(custom.outlet, "Bishkek Center");
  assert.equal(custom.rate, 60);
  assert.equal(custom.seed, "abc");
});
await it("rejects unknown, repeated, missing, invalid and inconsistent flags", () => {
  for (const args of [
    ["--unknown", "1"],
    ["--rate"],
    ["--rate", "0"],
    ["--rate", "-1"],
    ["--rate", "NaN"],
    ["--rate", "Infinity"],
    ["--rate", "1", "--rate", "2"],
    ["--min-lines", "1.5"],
    ["--min-lines", "5", "--max-lines", "4"],
    ["--duplicate-percent", "101"],
    ["--duplicate-percent", "-1"],
    ["--outage-every-seconds", "5"],
    ["--outage-duration-seconds", "5"],
    ["--outage-every-seconds", "2", "--outage-duration-seconds", "3"],
    ["--api-url", "ftp://localhost/api"],
    ["--api-url", "http://localhost/api?x=1"],
    ["--outlet", ""],
    ["--seed", ""],
  ])
    assert.throws(() => parseFlags(args, {}));
});
