/* External deps */
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import type { Socket } from '../../frontend/node_modules/socket.io-client/build/esm/index.js';
/* Internal deps */
import type { RankingSnapshot } from '../src/rankings/application/read-models/ranking.js';

// Reuse the existing frontend dependency; no backend dependency is added.
const require = createRequire(resolve('../frontend/package.json'));
const { io } =
  require('socket.io-client') as typeof import('../../frontend/node_modules/socket.io-client/build/esm/index.js');

export async function connect(url: string): Promise<Socket> {
  const socket = io(url, { transports: ['websocket'], reconnection: false });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error('Connect timeout'));
    }, 2000);
    socket.once('connect', () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once('connect_error', (error: Error) => {
      clearTimeout(timer);
      socket.close();
      reject(error);
    });
  });
  return socket;
}

export function acknowledge(
  socket: Socket,
  event: string,
  payload: unknown,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    socket
      .timeout(2000)
      .emit(event, payload, (error: Error | null, response: unknown) => {
        if (error) reject(error);
        else resolve(response);
      });
  });
}

export async function waitForSnapshots(
  snapshots: RankingSnapshot[],
  count: number,
): Promise<void> {
  const deadline = Date.now() + 3000;
  while (snapshots.length < count) {
    if (Date.now() >= deadline) throw new Error('Snapshot timeout');
    await delay(10);
  }
}
