export interface PongMessage {
  message: 'pong';
}

export interface ConnectionState {
  status: 'pending' | 'success' | 'error';
  message: string;
}

export function isPongMessage(value: unknown): value is PongMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    value.message === 'pong'
  );
}
