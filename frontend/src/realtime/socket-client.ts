import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { PongMessage } from '../types/connections';

interface ServerToClientEvents {
  pong: (message: PongMessage) => void;
}

interface ClientToServerEvents {
  ping: () => void;
}

export type RealtimeSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function createRealtimeClient(): RealtimeSocket {
  return io(import.meta.env.VITE_SOCKET_URL, {
    autoConnect: false,
    transports: ['websocket'],
  });
}
