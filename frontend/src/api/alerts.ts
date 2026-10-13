import { isAlertList } from '../types/alerts';
import type { AlertEpisode } from '../types/alerts';
import { getJson } from './http-client';

export async function getAlerts(
  activeOnly: boolean,
  outletId: string,
  signal: AbortSignal,
): Promise<AlertEpisode[]> {
  const query = new URLSearchParams({ active_only: String(activeOnly) });
  if (outletId) query.set('outlet_id', outletId);
  const payload = await getJson(`alerts?${query.toString()}`, signal);
  if (!isAlertList(payload)) throw new Error('Unexpected alerts response.');
  return payload.items;
}
