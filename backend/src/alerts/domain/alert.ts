import type {
  Identifier,
  LocalDate,
  MinorUnits,
  ResponsiblePerson,
  UtcTimestamp,
} from '../../shared/domain/value-types.js';
export type AlertFacts =
  | {
      kind: 'stale';
      last_activity_at: UtcTimestamp;
      timeout_seconds: number;
      recipient: ResponsiblePerson;
    }
  | {
      kind: 'behind_plan';
      daily_plan_minor: MinorUnits;
      net_revenue_minor: MinorUnits;
      cutoff_at: UtcTimestamp;
      recipient: ResponsiblePerson;
    };
export interface AlertEpisode {
  episode_id: Identifier;
  outlet_id: Identifier;
  local_date: LocalDate | null;
  opened_at: UtcTimestamp;
  resolved_at: UtcTimestamp | null;
  facts: AlertFacts;
}
export interface MiddayAssessment {
  outlet_id: Identifier;
  local_date: LocalDate;
  cutoff_at: UtcTimestamp;
  assessed_at: UtcTimestamp;
  daily_plan_minor: MinorUnits;
  net_revenue_minor: MinorUnits;
  behind_plan: boolean;
}
