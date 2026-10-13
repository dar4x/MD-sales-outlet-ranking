/* Internal deps */
import type { RankingRefreshRequester } from '../application/ports/ranking-ports.js';

export class CoalescedRankingRefresh implements RankingRefreshRequester {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private interval: ReturnType<typeof setInterval> | undefined;
  private running = false;
  private pending = false;
  private stopped = false;

  constructor(
    private readonly refresh: () => Promise<void>,
    private readonly delayMs: number,
    private readonly logFailure: (error: unknown) => void,
    private readonly intervalMs?: number,
  ) {}

  onModuleInit(): void {
    if (this.intervalMs !== undefined && !this.stopped) {
      this.interval = setInterval(() => {
        // A timer tick must not keep postponing an already queued event refresh.
        if (this.timer === undefined) this.request();
      }, this.intervalMs);
    }
  }

  request(): void {
    if (this.stopped) return;
    if (this.running) {
      this.pending = true;
      return;
    }
    // Reset the delay so the read includes the last committed event of a burst.
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.flush();
    }, this.delayMs);
  }

  private async flush(): Promise<void> {
    this.timer = undefined;
    this.running = true;
    do {
      this.pending = false;
      try {
        await this.refresh();
      } catch (error) {
        this.logFailure(error);
      }
      // Requests during the read need one more read after it finishes.
    } while (this.pending && !this.stopped);
    this.running = false;
  }

  onModuleDestroy(): void {
    this.stopped = true;
    clearInterval(this.interval);
    clearTimeout(this.timer);
  }
}
