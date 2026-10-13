// Only the Node APIs used by this script; no @types/node dependency is allowed.
declare module "node:process" {
  const process: {
    versions: { node: string };
    argv: string[];
    env: Record<string, string | undefined>;
    execPath: string;
    exitCode: number;
    on(signal: string, listener: () => void): void;
    removeListener(signal: string, listener: () => void): void;
  };
  export default process;
}
declare module "node:test" {
  export function it(
    name: string,
    test: () => void | Promise<void>,
  ): Promise<void>;
}
declare module "node:assert/strict" {
  const assert: {
    equal(actual: unknown, expected: unknown, message?: string): void;
    deepEqual(actual: unknown, expected: unknown, message?: string): void;
    ok(value: unknown, message?: string): asserts value;
    throws(fn: () => unknown, expected?: RegExp): void;
    rejects(
      fn: Promise<unknown> | (() => Promise<unknown>),
      expected?: RegExp,
    ): Promise<void>;
    match(value: string, pattern: RegExp): void;
  };
  export default assert;
}
declare module "node:crypto" {
  export function randomUUID(): string;
}
