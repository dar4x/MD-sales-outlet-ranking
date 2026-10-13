import type {
  Identifier,
  RankingWindow,
  UtcTimestamp,
} from '../../../shared/domain/value-types.js';
import type {
  Outlet,
  OutletSettings,
  OutletSettingsPatch,
} from '../../domain/outlet.js';
import type { OutletCard, OutletSummary } from '../read-models/outlet-card.js';
export interface OutletRepository {
  findForUpdate(outletId: Identifier): Promise<Outlet | null>;
  updateSettings(
    outletId: Identifier,
    patch: OutletSettingsPatch,
  ): Promise<Outlet | null>;
}
export interface OutletQuery {
  settings(outletId: Identifier): Promise<OutletSettings | null>;
  list(): Promise<OutletSummary[]>;
}
export interface OutletCardQuery {
  get(
    outletId: Identifier,
    window: RankingWindow,
    asOf: UtcTimestamp,
  ): Promise<OutletCard | null>;
}
