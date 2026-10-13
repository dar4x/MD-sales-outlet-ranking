import { useEffect, useState } from 'react';
import { subscribeToRankings } from '../realtime/rankings-subscription';
import type { LiveState } from '../realtime/rankings-subscription';
import { acceptSnapshot } from '../rankings/snapshots';
import type { SnapshotHistory } from '../rankings/snapshots';
import type { RankingSnapshot, RankingWindow } from '../types/rankings';
import { getRankings } from './rankings';

interface RankingsState extends SnapshotHistory {
  loading: boolean;
  error: string | null;
}

export function useRankings(window: RankingWindow) {
  const [state, setState] = useState<RankingsState>({
    snapshot: null,
    previous: null,
    loading: true,
    error: null,
  });
  const [live, setLive] = useState<LiveState>({
    status: 'connecting',
    message: 'Connecting to live updates…',
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const receive = (snapshot: RankingSnapshot): void => {
      if (controller.signal.aborted || snapshot.window !== window) return;
      setState((current) => ({
        ...acceptSnapshot(current, snapshot),
        loading: false,
        error: null,
      }));
    };
    const unsubscribe = subscribeToRankings(window, receive, setLive);
    void getRankings(window, controller.signal)
      .then(receive)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState((current) => ({
            ...current,
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : 'Could not load rankings.',
          }));
        }
      });
    return () => {
      controller.abort();
      unsubscribe();
    };
  }, [window, attempt]);

  function refresh(): void {
    setState((current) => ({ ...current, loading: true, error: null }));
    setLive({ status: 'connecting', message: 'Connecting to live updates…' });
    setAttempt((value) => value + 1);
  }

  return { ...state, live, refresh };
}
