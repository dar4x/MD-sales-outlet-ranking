import { formatMoney } from '../rankings/money';
import { rankMovement } from '../rankings/snapshots';
import type { RankingSnapshot } from '../types/rankings';
import { Icon } from './Icon';
import { EmptyState } from './EmptyState';
import { formatBasisPoints } from '../presentation/format';

interface RankingTableProps {
  snapshot: RankingSnapshot;
  previous: RankingSnapshot | null;
  onOpenOutlet?: (id: string) => void;
}

function movementLabel(movement: number | null): string {
  if (movement === null) return '—';
  if (movement === 0) return 'Unchanged';
  return movement > 0 ? `Up ${movement}` : `Down ${-movement}`;
}

export function RankingTable({
  snapshot,
  previous,
  onOpenOutlet,
}: RankingTableProps) {
  if (snapshot.rows.length === 0)
    return (
      <EmptyState
        title="No outlets in this ranking."
        description="Your outlets will appear here once they are available."
        icon="outlet"
      />
    );
  return (
    <div
      className="table-scroll bounded table-caption-hidden"
      tabIndex={0}
      role="region"
      aria-label="Scrollable outlet rankings"
    >
      <table className="rankings-table">
        <caption>Outlet rankings — {snapshot.currency}</caption>
        <thead>
          <tr>
            <th scope="col">Rank</th>
            <th scope="col">Outlet</th>
            <th scope="col">Revenue</th>
            <th scope="col">Receipts</th>
            <th scope="col">Dynamics</th>
            <th scope="col">Movement</th>
            <th scope="col">Position</th>
            <th scope="col">Stale</th>
            <th scope="col">Behind plan</th>
          </tr>
        </thead>
        <tbody>
          {snapshot.rows.map((row) => (
            <tr key={row.outlet_id}>
              <td>{row.rank}</td>
              <th scope="row">
                <div className="outlet-cell">
                  <span className="outlet-icon">
                    <Icon name="outlet" size={15} />
                  </span>
                  <div>
                    {onOpenOutlet ? (
                      <button
                        type="button"
                        className="link-button outlet-name"
                        title={row.outlet_name}
                        onClick={() => onOpenOutlet(row.outlet_id)}
                      >
                        {row.outlet_name}
                      </button>
                    ) : (
                      <span className="outlet-name">{row.outlet_name}</span>
                    )}
                    <span className="outlet-zone">{row.time_zone}</span>
                  </div>
                </div>
              </th>
              <td>{formatMoney(row.net_revenue_minor, snapshot.currency)}</td>
              <td>{row.receipt_count}</td>
              <td
                className={`numeric movement ${row.dynamics_bps !== null && row.dynamics_bps > 0 ? 'positive' : row.dynamics_bps !== null && row.dynamics_bps < 0 ? 'negative' : ''}`}
                title="Revenue change against the preceding hour; unavailable for business day"
              >
                {formatBasisPoints(row.dynamics_bps)}
              </td>
              <td>
                <span
                  className={`movement ${(rankMovement(previous, row.outlet_id, row.rank) ?? 0) > 0 ? 'positive' : (rankMovement(previous, row.outlet_id, row.rank) ?? 0) < 0 ? 'negative' : ''}`}
                >
                  {movementLabel(
                    rankMovement(previous, row.outlet_id, row.rank),
                  )}
                </span>
              </td>
              <td>
                {row.is_leader ? (
                  <span className="badge badge-success">Leader</span>
                ) : row.is_laggard ? (
                  <span className="badge">Last place</span>
                ) : (
                  <span className="movement">—</span>
                )}
              </td>
              <td>
                <span
                  className={`badge ${row.stale ? 'badge-warning' : 'badge-neutral'}`}
                >
                  {row.stale ? 'Yes' : 'No'}
                </span>
              </td>
              <td>
                <span
                  className={`badge ${row.behind_plan ? 'badge-danger' : 'badge-neutral'}`}
                >
                  {row.behind_plan ? 'Yes' : 'No'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
