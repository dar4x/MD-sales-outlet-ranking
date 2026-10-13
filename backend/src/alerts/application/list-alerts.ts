import type { AlertQuery, AlertFilter } from './ports/alert-repositories.js';
import type { AlertEpisode } from '../domain/alert.js';
export class ListAlerts {
  constructor(private readonly query: AlertQuery) {}
  execute(filter: AlertFilter): Promise<AlertEpisode[]> {
    return this.query.list(filter);
  }
}
