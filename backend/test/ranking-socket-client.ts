/* External deps */
import { setTimeout as delay } from 'node:timers/promises';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
/* Internal deps */
import type { RankingSnapshot } from '../src/rankings/application/read-models/ranking.js';

// A real Socket.IO client, declared locally as a backend test dependency.
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
