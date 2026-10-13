import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { PongMessage } from '../types/connections';
import type { RankingSnapshot, RankingWindow } from '../types/rankings';

interface ServerToClientEvents {
  pong: (message: PongMessage) => void;
  'rankings.snapshot': (snapshot: RankingSnapshot) => void;
}

interface ClientToServerEvents {
  ping: () => void;
  'rankings.subscribe': (
    payload: { window: RankingWindow },
    acknowledge: (response: unknown) => void,
  ) => void;
  'rankings.unsubscribe': (
    payload: Record<string, never>,
    acknowledge: (response: unknown) => void,
  ) => void;
}

export type RealtimeSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function createRealtimeClient(): RealtimeSocket {
  return io(import.meta.env.VITE_SOCKET_URL, {
    autoConnect: false,
  });
}
