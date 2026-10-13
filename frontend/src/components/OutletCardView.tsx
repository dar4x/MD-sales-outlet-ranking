import type { OutletCard } from '../types/outlets';
import { formatBasisPoints, formatDateTime } from '../presentation/format';
import { Icon } from './Icon';
import { EmptyState } from './EmptyState';

export function OutletCardView({ card }: { card: OutletCard }) {
  return (
    <section aria-label="Outlet statistics">
      <div className="metadata" style={{ marginBottom: 18 }}>
        <span>
          <Icon name="outlet" size={14} />
          {card.outlet.name} · {card.outlet.time_zone}
        </span>
        <span>
          <Icon name="clock" size={14} />
          <time dateTime={card.as_of}>
            Updated {formatDateTime(card.as_of)} UTC
          </time>
        </span>
      </div>
      <dl className="summary-grid detail-stats">
        <div className="metric-card">
          <dt className="metric-label">Net revenue</dt>
          <dd className="metric-value long">
            {card.metrics.net_revenue_minor}
          </dd>
          <span className="metric-note">Minor units · net of returns</span>
        </div>
        <div className="metric-card">
          <dt className="metric-label">Receipt count</dt>
          <dd className="metric-value">{card.metrics.receipt_count}</dd>
          <span className="metric-note">Sales in the selected window</span>
        </div>
        <div className="metric-card">
          <dt className="metric-label">Average check</dt>
          <dd className="metric-value exact-decimal">
            {card.metrics.average_check_minor ?? '—'}
          </dd>
          <span className="metric-note">Minor units per receipt</span>
        </div>
      </dl>
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h2>Today’s plan</h2>
            <p className="panel-description">
              Today’s local date: {card.today_plan.local_date}
            </p>
          </div>
          <span className="badge">
            {card.window === 'hour' ? 'Last hour' : 'Business day'}
          </span>
        </div>
        <dl className="panel-body plan-grid">
          <div>
            <dt>Daily plan</dt>
            <dd>{card.today_plan.daily_plan_minor}</dd>
            <span className="metric-note">Minor units</span>
          </div>
          <div>
            <dt>Today’s net revenue</dt>
            <dd>{card.today_plan.net_revenue_minor}</dd>
            <span className="metric-note">Minor units</span>
          </div>
          <div>
            <dt>Plan progress</dt>
            <dd>
              {Number.isSafeInteger(card.today_plan.progress_bps)
                ? formatBasisPoints(card.today_plan.progress_bps).replace(
                    /^\+/,
                    '',
                  )
                : 'Outside safe display range'}
            </dd>
            <span
              className="metric-note"
              title={`${card.today_plan.progress_bps} basis points`}
            >
              Of the daily sales plan
            </span>
          </div>
        </dl>
      </div>
      <div className="details-section panel">
        <div className="panel-heading">
          <div>
            <h2>Top products</h2>
            <p className="panel-description">
              Highest net revenue in the selected window
            </p>
          </div>
          <span className="count-label">
            {card.top_products.length} products
          </span>
        </div>
        {card.top_products.length === 0 ? (
          <EmptyState
            title="No product activity in this window."
            description="Products appear here as sales are recorded for this outlet."
            icon="products"
          />
        ) : (
          <div
            className="table-scroll bounded table-caption-hidden"
            tabIndex={0}
            role="region"
            aria-label="Scrollable top products"
          >
            <table>
              <caption>Top products by net revenue</caption>
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col">Net quantity</th>
                  <th scope="col">Net revenue (minor units)</th>
                </tr>
              </thead>
              <tbody>
                {card.top_products.map((product) => (
                  <tr key={product.product_id}>
                    <th scope="row">
                      <div className="outlet-cell">
                        <span className="outlet-icon">
                          <Icon name="products" size={15} />
                        </span>
                        {product.name}
                      </div>
                    </th>
                    <td>
                      {Number.isSafeInteger(product.net_quantity)
                        ? product.net_quantity
                        : 'Outside safe display range'}
                    </td>
                    <td className="numeric">{product.net_revenue_minor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="details-section panel">
        <div className="panel-heading">
          <div>
            <h2>Sales series</h2>
            <p className="panel-description">
              Time buckets (UTC); monetary values in minor units
            </p>
          </div>
          <span className="count-label">{card.series.length} buckets</span>
        </div>
        {card.series.length === 0 ? (
          <EmptyState
            title="No time buckets in this window."
            description="Sales activity will appear here when a time series is available."
            icon="clock"
          />
        ) : (
          <div
            className="table-scroll bounded table-caption-hidden"
            tabIndex={0}
            role="region"
            aria-label="Scrollable sales series"
          >
            <table>
              <caption>
                Time buckets (UTC); monetary values in minor units
              </caption>
              <thead>
                <tr>
                  <th scope="col">Starts (UTC)</th>
                  <th scope="col">Ends (UTC)</th>
                  <th scope="col">Net revenue</th>
                  <th scope="col">Receipts</th>
                  <th scope="col">Average check</th>
                </tr>
              </thead>
              <tbody>
                {card.series.map((bucket) => (
                  <tr key={bucket.starts_at}>
                    <th scope="row" className="numeric">
                      <time
                        dateTime={bucket.starts_at}
                        title={bucket.starts_at}
                      >
                        {formatDateTime(bucket.starts_at)}
                      </time>
                    </th>
                    <td className="numeric">
                      <time dateTime={bucket.ends_at} title={bucket.ends_at}>
                        {formatDateTime(bucket.ends_at)}
                      </time>
                    </td>
                    <td className="numeric">
                      {bucket.metrics.net_revenue_minor}
                    </td>
                    <td>{bucket.metrics.receipt_count}</td>
                    <td className="numeric">
                      {bucket.metrics.average_check_minor ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
