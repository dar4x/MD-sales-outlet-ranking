export class AlertScheduler {
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;
  private stopped = false;
  constructor(
    private readonly evaluate: () => Promise<void>,
    private readonly intervalMs: number,
    private readonly log: (error: unknown) => void,
  ) {}
  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.tick();
    }, this.intervalMs);
  }
  async tick(): Promise<void> {
    if (this.running || this.stopped) return;
    this.running = true;
    try {
      await this.evaluate();
    } catch (error) {
      this.log(error);
    } finally {
      this.running = false;
    }
  }
  onModuleDestroy(): void {
    this.stopped = true;
    clearInterval(this.timer);
  }
}
