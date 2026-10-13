import type {
  Identifier,
  IanaTimeZone,
  LocalDate,
  MoneyString,
  NumericString,
  RankingWindow,
  ResponsiblePerson,
  UtcTimestamp,
} from '../../../shared/domain/value-types.js';
export interface OutletSummary {
  outlet_id: Identifier;
  name: string;
  time_zone: IanaTimeZone;
}
export interface OutletSettingsView {
  outlet_id: Identifier;
  daily_plan_minor: MoneyString;
  responsible_person: ResponsiblePerson;
}
export interface CardMetrics {
  net_revenue_minor: MoneyString;
  receipt_count: number;
  average_check_minor: NumericString | null;
}
export interface SalesBucket {
  starts_at: UtcTimestamp;
  ends_at: UtcTimestamp;
  metrics: CardMetrics;
}
export interface TopProduct {
  product_id: Identifier;
  name: string;
  net_quantity: number;
  net_revenue_minor: MoneyString;
}
export interface TodayPlan {
  local_date: LocalDate;
  daily_plan_minor: MoneyString;
  net_revenue_minor: MoneyString;
  progress_bps: number;
}
export interface OutletCard {
  outlet: OutletSummary;
  settings: OutletSettingsView;
  as_of: UtcTimestamp;
  window: RankingWindow;
  metrics: CardMetrics;
  series: SalesBucket[];
  top_products: TopProduct[];
  today_plan: TodayPlan;
}
