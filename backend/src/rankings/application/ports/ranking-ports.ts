import type {
  RankingWindow,
  UtcTimestamp,
} from '../../../shared/domain/value-types.js';
import type { RankingSnapshot } from '../read-models/ranking.js';
export interface RankingQuery {
  get(window: RankingWindow, asOf?: UtcTimestamp): Promise<RankingSnapshot>;
}
export interface RankingPublisher {
  subscribedWindows(): RankingWindow[];
  publish(snapshot: RankingSnapshot): Promise<void>;
}
// Request only after commit; the adapter coalesces batches using env cadence.
export interface RankingRefreshRequester {
  request(): void;
}
