export const rankingWindows = ['hour', 'business_day'] as const;
export type RankingWindow = (typeof rankingWindows)[number];

// Independent wire types; money stays in integer minor-unit strings.
export interface RankingRow {
  outlet_id: string;
  outlet_name: string;
  time_zone: string;
  local_date: string;
  starts_at: string;
  ends_at: string;
  rank: number;
  net_revenue_minor: string;
  receipt_count: number;
  average_check_minor: string | null;
  previous_revenue_minor: string | null;
  dynamics_bps: number | null;
  is_leader: boolean;
  is_laggard: boolean;
  stale: boolean;
  behind_plan: boolean;
}

export interface RankingSnapshot {
  snapshot_id: string;
  as_of: string;
  window: RankingWindow;
  currency: string;
  rows: RankingRow[];
}

export function isRankingWindow(value: unknown): value is RankingWindow {
  return value === 'hour' || value === 'business_day';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMoney(value: unknown): value is string {
  return typeof value === 'string' && /^-?\d+$/.test(value);
}

function isTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T.*Z$/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function isRankingRow(value: unknown): value is RankingRow {
  if (!isRecord(value)) return false;
  return (
    ['outlet_id', 'outlet_name', 'time_zone', 'local_date'].every(
      (key) => typeof value[key] === 'string',
    ) &&
    isTimestamp(value.starts_at) &&
    isTimestamp(value.ends_at) &&
    Number.isSafeInteger(value.rank) &&
    (value.rank as number) > 0 &&
    Number.isSafeInteger(value.receipt_count) &&
    (value.receipt_count as number) >= 0 &&
    isMoney(value.net_revenue_minor) &&
    (value.average_check_minor === null ||
      isMoney(value.average_check_minor)) &&
    (value.previous_revenue_minor === null ||
      isMoney(value.previous_revenue_minor)) &&
    (value.dynamics_bps === null || Number.isSafeInteger(value.dynamics_bps)) &&
    ['is_leader', 'is_laggard', 'stale', 'behind_plan'].every(
      (key) => typeof value[key] === 'boolean',
    )
  );
}

export function isRankingSnapshot(value: unknown): value is RankingSnapshot {
  return (
    isRecord(value) &&
    typeof value.snapshot_id === 'string' &&
    isTimestamp(value.as_of) &&
    isRankingWindow(value.window) &&
    typeof value.currency === 'string' &&
    /^[A-Z]{3}$/.test(value.currency) &&
    Array.isArray(value.rows) &&
    value.rows.every(isRankingRow)
  );
}
