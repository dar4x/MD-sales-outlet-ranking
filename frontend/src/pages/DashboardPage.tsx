import { useState } from 'react';
import { useRankings } from '../api/useRankings';
import { RankingTable } from '../components/RankingTable';
import { isRankingWindow } from '../types/rankings';
import type { RankingWindow } from '../types/rankings';
import { WindowControl } from '../components/WindowControl';
import { Icon } from '../components/Icon';
import { formatMoney } from '../rankings/money';
import { formatDateTime } from '../presentation/format';

const storageKey = 'ranking-window';
function savedWindow(): RankingWindow {
  try {
    const value = localStorage.getItem(storageKey);
    return isRankingWindow(value) ? value : 'business_day';
  } catch {
    return 'business_day';
  }
}

function Rankings({
  window,
  onOpenOutlet,
}: {
  window: RankingWindow;
  onOpenOutlet: (id: string) => void;
}) {
  const { snapshot, previous, loading, error, live, refresh } =
    useRankings(window);
  const revenue = snapshot
    ? formatMoney(
        snapshot.rows
          .reduce((sum, row) => sum + BigInt(row.net_revenue_minor), 0n)
          .toString(),
        snapshot.currency,
      )
    : '';
  return (
    <section aria-label="Rankings">
      {loading && (
        <p className="notice" role="status">
          <Icon name="refresh" />
          Loading rankings…
        </p>
      )}
      {error && (
        <p className="notice notice-error" role="alert">
          <Icon name="warning" />
          Could not load rankings: {error}
        </p>
      )}
      {snapshot && (
        <div className="summary-grid">
          <div className="metric-card">
            <span className="metric-label">
              <Icon name="rankings" size={16} />
              Net revenue
            </span>
            <strong
              className={`metric-value ${revenue.length > 26 ? 'long' : ''}`}
            >
              {revenue}
            </strong>
            <span className="metric-note">
              Across all outlets ·{' '}
              {window === 'hour' ? 'last hour' : 'local business day'}
            </span>
          </div>
          <div className="metric-card">
            <span className="metric-label">
              <Icon name="products" size={16} />
              Receipts
            </span>
            <strong className="metric-value">
              {new Intl.NumberFormat('en-US').format(
                snapshot.rows.reduce(
                  (sum, row) => sum + BigInt(row.receipt_count),
                  0n,
                ),
              )}
            </strong>
            <span className="metric-note">Completed sales in this window</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">
              <Icon name="outlet" size={16} />
              Outlets
            </span>
            <strong className="metric-value">{snapshot.rows.length}</strong>
            <span className="metric-note">Included in the ranking</span>
          </div>
        </div>
      )}
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h2>Outlet rankings</h2>
            <p className="panel-description">
              Sorted by net revenue{snapshot ? ` · ${snapshot.currency}` : ''}
            </p>
          </div>
          <div className="toolbar-group">
            <span className={`live-status ${live.status}`} role="status">
              <span className="status-dot" />
              {live.message}
            </span>
            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              aria-label="Refresh rankings"
            >
              <Icon name="refresh" size={15} />
              Refresh
            </button>
          </div>
        </div>
        {snapshot && (
          <RankingTable
            snapshot={snapshot}
            previous={previous}
            onOpenOutlet={onOpenOutlet}
          />
        )}
        <div className="panel-footer">
          <span>
            Movement compares consecutive snapshots. — means no previous rank.
          </span>
          {snapshot && (
            <span>
              <Icon name="clock" size={12} />{' '}
              <time dateTime={snapshot.as_of}>
                Updated {formatDateTime(snapshot.as_of)} UTC
              </time>
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

export function DashboardPage({
  onOpenOutlet,
}: {
  onOpenOutlet: (id: string) => void;
}) {
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
      <div className="page-heading">
        <div>
          <h1>Overview</h1>
          <p className="page-description">
            A live view of sales performance across your outlets.
          </p>
        </div>
        <WindowControl value={window} onChange={selectWindow} />
      </div>
      <Rankings key={window} window={window} onOpenOutlet={onOpenOutlet} />
    </main>
  );
}
