import type { AlertEpisode } from '../types/alerts';
import type { OutletSummary } from '../types/outlets';
import { formatDateTime } from '../presentation/format';
import { EmptyState } from './EmptyState';
import { Icon } from './Icon';

export function AlertsTable({
  alerts,
  outlets,
}: {
  alerts: AlertEpisode[];
  outlets: OutletSummary[];
}) {
  if (alerts.length === 0)
    return (
      <EmptyState
        title="No alerts match this filter."
        description="There are no recorded exceptions for the selected view."
        icon="alerts"
      />
    );
  return (
    <div
      className="table-scroll bounded table-caption-hidden"
      tabIndex={0}
      role="region"
      aria-label="Scrollable alert episodes"
    >
      <table className="alerts-table">
        <caption>Alert episodes</caption>
        <thead>
          <tr>
            <th scope="col">Outlet</th>
            <th scope="col">Type</th>
            <th scope="col">Status</th>
            <th scope="col">Opened (UTC)</th>
            <th scope="col">Resolved (UTC)</th>
            <th scope="col">Captured facts</th>
          </tr>
        </thead>
        <tbody>
          {alerts.map((alert) => {
            const name =
              outlets.find((outlet) => outlet.outlet_id === alert.outlet_id)
                ?.name ?? alert.outlet_id;
            return (
              <tr key={alert.episode_id}>
                <th scope="row">
                  <div className="outlet-cell">
                    <span className="outlet-icon">
                      <Icon name="outlet" size={15} />
                    </span>
                    <span className="outlet-name" title={name}>
                      {name}
                    </span>
                  </div>
                </th>
                <td>
                  <span
                    className={`badge ${alert.kind === 'stale' ? 'badge-warning' : 'badge-danger'}`}
                  >
                    {alert.kind === 'stale' ? 'Stale' : 'Behind plan'}
                  </span>
                </td>
                <td>
                  <span
                    className={`badge ${alert.resolved_at === null ? 'badge-warning' : 'badge-neutral'}`}
                  >
                    {alert.resolved_at === null ? 'Active' : 'Resolved'}
                  </span>
                </td>
                <td>
                  <time dateTime={alert.opened_at} title={alert.opened_at}>
                    {formatDateTime(alert.opened_at)}
                  </time>
                </td>
                <td>
                  {alert.resolved_at ? (
                    <time
                      dateTime={alert.resolved_at}
                      title={alert.resolved_at}
                    >
                      {formatDateTime(alert.resolved_at)}
                    </time>
                  ) : (
                    <span className="movement">—</span>
                  )}
                </td>
                <td>
                  <details className="alert-facts">
                    <summary>View details</summary>
                    <div className="alert-detail-content">
                      <p>Local date: {alert.local_date ?? '—'}</p>
                      {alert.kind === 'stale' ? (
                        <>
                          <p>
                            Last activity:{' '}
                            <time dateTime={alert.facts.last_activity_at}>
                              {formatDateTime(alert.facts.last_activity_at)} UTC
                            </time>
                          </p>
                          <p>Timeout: {alert.facts.timeout_seconds} seconds</p>
                        </>
                      ) : (
                        <>
                          <p>
                            Plan: {alert.facts.daily_plan_minor} minor units
                          </p>
                          <p>
                            Net revenue: {alert.facts.net_revenue_minor} minor
                            units
                          </p>
                          <p>
                            Cutoff:{' '}
                            <time dateTime={alert.facts.cutoff_at}>
                              {formatDateTime(alert.facts.cutoff_at)} UTC
                            </time>
                          </p>
                        </>
                      )}
                      <p className="alert-recipient">
                        Responsible recipient: {alert.facts.recipient.name}
                        <span className="recipient-email">
                          {alert.facts.recipient.email}
                        </span>
                      </p>
                    </div>
                  </details>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
