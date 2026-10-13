import type { Clock } from '../../shared/application/ports/clock.js';
import type { EvaluateStaleAlerts } from './evaluate-stale-alerts.js';
import type { EvaluateMiddayAlerts } from './evaluate-midday-alerts.js';
export class EvaluateAlerts {
  constructor(
    private readonly stale: EvaluateStaleAlerts,
    private readonly midday: EvaluateMiddayAlerts,
    private readonly clock: Clock,
  ) {}
  async execute(): Promise<void> {
    const asOf = this.clock.now();
    await this.stale.execute(asOf);
    await this.midday.execute(asOf);
  }
}
