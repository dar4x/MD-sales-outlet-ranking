import type {
  Identifier,
  IanaTimeZone,
  LocalDate,
  MoneyString,
  NumericString,
  RankingWindow,
  UtcTimestamp,
} from '../../../shared/domain/value-types.js';
export interface RankingMetrics {
  net_revenue_minor: MoneyString;
  receipt_count: number;
  average_check_minor: NumericString | null;
}
export interface RankingRow extends RankingMetrics {
  outlet_id: Identifier;
  outlet_name: string;
  time_zone: IanaTimeZone;
  local_date: LocalDate;
  starts_at: UtcTimestamp;
  ends_at: UtcTimestamp;
  rank: number;
  previous_revenue_minor: MoneyString | null;
  dynamics_bps: number | null;
  is_leader: boolean;
  is_laggard: boolean;
  stale: boolean;
  behind_plan: boolean;
}
export interface RankingSnapshot {
  snapshot_id: Identifier;
  as_of: UtcTimestamp;
  window: RankingWindow;
  currency: string;
  rows: RankingRow[];
}
