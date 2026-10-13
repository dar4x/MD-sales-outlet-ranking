import type { EntityManager } from 'typeorm';
import type { MiddayAssessmentRepository } from '../application/ports/alert-repositories.js';
import type { MiddayAssessment } from '../domain/alert.js';
export class PostgresMiddayAssessmentRepository implements MiddayAssessmentRepository {
  constructor(private readonly manager: EntityManager) {}
  async find(outletId: string, date: string): Promise<MiddayAssessment | null> {
    const rows: {
      outlet_id: string;
      local_date: string;
      cutoff_at: Date;
      assessed_at: Date;
      daily_plan_minor: string;
      net_revenue_minor: string;
      behind_plan: boolean;
    }[] = await this.manager.query(
      'SELECT *,local_date::text AS local_date FROM midday_assessments WHERE outlet_id=$1 AND local_date=$2',
      [outletId, date],
    );
    const row = rows[0];
    if (row === undefined) return null;
    return {
      ...row,
      cutoff_at: row.cutoff_at.toISOString(),
      assessed_at: row.assessed_at.toISOString(),
      daily_plan_minor: BigInt(row.daily_plan_minor),
      net_revenue_minor: BigInt(row.net_revenue_minor),
    };
  }
  async insert(
    assessment: MiddayAssessment,
  ): Promise<'inserted' | 'assessment_conflict'> {
    const rows: unknown[] = await this.manager.query(
      `INSERT INTO midday_assessments(outlet_id,local_date,cutoff_at,assessed_at,daily_plan_minor,net_revenue_minor,behind_plan)
      VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING RETURNING outlet_id`,
      [
        assessment.outlet_id,
        assessment.local_date,
        assessment.cutoff_at,
        assessment.assessed_at,
        assessment.daily_plan_minor.toString(),
        assessment.net_revenue_minor.toString(),
        assessment.behind_plan,
      ],
    );
    return rows.length === 0 ? 'assessment_conflict' : 'inserted';
  }
}
