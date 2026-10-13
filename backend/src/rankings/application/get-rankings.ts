/* Internal deps */
import type { RankingWindow } from '../../shared/domain/value-types.js';
import type { RankingQuery } from './ports/ranking-ports.js';
import type { RankingSnapshot } from './read-models/ranking.js';

export class GetRankings {
  constructor(private readonly rankingQuery: RankingQuery) {}

  execute(window: RankingWindow): Promise<RankingSnapshot> {
    return this.rankingQuery.get(window);
  }
}
