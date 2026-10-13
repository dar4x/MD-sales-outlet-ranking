import type { OutletCardQuery } from './ports/outlet-repositories.js';
import type { Clock } from '../../shared/application/ports/clock.js';
import type { RankingWindow } from '../../shared/domain/value-types.js';
import type { OutletCard } from './read-models/outlet-card.js';

export class GetOutletCard {
  constructor(
    private readonly query: OutletCardQuery,
    private readonly clock: Clock,
  ) {}
  execute(outletId: string, window: RankingWindow): Promise<OutletCard | null> {
    return this.query.get(outletId, window, this.clock.now());
  }
}
