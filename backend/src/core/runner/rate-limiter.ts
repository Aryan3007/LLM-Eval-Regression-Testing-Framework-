/** Spaces request starts evenly so we never exceed `rpm` requests per minute. */
export class RateLimiter {
  private nextAt = 0;
  private readonly intervalMs: number;

  constructor(rpm: number | undefined) {
    this.intervalMs = rpm ? 60_000 / rpm : 0;
  }

  async take(signal?: AbortSignal): Promise<void> {
    if (this.intervalMs === 0) return;
    const now = Date.now();
    const at = Math.max(now, this.nextAt);
    this.nextAt = at + this.intervalMs;
    const wait = at - now;
    if (wait > 0) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, wait);
        signal?.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            reject(signal.reason as Error);
          },
          { once: true },
        );
      });
    }
  }
}
