import { isResponsiblePerson } from './outlets';
import type { ResponsiblePerson } from './outlets';
import {
  isList,
  isMoney,
  isRecord,
  isSafeInteger,
  isString,
  isTimestamp,
} from './validation';

interface AlertBase {
  episode_id: string;
  outlet_id: string;
  local_date: string | null;
  opened_at: string;
  resolved_at: string | null;
}
export type AlertEpisode = AlertBase &
  (
    | {
        kind: 'stale';
        facts: {
          last_activity_at: string;
          timeout_seconds: number;
          recipient: ResponsiblePerson;
        };
      }
    | {
        kind: 'behind_plan';
        facts: {
          daily_plan_minor: string;
          net_revenue_minor: string;
          cutoff_at: string;
          recipient: ResponsiblePerson;
        };
      }
  );

export function isAlertEpisode(value: unknown): value is AlertEpisode {
  if (
    !isRecord(value) ||
    !isString(value.episode_id) ||
    !isString(value.outlet_id) ||
    !(value.local_date === null || isString(value.local_date)) ||
    !isTimestamp(value.opened_at) ||
    !(value.resolved_at === null || isTimestamp(value.resolved_at)) ||
    !isRecord(value.facts) ||
    !isResponsiblePerson(value.facts.recipient)
  )
    return false;
  if (value.kind === 'stale')
    return (
      isTimestamp(value.facts.last_activity_at) &&
      isSafeInteger(value.facts.timeout_seconds) &&
      value.facts.timeout_seconds > 0
    );
  if (value.kind === 'behind_plan')
    return (
      isMoney(value.facts.daily_plan_minor) &&
      isMoney(value.facts.net_revenue_minor) &&
      isTimestamp(value.facts.cutoff_at)
    );
  return false;
}
export function isAlertList(
  value: unknown,
): value is { items: AlertEpisode[] } {
  return isList(value, isAlertEpisode);
}
