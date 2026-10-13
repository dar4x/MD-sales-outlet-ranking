import type { TransactionRunner } from '../../shared/application/ports/transaction-runner.js';
import type { RankingRefreshRequester } from '../../rankings/application/ports/ranking-ports.js';
import type { Outlet, OutletSettingsPatch } from '../domain/outlet.js';
import { EventValidationError } from '../../events/domain/event-errors.js';

export class UpdateOutletSettings {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly refresh: RankingRefreshRequester,
  ) {}
  async execute(
    outletId: string,
    patch: OutletSettingsPatch,
  ): Promise<Outlet | null> {
    if (
      patch.daily_plan_minor === undefined &&
      patch.responsible_person === undefined
    )
      throw new EventValidationError(
        'invalid_request',
        'A settings patch must be nonempty.',
      );
    if (
      patch.daily_plan_minor !== undefined &&
      (patch.daily_plan_minor <= 0n ||
        patch.daily_plan_minor > 9223372036854775807n)
    ) {
      throw new EventValidationError(
        'invalid_plan',
        'Daily plan must be a positive storable minor-unit value.',
      );
    }
    const updated = await this.transactions.run(async (ports) => {
      if ((await ports.outlets.findForUpdate(outletId)) === null) return null;
      return ports.outlets.updateSettings(outletId, patch);
    });
    if (updated !== null) this.refresh.request();
    return updated;
  }
}
