/* External deps */
import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';

/* Internal deps */
import type { RankingQuery } from '../application/ports/ranking-ports.js';
import type {
  RankingRow,
  RankingSnapshot,
} from '../application/read-models/ranking.js';
import type {
  RankingWindow,
  UtcTimestamp,
} from '../../shared/domain/value-types.js';

export class PostgresRankingQuery implements RankingQuery {
  constructor(
    private readonly dataSource: Pick<DataSource, 'query'>,
    private readonly currency: string,
  ) {}

  async get(
    window: RankingWindow,
    asOf?: UtcTimestamp,
  ): Promise<RankingSnapshot> {
    const results: { as_of: Date; rows: RankingRow[] }[] =
      await this.dataSource.query(
        `
      WITH instant AS MATERIALIZED (
        SELECT $1::text AS selected_window, date_trunc('milliseconds', COALESCE($2::timestamptz, clock_timestamp())) AS as_of
      ), bounds AS (
        SELECT o.*, i.as_of,
          CASE WHEN $1 = 'hour' THEN i.as_of - interval '1 hour'
          -- Convert to local civil time before midnight, then back to an instant.
          -- This respects IANA DST rules rather than assuming a 24-hour day.
          ELSE date_trunc('day', i.as_of AT TIME ZONE o.time_zone)
            AT TIME ZONE o.time_zone END AS starts_at
        FROM outlets o CROSS JOIN instant i
      ), sale_totals AS (
        SELECT b.outlet_id, COALESCE(sum(s.gross_amount_minor), 0) AS revenue,
          count(s.receipt_id)::integer AS receipt_count
        FROM bounds b LEFT JOIN sale_receipts s ON s.outlet_id = b.outlet_id
          -- Half-open bounds include the start and exclude the next window.
          AND s.occurred_at >= b.starts_at AND s.occurred_at < b.as_of
        GROUP BY b.outlet_id
      ), previous_totals AS (
        SELECT b.outlet_id, COALESCE(sum(s.gross_amount_minor), 0) AS revenue
        FROM bounds b LEFT JOIN sale_receipts s ON s.outlet_id = b.outlet_id
          AND $1 = 'hour'
          AND s.occurred_at >= b.as_of - interval '2 hours'
          AND s.occurred_at < b.as_of - interval '1 hour'
        GROUP BY b.outlet_id
      ), return_totals AS (
        SELECT b.outlet_id,
          COALESCE(sum(r.amount_minor) FILTER (WHERE r.occurred_at >= b.starts_at AND r.occurred_at < b.as_of),0) AS revenue,
          COALESCE(sum(r.amount_minor) FILTER (WHERE r.occurred_at >= b.as_of - interval '2 hours' AND r.occurred_at < b.as_of - interval '1 hour'),0) AS previous
        FROM bounds b LEFT JOIN return_events r ON r.outlet_id = b.outlet_id
        GROUP BY b.outlet_id
      ), metrics AS (
        SELECT b.*, s.revenue - COALESCE(r.revenue, 0) AS net,
          s.receipt_count, p.revenue - COALESCE(r.previous,0) AS previous
        FROM bounds b JOIN sale_totals s USING (outlet_id)
        JOIN previous_totals p USING (outlet_id)
        LEFT JOIN return_totals r USING (outlet_id)
      ), ranked AS (
        SELECT *, row_number() OVER (ORDER BY net DESC, outlet_id ASC)::integer AS rank,
          count(*) OVER () AS outlet_count,
          min(net) OVER () AS minimum_net, max(net) OVER () AS maximum_net
        FROM metrics
      )
      SELECT i.as_of, COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'outlet_id', outlet_id, 'outlet_name', name, 'time_zone', time_zone,
          'local_date', (as_of AT TIME ZONE time_zone)::date::text,
          'starts_at', to_char(starts_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'ends_at', to_char(as_of AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'rank', rank, 'net_revenue_minor', net::text, 'receipt_count', receipt_count,
          'average_check_minor', round(net / NULLIF(receipt_count, 0))::text, 'previous_revenue_minor', CASE WHEN $1 = 'hour' THEN previous::text ELSE NULL END,
          'dynamics_bps', CASE WHEN $1 = 'hour' AND previous > 0
            THEN round((net - previous) * 10000 / previous) ELSE NULL END,
          'is_leader', outlet_count > 1 AND maximum_net > minimum_net AND rank = 1,
          'is_laggard', outlet_count > 1 AND maximum_net > minimum_net AND rank = outlet_count,
          'stale', EXISTS(SELECT 1 FROM alert_episodes a WHERE a.outlet_id=ranked.outlet_id AND a.kind='stale'
            AND a.opened_at<=ranked.as_of AND (a.resolved_at IS NULL OR a.resolved_at>ranked.as_of)),
          'behind_plan', EXISTS(SELECT 1 FROM alert_episodes a WHERE a.outlet_id=ranked.outlet_id AND a.kind='behind_plan'
            AND a.local_date=(ranked.as_of AT TIME ZONE ranked.time_zone)::date
            AND a.opened_at<=ranked.as_of AND (a.resolved_at IS NULL OR a.resolved_at>ranked.as_of))
        ) ORDER BY rank) FROM ranked
      ), '[]'::jsonb) AS rows FROM instant i
      `,
        [window, asOf ?? null],
      );
    const result = results[0]!;
    return {
      snapshot_id: randomUUID(),
      as_of: result.as_of.toISOString(),
      window,
      currency: this.currency,
      rows: result.rows,
    };
  }
}
