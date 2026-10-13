import type { DataSource } from 'typeorm';
import type {
  AlertEvaluationQuery,
  AlertEvaluation,
} from '../application/ports/alert-evaluation-query.js';
export class PostgresAlertEvaluationQuery implements AlertEvaluationQuery {
  constructor(private readonly database: Pick<DataSource, 'query'>) {}
  async list(asOf: string, outletId?: string): Promise<AlertEvaluation[]> {
    const rows: {
      outlet_id: string;
      local_date: string;
      last_activity_at: Date;
      cutoff_at: Date;
      next_midnight_at: Date;
      noon_due: boolean;
      daily_plan_minor: string;
      noon_net_revenue_minor: string;
      responsible_name: string;
      responsible_email: string;
    }[] = await this.database.query(
      `
      WITH bounds AS (
        SELECT o.*,($1::timestamptz AT TIME ZONE time_zone)::date AS local_date,
          -- Convert civil noon/midnight back to UTC using the outlet's IANA rules.
          ((($1::timestamptz AT TIME ZONE time_zone)::date+time '12:00') AT TIME ZONE time_zone) AS cutoff_at,
          ((($1::timestamptz AT TIME ZONE time_zone)::date+1)::timestamp AT TIME ZONE time_zone) AS next_midnight_at,
          (($1::timestamptz AT TIME ZONE time_zone)::date::timestamp AT TIME ZONE time_zone) AS midnight
        FROM outlets o WHERE activated_at<=$1 AND ($2::uuid IS NULL OR outlet_id=$2)
      )
      SELECT b.outlet_id,b.local_date::text,COALESCE(last_accepted_at,activated_at) AS last_activity_at,
        cutoff_at,next_midnight_at,$1::timestamptz>=cutoff_at AS noon_due,daily_plan_minor,
        (COALESCE((SELECT sum(gross_amount_minor) FROM sale_receipts s WHERE s.outlet_id=b.outlet_id
          AND s.occurred_at>=b.midnight AND s.occurred_at<b.cutoff_at),0)
         -COALESCE((SELECT sum(amount_minor) FROM return_events r WHERE r.outlet_id=b.outlet_id
          AND r.occurred_at>=b.midnight AND r.occurred_at<b.cutoff_at),0))::text AS noon_net_revenue_minor,
        responsible_name,responsible_email FROM bounds b ORDER BY b.outlet_id
    `,
      [asOf, outletId ?? null],
    );
    return rows.map((row) => ({
      outlet_id: row.outlet_id,
      local_date: row.local_date,
      last_activity_at: row.last_activity_at.toISOString(),
      cutoff_at: row.cutoff_at.toISOString(),
      next_midnight_at: row.next_midnight_at.toISOString(),
      noon_due: row.noon_due,
      daily_plan_minor: BigInt(row.daily_plan_minor),
      noon_net_revenue_minor: BigInt(row.noon_net_revenue_minor),
      responsible_person: {
        name: row.responsible_name,
        email: row.responsible_email,
      },
    }));
  }
}
