import { formatMoney } from '../rankings/money';
import { rankMovement } from '../rankings/snapshots';
import type { RankingSnapshot } from '../types/rankings';

interface RankingTableProps {
  snapshot: RankingSnapshot;
  previous: RankingSnapshot | null;
}

function movementLabel(movement: number | null): string {
  if (movement === null) return '—';
  if (movement === 0) return 'Unchanged';
  return movement > 0 ? `Up ${movement}` : `Down ${-movement}`;
}

export function RankingTable({ snapshot, previous }: RankingTableProps) {
  if (snapshot.rows.length === 0) return <p>No outlets in this ranking.</p>;
  return (
    <div className="table-scroll">
      <table>
        <caption>Outlet rankings — {snapshot.currency}</caption>
        <thead>
          <tr>
            <th scope="col">Rank</th>
            <th scope="col">Outlet</th>
            <th scope="col">Revenue</th>
            <th scope="col">Receipts</th>
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
              <th scope="row">{row.outlet_name}</th>
              <td>{formatMoney(row.net_revenue_minor, snapshot.currency)}</td>
              <td>{row.receipt_count}</td>
              <td>
                {movementLabel(rankMovement(previous, row.outlet_id, row.rank))}
              </td>
              <td>
                {[row.is_leader && 'Leader', row.is_laggard && 'Last place']
                  .filter(Boolean)
                  .join(', ') || '—'}
              </td>
              <td>{row.stale ? 'Yes' : 'No'}</td>
              <td>{row.behind_plan ? 'Yes' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
