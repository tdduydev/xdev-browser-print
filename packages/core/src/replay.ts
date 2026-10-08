import { PrintError } from './errors';

/**
 * Rejects stale requests and reused requestIds. Note this guards against accidental
 * re-sends and naive replays; the origin itself is the trust boundary.
 */
export class ReplayGuard {
  private readonly seen = new Map<string, number>();

  constructor(
    private readonly maxSkewMs = 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  check(key: string, requestId: string, sentAt: number): void {
    const t = this.now();
    if (typeof requestId !== 'string' || requestId.length < 8 || requestId.length > 128) {
      throw new PrintError('INVALID_REQUEST', 'Invalid requestId');
    }
    if (typeof sentAt !== 'number' || Math.abs(t - sentAt) > this.maxSkewMs) {
      throw new PrintError('REPLAY_DETECTED', 'Request timestamp outside the accepted window');
    }
    this.gc(t);
    const id = `${key}|${requestId}`;
    if (this.seen.has(id)) throw new PrintError('REPLAY_DETECTED', 'Duplicate requestId');
    this.seen.set(id, t);
  }

  private gc(t: number): void {
    if (this.seen.size < 1000) return;
    for (const [k, at] of this.seen) if (t - at > this.maxSkewMs * 2) this.seen.delete(k);
  }
}
