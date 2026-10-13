import { useEffect, useState } from 'react';

interface ResourceState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

// Callers keep the loader stable and key a screen when its resource identity changes.
export function useApiResource<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<ResourceState<T>>({
    data: null,
    loading: true,
    error: null,
  });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted)
          setState({ data, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setState((current) => ({
            ...current,
            loading: false,
            error: error instanceof Error ? error.message : 'Request failed.',
          }));
      });
    return () => controller.abort();
  }, [load, attempt]);
  function reload(): void {
    setState((current) => ({ ...current, loading: true, error: null }));
    setAttempt((value) => value + 1);
  }
  return { ...state, reload };
}
