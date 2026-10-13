import type { OutletCard } from '../types/outlets';

export function OutletCardView({ card }: { card: OutletCard }) {
  return (
    <section aria-label="Outlet statistics">
      <h2>{card.outlet.name}</h2>
      <p>
        Time zone: {card.outlet.time_zone}. Window: {card.window}. Snapshot:{' '}
        <time dateTime={card.as_of}>{card.as_of}</time>.
      </p>
      <p>All monetary values below are in minor units.</p>
      <dl>
        <dt>Net revenue</dt>
        <dd>{card.metrics.net_revenue_minor}</dd>
        <dt>Receipt count</dt>
        <dd>{card.metrics.receipt_count}</dd>
        <dt>Average check</dt>
        <dd>{card.metrics.average_check_minor ?? '—'}</dd>
        <dt>Today’s local date</dt>
        <dd>{card.today_plan.local_date}</dd>
        <dt>Daily plan</dt>
        <dd>{card.today_plan.daily_plan_minor}</dd>
        <dt>Today’s net revenue</dt>
        <dd>{card.today_plan.net_revenue_minor}</dd>
        <dt>Plan progress (basis points)</dt>
        <dd>
          {Number.isSafeInteger(card.today_plan.progress_bps)
            ? card.today_plan.progress_bps
            : 'Outside safe display range'}
        </dd>
      </dl>
      <h3>Top products</h3>
      {card.top_products.length === 0 ? (
        <p>No product activity in this window.</p>
      ) : (
        <div className="table-scroll">
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
                  <th scope="row">{product.name}</th>
                  <td>
                    {Number.isSafeInteger(product.net_quantity)
                      ? product.net_quantity
                      : 'Outside safe display range'}
                  </td>
                  <td>{product.net_revenue_minor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h3>Sales series</h3>
      {card.series.length === 0 ? (
        <p>No time buckets in this window.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <caption>
              Time buckets (UTC); monetary values in minor units
            </caption>
            <thead>
              <tr>
                <th scope="col">Starts</th>
                <th scope="col">Ends</th>
                <th scope="col">Net revenue</th>
                <th scope="col">Receipts</th>
                <th scope="col">Average check</th>
              </tr>
            </thead>
            <tbody>
              {card.series.map((bucket) => (
                <tr key={bucket.starts_at}>
                  <th scope="row">{bucket.starts_at}</th>
                  <td>{bucket.ends_at}</td>
                  <td>{bucket.metrics.net_revenue_minor}</td>
                  <td>{bucket.metrics.receipt_count}</td>
                  <td>{bucket.metrics.average_check_minor ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
