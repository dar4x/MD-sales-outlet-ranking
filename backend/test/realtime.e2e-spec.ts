/* External deps */
import { NestFactory } from '@nestjs/core';
import assert from 'node:assert/strict';
import test from 'node:test';
import 'reflect-metadata';

/* Internal deps */
import { AppModule } from '../src/app.module.js';
import { configureApplication } from '../src/configure-application.js';

function continueHandshake(socket: WebSocket, packet: string): void {
  if (packet.startsWith('0')) {
    // Engine.IO opened; connect to Socket.IO's default namespace.
    socket.send('40');
    return;
  }

  if (packet.startsWith('40')) {
    // Socket.IO connected; send the application ping event.
    socket.send('42["ping"]');
    return;
  }

  if (packet === '2') {
    socket.send('3');
  }
}

function waitForSocketEvent(socket: WebSocket): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timed out waiting for Socket.IO pong'));
    }, 5000);
    const handleError = (): void => {
      clearTimeout(timeout);
      reject(new Error('WebSocket connection failed'));
    };
    socket.addEventListener('error', handleError, { once: true });

    socket.addEventListener('message', (event) => {
      const packet: unknown = event.data;
      if (typeof packet !== 'string') {
        return;
      }
      if (packet.startsWith('42')) {
        clearTimeout(timeout);
        resolve(packet);
        return;
      }
      continueHandshake(socket, packet);
    });
  });
}

await test('Socket.IO ping emits pong over WebSocket', async (context) => {
  const app = await NestFactory.create(AppModule, { logger: false });
  context.after(() => app.close());
  configureApplication(app);
  await app.listen(0, '127.0.0.1');

  const socketUrl = new URL('/socket.io/', await app.getUrl());
  socketUrl.protocol = 'ws:';
  socketUrl.search = 'EIO=4&transport=websocket';
  const socket = new WebSocket(socketUrl);
  context.after(() => socket.close());

  const packet = await waitForSocketEvent(socket);
  const received: unknown = JSON.parse(packet.slice(2));

  assert.deepEqual(received, ['pong', { message: 'pong' }]);
});
