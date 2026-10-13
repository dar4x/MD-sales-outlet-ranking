/* Internal deps */
import type { OutletQuery } from './ports/outlet-repositories.js';
import type { OutletSummary } from './read-models/outlet-card.js';

export class ListOutlets {
  constructor(private readonly outlets: OutletQuery) {}

  execute(): Promise<OutletSummary[]> {
    return this.outlets.list();
  }
}
