import { isPongMessage } from '../types/connections';
import type { ConnectionState } from '../types/connections';
import { createRealtimeClient } from './socket-client';
import type { RealtimeSocket } from './socket-client';

function scheduleConnection(socket: RealtimeSocket): () => void {
  let cancelled = false;
  // Let React finish its development cleanup before opening the transport.
  queueMicrotask(() => {
    if (!cancelled) {
      socket.connect();
    }
  });

  return () => {
    cancelled = true;
  };
}

function getPongState(payload: unknown): ConnectionState {
  if (!isPongMessage(payload)) {
    return { status: 'error', message: 'Unexpected live response. Try again.' };
  }

  return { status: 'success', message: payload.message };
}

export function subscribeToPong(update: (state: ConnectionState) => void) {
  const socket = createRealtimeClient();
  const handleConnect = (): void => {
    update({ status: 'pending', message: 'Waiting for pong…' });
    socket.emit('ping');
  };
  const handlePong = (payload: unknown): void => {
    update(getPongState(payload));
  };
  const handleUnavailable = (): void => {
    update({ status: 'error', message: 'Connection unavailable. Retrying…' });
  };

  socket.on('connect', handleConnect);
  socket.on('pong', handlePong);
  socket.on('connect_error', handleUnavailable);
  socket.on('disconnect', handleUnavailable);
  const cancelConnection = scheduleConnection(socket);

  return () => {
    cancelConnection();
    socket.removeAllListeners();
    socket.disconnect();
  };
}
