import { useState } from 'react';
import { useRankings } from '../api/useRankings';
import { RankingTable } from '../components/RankingTable';
import { isRankingWindow, rankingWindows } from '../types/rankings';
import type { RankingWindow } from '../types/rankings';

const storageKey = 'ranking-window';
function savedWindow(): RankingWindow {
  try {
    const value = localStorage.getItem(storageKey);
    return isRankingWindow(value) ? value : 'business_day';
  } catch {
    return 'business_day';
  }
}

function Rankings({ window }: { window: RankingWindow }) {
  const { snapshot, previous, loading, error, live, refresh } =
    useRankings(window);
  return (
    <section aria-label="Rankings">
      <p role="status">{live.message}</p>
      <button type="button" onClick={refresh} disabled={loading}>
        Refresh rankings
      </button>
      {loading && <p role="status">Loading rankings…</p>}
      {error && <p role="alert">Could not load rankings: {error}</p>}
      {snapshot && (
        <>
          <p>
            Snapshot time:{' '}
            <time dateTime={snapshot.as_of}>{snapshot.as_of}</time>
          </p>
          <RankingTable snapshot={snapshot} previous={previous} />
          <p>
            Movement compares consecutive snapshots for this window. — means no
            previous rank.
          </p>
        </>
      )}
    </section>
  );
}

export function DashboardPage() {
  const [window, setWindow] = useState<RankingWindow>(savedWindow);
  function selectWindow(value: string): void {
    if (!isRankingWindow(value)) return;
    setWindow(value);
    try {
      localStorage.setItem(storageKey, value);
    } catch {
      /* The selector still works when storage is unavailable. */
    }
  }
  return (
    <main>
      <h1>Outlet rankings</h1>
      <label htmlFor="ranking-window">Time window </label>
      <select
        id="ranking-window"
        value={window}
        onChange={(event) => selectWindow(event.target.value)}
      >
        {rankingWindows.map((value) => (
          <option key={value} value={value}>
            {value === 'hour' ? 'Last hour' : 'Business day'}
          </option>
        ))}
      </select>
      <Rankings key={window} window={window} />
    </main>
  );
}
