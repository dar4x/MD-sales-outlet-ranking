import type {
  Identifier,
  LocalDate,
  UtcTimestamp,
} from '../../../shared/domain/value-types.js';
import type { AlertEpisode, MiddayAssessment } from '../../domain/alert.js';
export interface AlertEpisodeRepository {
  findOpenForUpdate(
    outletId: Identifier,
    kind: 'stale' | 'behind_plan',
  ): Promise<AlertEpisode | null>;
  insert(episode: AlertEpisode): Promise<'inserted' | 'episode_conflict'>;
  resolve(episodeId: Identifier, resolvedAt: UtcTimestamp): Promise<void>;
  resolveStale(outletId: Identifier, resolvedAt: UtcTimestamp): Promise<void>;
}
export interface MiddayAssessmentRepository {
  find(outletId: Identifier, date: LocalDate): Promise<MiddayAssessment | null>;
  insert(
    assessment: MiddayAssessment,
  ): Promise<'inserted' | 'assessment_conflict'>;
}
export interface AlertFilter {
  active_only: boolean;
  outlet_id?: Identifier;
}
export interface AlertQuery {
  list(filter: AlertFilter): Promise<AlertEpisode[]>;
}
