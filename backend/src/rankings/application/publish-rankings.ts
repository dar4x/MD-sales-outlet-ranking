/* Internal deps */
import type { GetRankings } from './get-rankings.js';
import type { RankingPublisher } from './ports/ranking-ports.js';

export class PublishRankings {
  constructor(
    private readonly getRankings: GetRankings,
    private readonly publisher: RankingPublisher,
  ) {}

  async execute(): Promise<void> {
    for (const window of this.publisher.subscribedWindows()) {
      const snapshot = await this.getRankings.execute(window);
      await this.publisher.publish(snapshot);
    }
  }
}
