import { useCallback, useState } from 'react';
import { getOutletCard, getOutlets } from '../api/outlets';
import { useApiResource } from '../api/useApiResource';
import { OutletCardView } from '../components/OutletCardView';
import { isRankingWindow, rankingWindows } from '../types/rankings';
import type { RankingWindow } from '../types/rankings';

function OutletCardPanel({
  id,
  window,
}: {
  id: string;
  window: RankingWindow;
}) {
  const load = useCallback(
    (signal: AbortSignal) => getOutletCard(id, window, signal),
    [id, window],
  );
  const { data, loading, error, reload } = useApiResource(load);
  return (
    <>
      <button type="button" onClick={reload} disabled={loading}>
        Refresh outlet card
      </button>
      {loading && <p role="status">Loading outlet card…</p>}
      {error && <p role="alert">Could not load outlet card: {error}</p>}
      {data && <OutletCardView card={data} />}
    </>
  );
}

export function OutletsPage() {
  const { data: outlets, loading, error, reload } = useApiResource(getOutlets);
  const [selected, setSelected] = useState('');
  const [window, setWindow] = useState<RankingWindow>('business_day');
  return (
    <main>
      <h1>Outlets</h1>
      <button type="button" onClick={reload} disabled={loading}>
        Refresh outlets
      </button>
      {loading && <p role="status">Loading outlets…</p>}
      {error && <p role="alert">Could not load outlets: {error}</p>}
      {outlets &&
        (outlets.length === 0 ? (
          <p>No outlets available.</p>
        ) : (
          <>
            <p>{outlets.length} outlets.</p>
            <label htmlFor="outlet-select">Outlet </label>
            <select
              id="outlet-select"
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
            >
              <option value="">Select an outlet</option>
              {outlets.map((outlet) => (
                <option key={outlet.outlet_id} value={outlet.outlet_id}>
                  {outlet.name} ({outlet.time_zone})
                </option>
              ))}
            </select>
            <label htmlFor="outlet-window"> Card window </label>
            <select
              id="outlet-window"
              value={window}
              onChange={(event) => {
                if (isRankingWindow(event.target.value))
                  setWindow(event.target.value);
              }}
            >
              {rankingWindows.map((value) => (
                <option key={value} value={value}>
                  {value === 'hour' ? 'Last hour' : 'Business day'}
                </option>
              ))}
            </select>
            {selected && (
              <OutletCardPanel
                key={`${selected}/${window}`}
                id={selected}
                window={window}
              />
            )}
          </>
        ))}
    </main>
  );
}
