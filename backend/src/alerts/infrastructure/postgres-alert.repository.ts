import type { EntityManager } from 'typeorm';
import type {
  AlertEpisodeRepository,
  AlertQuery,
  AlertFilter,
} from '../application/ports/alert-repositories.js';
import type { AlertEpisode } from '../domain/alert.js';

interface AlertRow {
  episode_id: string;
  outlet_id: string;
  local_date: string | null;
  opened_at: Date;
  resolved_at: Date | null;
  facts:
    | {
        kind: 'stale';
        last_activity_at: string;
        timeout_seconds: number;
        recipient: { name: string; email: string };
      }
    | {
        kind: 'behind_plan';
        daily_plan_minor: string;
        net_revenue_minor: string;
        cutoff_at: string;
        recipient: { name: string; email: string };
      };
}
export function mapAlert(row: AlertRow): AlertEpisode {
  const facts =
    row.facts.kind === 'stale'
      ? row.facts
      : {
          ...row.facts,
          daily_plan_minor: BigInt(row.facts.daily_plan_minor),
          net_revenue_minor: BigInt(row.facts.net_revenue_minor),
        };
  return {
    episode_id: row.episode_id,
    outlet_id: row.outlet_id,
    local_date: row.local_date,
    opened_at: row.opened_at.toISOString(),
    resolved_at: row.resolved_at?.toISOString() ?? null,
    facts,
  };
}
export class PostgresAlertRepository
  implements AlertEpisodeRepository, AlertQuery
{
  constructor(private readonly manager: EntityManager) {}
  async findOpenForUpdate(
    outletId: string,
    kind: 'stale' | 'behind_plan',
  ): Promise<AlertEpisode | null> {
    const rows: AlertRow[] = await this.manager.query(
      `SELECT *,local_date::text AS local_date FROM alert_episodes
      WHERE outlet_id=$1 AND kind=$2 AND resolved_at IS NULL FOR UPDATE`,
      [outletId, kind],
    );
    return rows[0] === undefined ? null : mapAlert(rows[0]);
  }
  async insert(
    episode: AlertEpisode,
  ): Promise<'inserted' | 'episode_conflict'> {
    const facts = JSON.stringify(episode.facts, (_key, value: unknown) =>
      typeof value === 'bigint' ? value.toString() : value,
    );
    const rows: unknown[] = await this.manager.query(
      `INSERT INTO alert_episodes(episode_id,outlet_id,kind,local_date,opened_at,resolved_at,facts)
      VALUES($1,$2,$3,$4,$5,$6,$7::jsonb) ON CONFLICT DO NOTHING RETURNING episode_id`,
      [
        episode.episode_id,
        episode.outlet_id,
        episode.facts.kind,
        episode.local_date,
        episode.opened_at,
        episode.resolved_at,
        facts,
      ],
    );
    return rows.length === 0 ? 'episode_conflict' : 'inserted';
  }
  async resolve(episodeId: string, resolvedAt: string): Promise<void> {
    await this.manager.query(
      'UPDATE alert_episodes SET resolved_at=$2 WHERE episode_id=$1 AND resolved_at IS NULL',
      [episodeId, resolvedAt],
    );
  }
  async resolveStale(outletId: string, resolvedAt: string): Promise<void> {
    await this.manager.query(
      `UPDATE alert_episodes SET resolved_at=GREATEST(opened_at,$2::timestamptz)
      WHERE outlet_id=$1 AND kind='stale' AND resolved_at IS NULL`,
      [outletId, resolvedAt],
    );
  }
  async list(filter: AlertFilter): Promise<AlertEpisode[]> {
    const rows: AlertRow[] = await this.manager.query(
      `SELECT a.*,a.local_date::text AS local_date FROM alert_episodes a
      JOIN outlets o USING(outlet_id) WHERE ($1::boolean=false OR (a.resolved_at IS NULL AND
        (a.kind='stale' OR a.local_date=(clock_timestamp() AT TIME ZONE o.time_zone)::date)))
      AND ($2::uuid IS NULL OR a.outlet_id=$2) ORDER BY a.opened_at DESC,a.episode_id`,
      [filter.active_only, filter.outlet_id ?? null],
    );
    return rows.map(mapAlert);
  }
}
