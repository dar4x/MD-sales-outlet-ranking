import type { OutletQuery } from './ports/outlet-repositories.js';
import type { OutletSettings } from '../domain/outlet.js';
export class GetOutletSettings {
  constructor(private readonly query: OutletQuery) {}
  execute(outletId: string): Promise<OutletSettings | null> {
    return this.query.settings(outletId);
  }
}
