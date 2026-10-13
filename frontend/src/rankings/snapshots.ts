import type { RankingSnapshot } from '../types/rankings';

export interface SnapshotHistory {
  snapshot: RankingSnapshot | null;
  previous: RankingSnapshot | null;
}

export function acceptSnapshot(
  history: SnapshotHistory,
  next: RankingSnapshot,
): SnapshotHistory {
  const current = history.snapshot;
  if (
    current &&
    current.window === next.window &&
    (current.snapshot_id === next.snapshot_id ||
      Date.parse(next.as_of) < Date.parse(current.as_of))
  ) {
    return history;
  }
  return {
    snapshot: next,
    previous: current?.window === next.window ? current : null,
  };
}

export function rankMovement(
  previous: RankingSnapshot | null,
  outletId: string,
  rank: number,
): number | null {
  const oldRow = previous?.rows.find((row) => row.outlet_id === outletId);
  return oldRow ? oldRow.rank - rank : null;
}
