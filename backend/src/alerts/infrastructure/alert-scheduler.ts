export class AlertScheduler {
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;
  private stopped = false;
  private active: Promise<void> | undefined;
  constructor(
    private readonly evaluate: () => Promise<void>,
    private readonly intervalMs: number,
    private readonly log: (error: unknown) => void,
  ) {}
  onModuleInit(): void {
    this.timer = setInterval(() => {
      if (!this.running && !this.stopped) this.active = this.tick();
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
  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    clearInterval(this.timer);
    await this.active;
  }
}
