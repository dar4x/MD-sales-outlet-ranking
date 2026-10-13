/* Internal deps */
import type { Clock } from '../application/ports/clock.js';

// Real time in UTC ISO format (with Z), as the API contract requires.
export class SystemClock implements Clock {
  now(): string {
    return new Date().toISOString();
  }
}
