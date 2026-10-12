import { useEffect, useState } from 'react';
import type { ConnectionState } from '../types/connections';
import { getHttpPing } from './http-client';

async function loadPing(
  signal: AbortSignal,
  update: (state: ConnectionState) => void,
): Promise<void> {
  try {
    const response = await getHttpPing(signal);
    if (!signal.aborted) {
      update({ status: 'success', message: response.message });
    }
  } catch {
    if (!signal.aborted) {
      update({
        status: 'error',
        message: 'Could not reach the server. Try again.',
      });
    }
  }
}

export function useHttpPing() {
  const [state, setState] = useState<ConnectionState>({
    status: 'pending',
    message: 'Checking…',
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void loadPing(controller.signal, setState);
    return () => controller.abort();
  }, [attempt]);

  function retry(): void {
    setState({ status: 'pending', message: 'Checking…' });
    setAttempt((value) => value + 1);
  }

  return { state, retry };
}
