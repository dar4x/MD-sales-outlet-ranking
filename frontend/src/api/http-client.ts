import { isPongMessage } from '../types/connections';
import type { PongMessage } from '../types/connections';

export async function getHttpPing(signal: AbortSignal): Promise<PongMessage> {
  const baseUrl = import.meta.env.VITE_API_URL.replace(/\/+$/, '');
  const url = new URL('ping', `${baseUrl}/`);
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`HTTP ping failed (${response.status})`);
  }

  const payload: unknown = await response.json();
  if (!isPongMessage(payload)) {
    throw new Error('The server returned an unexpected ping response');
  }

  return payload;
}
