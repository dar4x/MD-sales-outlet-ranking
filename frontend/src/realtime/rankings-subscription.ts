import { isRankingSnapshot } from '../types/rankings';
import type { RankingSnapshot, RankingWindow } from '../types/rankings';
import { createRealtimeClient } from './socket-client';

export interface LiveState {
  status: 'connecting' | 'live' | 'disconnected';
  message: string;
}

export function subscribeToRankings(
  window: RankingWindow,
  receive: (snapshot: RankingSnapshot) => void,
  update: (state: LiveState) => void,
  createClient = createRealtimeClient,
): () => void {
  const socket = createClient();
  let active = true;
  let connection = 0;
  const unavailable = (message: string): void => {
    if (active) update({ status: 'disconnected', message });
  };
  const handleConnect = (): void => {
    const generation = ++connection;
    update({
      status: 'connecting',
      message: 'Waiting for a live ranking snapshot…',
    });
    socket
      .timeout(5000)
      .emit(
        'rankings.subscribe',
        { window },
        (error: Error | null, ack: unknown) => {
          if (!active || generation !== connection) return;
          if (
            error ||
            typeof ack !== 'object' ||
            ack === null ||
            !('ok' in ack) ||
            ack.ok !== true ||
            !('window' in ack) ||
            ack.window !== window
          ) {
            unavailable(
              'Live subscription failed. Use Refresh rankings to retry.',
            );
          }
        },
      );
  };
  const handleSnapshot = (payload: unknown): void => {
    if (!active) return;
    if (!isRankingSnapshot(payload)) {
      unavailable(
        'Unexpected live rankings response. Use Refresh rankings to retry.',
      );
      return;
    }
    if (payload.window !== window) return;
    receive(payload);
    update({ status: 'live', message: 'Live updates connected.' });
  };
  const handleUnavailable = (): void => {
    ++connection;
    unavailable(
      'Live updates disconnected. Reconnecting automatically; use Refresh rankings for HTTP data.',
    );
    // Server-initiated disconnects do not automatically reconnect.
    if (active && !socket.active) socket.connect();
  };
  socket.on('connect', handleConnect);
  socket.on('rankings.snapshot', handleSnapshot);
  socket.on('connect_error', handleUnavailable);
  socket.on('disconnect', handleUnavailable);
  // Avoid opening a throwaway transport during React StrictMode's cleanup.
  queueMicrotask(() => {
    if (active) socket.connect();
  });
  return () => {
    active = false;
    ++connection;
    if (socket.connected) socket.emit('rankings.unsubscribe', {}, () => {});
    socket.off('connect', handleConnect);
    socket.off('rankings.snapshot', handleSnapshot);
    socket.off('connect_error', handleUnavailable);
    socket.off('disconnect', handleUnavailable);
    socket.disconnect();
  };
}
