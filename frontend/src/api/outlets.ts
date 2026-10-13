import { isOutletCard, isOutletList, isOutletSettings } from '../types/outlets';
import type {
  OutletCard,
  OutletSettings,
  OutletSettingsPatch,
  OutletSummary,
} from '../types/outlets';
import type { RankingWindow } from '../types/rankings';
import { getJson } from './http-client';

export async function getOutlets(
  signal: AbortSignal,
): Promise<OutletSummary[]> {
  const payload = await getJson('outlets', signal);
  if (!isOutletList(payload))
    throw new Error('Unexpected outlet list response.');
  return payload.items;
}
export async function getOutletCard(
  id: string,
  window: RankingWindow,
  signal: AbortSignal,
): Promise<OutletCard> {
  const payload = await getJson(
    `outlets/${encodeURIComponent(id)}/card?window=${window}`,
    signal,
  );
  if (
    !isOutletCard(payload) ||
    payload.outlet.outlet_id !== id ||
    payload.window !== window
  )
    throw new Error('Unexpected outlet card response.');
  return payload;
}
export async function getOutletSettings(
  id: string,
  signal: AbortSignal,
): Promise<OutletSettings> {
  const payload = await getJson(
    `outlets/${encodeURIComponent(id)}/settings`,
    signal,
  );
  if (!isOutletSettings(payload) || payload.outlet_id !== id)
    throw new Error('Unexpected outlet settings response.');
  return payload;
}
export async function patchOutletSettings(
  id: string,
  patch: OutletSettingsPatch,
  signal: AbortSignal,
): Promise<OutletSettings> {
  const payload = await getJson(
    `outlets/${encodeURIComponent(id)}/settings`,
    signal,
    { method: 'PATCH', body: JSON.stringify(patch) },
  );
  if (!isOutletSettings(payload) || payload.outlet_id !== id)
    throw new Error('Unexpected outlet settings response.');
  return payload;
}
