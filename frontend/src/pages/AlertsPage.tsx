import { useCallback, useState } from 'react';
import { getAlerts } from '../api/alerts';
import { getOutlets } from '../api/outlets';
import { useApiResource } from '../api/useApiResource';
import { AlertsTable } from '../components/AlertsTable';
import type { OutletSummary } from '../types/outlets';

function AlertResults({
  activeOnly,
  outletId,
  outlets,
}: {
  activeOnly: boolean;
  outletId: string;
  outlets: OutletSummary[];
}) {
  const load = useCallback(
    (signal: AbortSignal) => getAlerts(activeOnly, outletId, signal),
    [activeOnly, outletId],
  );
  const { data, loading, error, reload } = useApiResource(load);
  return (
    <section aria-label="Alerts list">
      <button type="button" onClick={reload} disabled={loading}>
        Refresh alerts
      </button>
      {loading && <p role="status">Loading alerts…</p>}
      {error && <p role="alert">Could not load alerts: {error}</p>}
      {data && <AlertsTable alerts={data} outlets={outlets} />}
    </section>
  );
}

export function AlertsPage() {
  const { data: outlets, loading, error, reload } = useApiResource(getOutlets);
  const [activeOnly, setActiveOnly] = useState(true);
  const [outletId, setOutletId] = useState('');
  return (
    <main>
      <h1>Alerts</h1>
      <p>
        Alerts are loaded over HTTP. Use Refresh alerts for the latest state.
      </p>
      <p>
        <label>
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(event) => setActiveOnly(event.target.checked)}
          />{' '}
          Active alerts only
        </label>
      </p>
      <label htmlFor="alert-outlet">Filter by outlet </label>
      <select
        id="alert-outlet"
        value={outletId}
        onChange={(event) => setOutletId(event.target.value)}
        disabled={loading}
      >
        <option value="">All outlets</option>
        {outlets?.map((outlet) => (
          <option key={outlet.outlet_id} value={outlet.outlet_id}>
            {outlet.name}
          </option>
        ))}
      </select>
      {loading && <p role="status">Loading outlet filter…</p>}
      {error && (
        <>
          <p role="alert">Could not load outlet filter: {error}</p>
          <button type="button" onClick={reload}>
            Retry outlet filter
          </button>
        </>
      )}
      <AlertResults
        key={`${activeOnly}/${outletId}`}
        activeOnly={activeOnly}
        outletId={outletId}
        outlets={outlets ?? []}
      />
    </main>
  );
}
