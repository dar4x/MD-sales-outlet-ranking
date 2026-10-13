import { useCallback, useState } from 'react';
import { getOutletCard, getOutlets } from '../api/outlets';
import { useApiResource } from '../api/useApiResource';
import { OutletCardView } from '../components/OutletCardView';
import { OutletSettingsPanel } from '../components/OutletSettingsPanel';
import type { RankingWindow } from '../types/rankings';
import { WindowControl } from '../components/WindowControl';
import { EmptyState } from '../components/EmptyState';
import { Icon } from '../components/Icon';

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
      <div className="toolbar">
        <span className="helper-text">Performance for the selected window</span>
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          aria-label="Refresh outlet card"
        >
          <Icon name="refresh" size={15} />
          Refresh card
        </button>
      </div>
      {loading && (
        <p className="notice" role="status">
          <Icon name="refresh" />
          Loading outlet card…
        </p>
      )}
      {error && (
        <p className="notice notice-error" role="alert">
          <Icon name="warning" />
          Could not load outlet card: {error}
        </p>
      )}
      {data && <OutletCardView card={data} />}
    </>
  );
}

export function OutletsPage({
  view,
  selected,
  onSelect,
  onOpenSettings,
  onOpenDetails,
}: {
  view: 'details' | 'settings';
  selected: string;
  onSelect: (id: string) => void;
  onOpenSettings: () => void;
  onOpenDetails: () => void;
}) {
  const { data: outlets, loading, error, reload } = useApiResource(getOutlets);
  const [window, setWindow] = useState<RankingWindow>('business_day');
  const [revision, setRevision] = useState(0);
  const outlet = outlets?.find((item) => item.outlet_id === selected);
  return (
    <main>
      <div className="page-heading">
        <div>
          <h1>
            {view === 'settings'
              ? 'Outlet settings'
              : (outlet?.name ?? 'Outlets')}
          </h1>
          <p className="page-description">
            {view === 'settings'
              ? 'Manage your daily sales plan and responsible contact.'
              : 'Explore outlet performance, sales activity and top products.'}
          </p>
        </div>
        {selected && (
          <button
            type="button"
            onClick={view === 'settings' ? onOpenDetails : onOpenSettings}
            aria-label={
              view === 'settings'
                ? 'Open outlet details'
                : 'Open outlet settings'
            }
          >
            <Icon
              name={view === 'settings' ? 'outlet' : 'settings'}
              size={15}
            />
            {view === 'settings' ? 'View details' : 'Settings'}
            <Icon name="arrow" size={14} />
          </button>
        )}
      </div>
      {loading && (
        <p className="notice" role="status">
          Loading outlets…
        </p>
      )}
      {error && (
        <p className="notice notice-error" role="alert">
          Could not load outlets: {error}
        </p>
      )}
      {outlets &&
        (outlets.length === 0 ? (
          <div className="panel">
            <EmptyState
              title="No outlets available."
              description="Outlets will appear here when they are available."
              icon="outlet"
            />
          </div>
        ) : (
          <>
            <div className="toolbar outlet-toolbar">
              <div className="toolbar-group">
                <div className="field-inline">
                  <label htmlFor="outlet-select">Outlet</label>
                  <select
                    id="outlet-select"
                    value={selected}
                    onChange={(event) => onSelect(event.target.value)}
                  >
                    <option value="">Select an outlet</option>
                    {outlets.map((outlet) => (
                      <option key={outlet.outlet_id} value={outlet.outlet_id}>
                        {outlet.name}
                      </option>
                    ))}
                  </select>
                </div>
                {view === 'details' && (
                  <WindowControl
                    value={window}
                    onChange={setWindow}
                    label="Card window"
                  />
                )}
              </div>
              <button
                type="button"
                onClick={reload}
                disabled={loading}
                aria-label="Refresh outlets"
                className="icon-button"
                title="Refresh outlets"
              >
                <Icon name="refresh" size={15} />
              </button>
            </div>
            {selected ? (
              <>
                {view === 'details' ? (
                  <OutletCardPanel
                    key={`${selected}/${window}/${revision}`}
                    id={selected}
                    window={window}
                  />
                ) : (
                  <OutletSettingsPanel
                    key={selected}
                    id={selected}
                    onSaved={() => setRevision((value) => value + 1)}
                  />
                )}
              </>
            ) : (
              <div className="panel">
                <EmptyState
                  title={
                    view === 'settings'
                      ? 'Choose an outlet to manage settings'
                      : 'Choose an outlet to view performance'
                  }
                  description={`Select one of the ${outlets.length} available outlets using the selector above.`}
                  icon={view === 'settings' ? 'settings' : 'outlet'}
                />
              </div>
            )}
          </>
        ))}
    </main>
  );
}
