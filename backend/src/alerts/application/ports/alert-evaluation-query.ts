import type {
  Identifier,
  LocalDate,
  MinorUnits,
  ResponsiblePerson,
  UtcTimestamp,
} from '../../../shared/domain/value-types.js';
export interface AlertEvaluation {
  outlet_id: Identifier;
  local_date: LocalDate;
  last_activity_at: UtcTimestamp;
  cutoff_at: UtcTimestamp;
  next_midnight_at: UtcTimestamp;
  noon_due: boolean;
  daily_plan_minor: MinorUnits;
  noon_net_revenue_minor: MinorUnits;
  responsible_person: ResponsiblePerson;
}
export interface AlertEvaluationQuery {
  list(asOf: UtcTimestamp, outletId?: Identifier): Promise<AlertEvaluation[]>;
}
