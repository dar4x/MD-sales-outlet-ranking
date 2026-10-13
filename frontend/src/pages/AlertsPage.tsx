import { useCallback, useState } from 'react';
import { getAlerts } from '../api/alerts';
import { getOutlets } from '../api/outlets';
import { useApiResource } from '../api/useApiResource';
import { AlertsTable } from '../components/AlertsTable';
import type { OutletSummary } from '../types/outlets';
import { Icon } from '../components/Icon';

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
    <section aria-label="Alerts list" className="panel">
      <div className="panel-heading">
        <div>
          <h2>Alert episodes</h2>
          <p className="panel-description">
            {activeOnly
              ? 'Current exceptions that need attention'
              : 'Current and past outlet exceptions'}
          </p>
        </div>
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          aria-label="Refresh alerts"
        >
          <Icon name="refresh" size={15} />
          Refresh
        </button>
      </div>
      {loading && (
        <p className="notice" role="status">
          Loading alerts…
        </p>
      )}
      {error && (
        <p className="notice notice-error" role="alert">
          Could not load alerts: {error}
        </p>
      )}
      {data && <AlertsTable alerts={data} outlets={outlets} />}
      <div className="panel-footer">
        <span>
          {data?.length ?? '—'} episodes
          {outletId ? ' for the selected outlet' : ' across all outlets'}
        </span>
        <span>Refresh to check for new activity.</span>
      </div>
    </section>
  );
}

export function AlertsPage() {
  const { data: outlets, loading, error, reload } = useApiResource(getOutlets);
  const [activeOnly, setActiveOnly] = useState(true);
  const [outletId, setOutletId] = useState('');
  return (
    <main>
      <div className="page-heading">
        <div>
          <h1>Alerts</h1>
          <p className="page-description">
            Monitor outlet activity and daily sales plan exceptions.
          </p>
        </div>
      </div>
      <div className="toolbar">
        <div className="toolbar-group">
          <fieldset className="segmented-control">
            <legend className="sr-only">Alert status</legend>
            <label className={`segment ${activeOnly ? 'selected' : ''}`}>
              <input
                className="sr-only"
                type="radio"
                name="alert-status"
                checked={activeOnly}
                onChange={() => setActiveOnly(true)}
              />
              Active alerts
            </label>
            <label className={`segment ${!activeOnly ? 'selected' : ''}`}>
              <input
                className="sr-only"
                type="radio"
                name="alert-status"
                checked={!activeOnly}
                onChange={() => setActiveOnly(false)}
              />
              All alerts
            </label>
          </fieldset>
          <div className="field-inline">
            <label htmlFor="alert-outlet">Filter by outlet</label>
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
          </div>
        </div>
      </div>
      {loading && (
        <p className="notice" role="status">
          Loading outlet filter…
        </p>
      )}
      {error && (
        <>
          <p className="notice notice-error" role="alert">
            Could not load outlet filter: {error}
          </p>
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
