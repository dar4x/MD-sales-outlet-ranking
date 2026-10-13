export type Identifier = string;
export type UtcTimestamp = string;
export type LocalDate = string;
export type IanaTimeZone = string;
export type MinorUnits = bigint;
export type MoneyString = string;
export type NumericString = string;
export type RankingWindow = 'hour' | 'business_day';
export type EventKind = 'sale' | 'return';
export interface ResponsiblePerson {
  name: string;
  email: string;
}
