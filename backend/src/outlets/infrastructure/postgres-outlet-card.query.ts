import type { DataSource } from 'typeorm';
import type { OutletCardQuery } from '../application/ports/outlet-repositories.js';
import type { OutletCard } from '../application/read-models/outlet-card.js';
import type { RankingWindow } from '../../shared/domain/value-types.js';

export class PostgresOutletCardQuery implements OutletCardQuery {
  constructor(private readonly database: DataSource) {}
  async get(
    outletId: string,
    window: RankingWindow,
    asOf: string,
  ): Promise<OutletCard | null> {
    const rows: { card: OutletCard }[] = await this.database.query(
      `
      WITH bounds AS (
        SELECT o.*, $3::timestamptz AS as_of,
          -- Local midnight is converted back to UTC; DST days need not be 24 hours.
          date_trunc('day',$3::timestamptz AT TIME ZONE o.time_zone) AT TIME ZONE o.time_zone AS midnight,
          CASE WHEN $2 = 'hour' THEN $3::timestamptz - interval '1 hour'
          ELSE date_trunc('day',$3::timestamptz AT TIME ZONE o.time_zone) AT TIME ZONE o.time_zone END AS starts_at
        FROM outlets o WHERE outlet_id = $1
      ), facts AS (
        SELECT occurred_at,gross_amount_minor::numeric AS amount,1 AS receipts FROM sale_receipts WHERE outlet_id=$1
        UNION ALL SELECT occurred_at,-amount_minor::numeric,0 FROM return_events WHERE outlet_id=$1
      ), selected AS (
        -- Occurrence-time half-open bounds exclude a sale/return at as_of.
        SELECT f.* FROM facts f CROSS JOIN bounds b WHERE f.occurred_at>=b.starts_at AND f.occurred_at<b.as_of
      ), metrics AS (
        SELECT COALESCE(sum(amount),0) AS net, COALESCE(sum(receipts),0) AS receipts FROM selected
      ), bins AS (
        SELECT start,LEAST(start + CASE WHEN $2='hour' THEN interval '5 minutes' ELSE interval '1 hour' END,b.as_of) AS finish
        FROM bounds b CROSS JOIN LATERAL generate_series(b.starts_at,b.as_of,
          CASE WHEN $2='hour' THEN interval '5 minutes' ELSE interval '1 hour' END) AS start
        WHERE start<b.as_of
      ), bucket_metrics AS (
        SELECT start,finish,COALESCE(sum(f.amount),0) AS net,COALESCE(sum(f.receipts),0) AS receipts
        FROM bins LEFT JOIN selected f ON f.occurred_at>=start AND f.occurred_at<finish GROUP BY start,finish
      ), product_facts AS (
        SELECT l.product_id,l.quantity::numeric AS quantity,l.line_amount_minor::numeric AS amount,s.occurred_at
        FROM sale_lines l JOIN sale_receipts s USING(receipt_id) WHERE s.outlet_id=$1
        UNION ALL SELECT l.product_id,-r.quantity::numeric,-r.amount_minor::numeric,e.occurred_at
        FROM return_lines r JOIN return_events e USING(event_id)
        JOIN sale_lines l ON l.receipt_id=r.sale_receipt_id AND l.sale_line_id=r.sale_line_id WHERE e.outlet_id=$1
      ), top AS (
        SELECT p.product_id,p.name,sum(f.quantity) AS quantity,sum(f.amount) AS net
        FROM product_facts f JOIN products p USING(product_id) CROSS JOIN bounds b
        WHERE f.occurred_at>=b.starts_at AND f.occurred_at<b.as_of GROUP BY p.product_id,p.name
        ORDER BY net DESC,p.product_id LIMIT 10
      ), today AS (
        SELECT COALESCE(sum(f.amount),0) AS net FROM facts f CROSS JOIN bounds b
        WHERE f.occurred_at>=b.midnight AND f.occurred_at<b.as_of
      )
      SELECT jsonb_build_object(
        'outlet',jsonb_build_object('outlet_id',b.outlet_id,'name',b.name,'time_zone',b.time_zone),
        'settings',jsonb_build_object('outlet_id',b.outlet_id,'daily_plan_minor',b.daily_plan_minor::text,
          'responsible_person',jsonb_build_object('name',b.responsible_name,'email',b.responsible_email)),
        'as_of',to_char(b.as_of AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'window',$2::text,
        'metrics',jsonb_build_object('net_revenue_minor',m.net::text,'receipt_count',m.receipts,
          'average_check_minor',(m.net/NULLIF(m.receipts,0))::text),
        'series',COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'starts_at',to_char(start AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'ends_at',to_char(finish AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'metrics',jsonb_build_object('net_revenue_minor',net::text,'receipt_count',receipts,
          'average_check_minor',(net/NULLIF(receipts,0))::text)) ORDER BY start) FROM bucket_metrics),'[]'::jsonb),
        'top_products',COALESCE((SELECT jsonb_agg(jsonb_build_object('product_id',product_id,'name',name,
          'net_quantity',quantity,'net_revenue_minor',net::text) ORDER BY net DESC,product_id) FROM top),'[]'::jsonb),
        'today_plan',jsonb_build_object('local_date',(b.as_of AT TIME ZONE b.time_zone)::date::text,
          'daily_plan_minor',b.daily_plan_minor::text,'net_revenue_minor',t.net::text,
          'progress_bps',round(t.net*10000/b.daily_plan_minor))
      ) AS card FROM bounds b CROSS JOIN metrics m CROSS JOIN today t
    `,
      [outletId, window, asOf],
    );
    return rows[0]?.card ?? null;
  }
}
