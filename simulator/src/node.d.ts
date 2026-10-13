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
declare module "node:http" {
  export interface IncomingMessage {
    url?: string;
    method?: string;
    socket: { destroy(): void };
    setEncoding(encoding: string): void;
    on(event: "data", listener: (chunk: string) => void): void;
    on(event: "end", listener: () => void): void;
  }
  export interface ServerResponse {
    statusCode: number;
    setHeader(name: string, value: string): void;
    end(body?: string): void;
  }
  export interface Server {
    listen(port: number, host: string, callback: () => void): void;
    address(): { port: number } | null;
    close(callback: (error?: Error) => void): void;
    closeAllConnections(): void;
  }
  export function createServer(
    handler: (request: IncomingMessage, response: ServerResponse) => void,
  ): Server;
}
declare module "node:child_process" {
  export interface ChildProcess {
    stdout: {
      setEncoding(encoding: string): void;
      on(event: "data", listener: (chunk: string) => void): void;
    };
    stderr: ChildProcess["stdout"];
    exitCode: number | null;
    signalCode: string | null;
    kill(signal: string): boolean;
    on(event: "close", listener: (code: number | null) => void): void;
    on(event: "error", listener: (error: Error) => void): void;
  }
  export function spawn(
    command: string,
    args: string[],
    options: {
      stdio: ["ignore", "pipe", "pipe"];
    },
  ): ChildProcess;
}
declare module "node:readline" {
  import type { ChildProcess } from "node:child_process";
  export function createInterface(options: { input: ChildProcess["stdout"] }): {
    on(event: "line", listener: (line: string) => void): void;
  };
}
declare module "node:url" {
  export function fileURLToPath(url: URL): string;
}
