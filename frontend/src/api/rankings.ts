import { isRankingSnapshot } from '../types/rankings';
import type { RankingSnapshot, RankingWindow } from '../types/rankings';
import { getJson } from './http-client';

export async function getRankings(
  window: RankingWindow,
  signal: AbortSignal,
): Promise<RankingSnapshot> {
  const payload = await getJson(`rankings?window=${window}`, signal);
  if (!isRankingSnapshot(payload) || payload.window !== window) {
    throw new Error('The server returned an unexpected rankings response.');
  }
  return payload;
}
