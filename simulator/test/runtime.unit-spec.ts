import assert from "node:assert/strict";
import process from "node:process";
import { it } from "node:test";

await it("runs on Node 24 or newer", () => {
  assert.ok(Number(process.versions.node.split(".")[0]) >= 24);
});
