import { isRankingWindow } from './rankings';
import type { RankingWindow } from './rankings';
import {
  isList,
  isMoney,
  isNumericString,
  isRecord,
  isSafeInteger,
  isString,
  isTimestamp,
} from './validation';

export interface ResponsiblePerson {
  name: string;
  email: string;
}
export interface OutletSummary {
  outlet_id: string;
  name: string;
  time_zone: string;
}
export interface OutletSettings {
  outlet_id: string;
  daily_plan_minor: string;
  responsible_person: ResponsiblePerson;
}
export interface OutletSettingsPatch {
  daily_plan_minor?: string;
  responsible_person?: ResponsiblePerson;
}
export interface CardMetrics {
  net_revenue_minor: string;
  receipt_count: number;
  average_check_minor: string | null;
}
export interface SalesBucket {
  starts_at: string;
  ends_at: string;
  metrics: CardMetrics;
}
export interface TopProduct {
  product_id: string;
  name: string;
  net_quantity: number;
  net_revenue_minor: string;
}
export interface TodayPlan {
  local_date: string;
  daily_plan_minor: string;
  net_revenue_minor: string;
  progress_bps: number;
}
export interface OutletCard {
  outlet: OutletSummary;
  settings: OutletSettings;
  as_of: string;
  window: RankingWindow;
  metrics: CardMetrics;
  series: SalesBucket[];
  top_products: TopProduct[];
  today_plan: TodayPlan;
}

export function isResponsiblePerson(
  value: unknown,
): value is ResponsiblePerson {
  return isRecord(value) && isString(value.name) && isString(value.email);
}
export function isOutletSummary(value: unknown): value is OutletSummary {
  return (
    isRecord(value) &&
    isString(value.outlet_id) &&
    isString(value.name) &&
    isString(value.time_zone)
  );
}
export function isOutletList(
  value: unknown,
): value is { items: OutletSummary[] } {
  return isList(value, isOutletSummary);
}
export function isOutletSettings(value: unknown): value is OutletSettings {
  return (
    isRecord(value) &&
    isString(value.outlet_id) &&
    isMoney(value.daily_plan_minor) &&
    /^[1-9]\d*$/.test(value.daily_plan_minor) &&
    isResponsiblePerson(value.responsible_person)
  );
}
function isMetrics(value: unknown): value is CardMetrics {
  return (
    isRecord(value) &&
    isMoney(value.net_revenue_minor) &&
    isSafeInteger(value.receipt_count) &&
    value.receipt_count >= 0 &&
    (value.average_check_minor === null ||
      isNumericString(value.average_check_minor))
  );
}
function isBucket(value: unknown): value is SalesBucket {
  return (
    isRecord(value) &&
    isTimestamp(value.starts_at) &&
    isTimestamp(value.ends_at) &&
    isMetrics(value.metrics)
  );
}
function isTopProduct(value: unknown): value is TopProduct {
  return (
    isRecord(value) &&
    isString(value.product_id) &&
    isString(value.name) &&
    typeof value.net_quantity === 'number' &&
    Number.isInteger(value.net_quantity) &&
    isMoney(value.net_revenue_minor)
  );
}
function isTodayPlan(value: unknown): value is TodayPlan {
  return (
    isRecord(value) &&
    isString(value.local_date) &&
    isMoney(value.daily_plan_minor) &&
    isMoney(value.net_revenue_minor) &&
    typeof value.progress_bps === 'number' &&
    Number.isInteger(value.progress_bps)
  );
}
export function isOutletCard(value: unknown): value is OutletCard {
  return (
    isRecord(value) &&
    isOutletSummary(value.outlet) &&
    isOutletSettings(value.settings) &&
    value.outlet.outlet_id === value.settings.outlet_id &&
    isTimestamp(value.as_of) &&
    isRankingWindow(value.window) &&
    isMetrics(value.metrics) &&
    Array.isArray(value.series) &&
    value.series.every(isBucket) &&
    Array.isArray(value.top_products) &&
    value.top_products.every(isTopProduct) &&
    isTodayPlan(value.today_plan)
  );
}
