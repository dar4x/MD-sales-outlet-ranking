import { useEffect, useState } from 'react';
import type { ConnectionState } from '../types/connections';
import { subscribeToPong } from './pong-subscription';

export function useSocketPong() {
  const [state, setState] = useState<ConnectionState>({
    status: 'pending',
    message: 'Connecting…',
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => subscribeToPong(setState), [attempt]);

  function retry(): void {
    setState({ status: 'pending', message: 'Connecting…' });
    setAttempt((value) => value + 1);
  }

  return { state, retry };
}
