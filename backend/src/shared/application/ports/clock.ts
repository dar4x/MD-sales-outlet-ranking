import type { UtcTimestamp } from '../../domain/value-types.js';
export interface Clock {
  now(): UtcTimestamp;
}
