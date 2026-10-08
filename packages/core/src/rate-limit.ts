/** Sliding-window limiter keyed by origin. In-memory: a SW restart resets it, which is acceptable. */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private limit: number,
    private windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  configure(limit: number, windowMs: number): void {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  /** Returns true and records the hit when allowed. */
  tryAcquire(key: string): boolean {
    const t = this.now();
    const list = (this.hits.get(key) ?? []).filter((x) => t - x < this.windowMs);
    if (list.length >= this.limit) {
      this.hits.set(key, list);
      return false;
    }
    list.push(t);
    this.hits.set(key, list);
    return true;
  }

  retryAfterMs(key: string): number {
    const list = this.hits.get(key);
    if (!list?.length) return 0;
    return Math.max(0, this.windowMs - (this.now() - list[0]!));
  }
}
