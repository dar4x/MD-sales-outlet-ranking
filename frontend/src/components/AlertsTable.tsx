import type { AlertEpisode } from '../types/alerts';
import type { OutletSummary } from '../types/outlets';

export function AlertsTable({
  alerts,
  outlets,
}: {
  alerts: AlertEpisode[];
  outlets: OutletSummary[];
}) {
  if (alerts.length === 0) return <p>No alerts match this filter.</p>;
  return (
    <div className="table-scroll">
      <table>
        <caption>Alert episodes</caption>
        <thead>
          <tr>
            <th scope="col">Outlet</th>
            <th scope="col">Type</th>
            <th scope="col">Status</th>
            <th scope="col">Local date</th>
            <th scope="col">Opened (UTC)</th>
            <th scope="col">Resolved (UTC)</th>
            <th scope="col">Captured facts</th>
            <th scope="col">Responsible recipient</th>
          </tr>
        </thead>
        <tbody>
          {alerts.map((alert) => (
            <tr key={alert.episode_id}>
              <th scope="row">
                {outlets.find((outlet) => outlet.outlet_id === alert.outlet_id)
                  ?.name ?? alert.outlet_id}
              </th>
              <td>{alert.kind === 'stale' ? 'Stale' : 'Behind plan'}</td>
              <td>{alert.resolved_at === null ? 'Active' : 'Resolved'}</td>
              <td>{alert.local_date ?? '—'}</td>
              <td>{alert.opened_at}</td>
              <td>{alert.resolved_at ?? '—'}</td>
              <td>
                {alert.kind === 'stale' ? (
                  <>
                    Last activity: {alert.facts.last_activity_at}; timeout:{' '}
                    {alert.facts.timeout_seconds} seconds.
                  </>
                ) : (
                  <>
                    Plan: {alert.facts.daily_plan_minor}; net revenue:{' '}
                    {alert.facts.net_revenue_minor} (minor units); cutoff:{' '}
                    {alert.facts.cutoff_at}.
                  </>
                )}
              </td>
              <td>
                {alert.facts.recipient.name} ({alert.facts.recipient.email})
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
