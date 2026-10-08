import { describe, expect, it } from 'vitest';
import type { PrintJobRecord } from '@xdev/shared-types';
import { RateLimiter, ReplayGuard, canTransition, isTerminal, recoverAfterRestart, transition } from '../src';

function job(state: PrintJobRecord['state']): PrintJobRecord {
  return { jobId: 'job_1', idempotencyKey: 'k-12345678', origin: 'https://a.vn', documentType: 'X', format: 'PDF', sizeBytes: 1, state, attempts: 0, createdAt: 0, updatedAt: 0, history: [{ state, at: 0 }] };
}

describe('job state machine', () => {
  it('has no COMPLETED state and terminal states are final', () => {
    for (const s of ['SUBMITTED', 'FAILED', 'CANCELLED', 'UNKNOWN'] as const) {
      expect(isTerminal(s)).toBe(true);
      expect(canTransition(s, 'QUEUED')).toBe(false);
    }
  });

  it('follows the happy path and records history', () => {
    let j = job('CREATED');
    for (const s of ['VALIDATING', 'QUEUED', 'DISPATCHING', 'SUBMITTED'] as const) j = transition(j, s, {}, 5);
    expect(j.history.map((h) => h.state)).toEqual(['CREATED', 'VALIDATING', 'QUEUED', 'DISPATCHING', 'SUBMITTED']);
    expect(j.updatedAt).toBe(5);
  });

  it('rejects illegal transitions', () => {
    expect(() => transition(job('CREATED'), 'SUBMITTED')).toThrow(/Illegal/);
    expect(() => transition(job('QUEUED'), 'UNKNOWN')).toThrow(/Illegal/);
  });

  it('after a restart resumes QUEUED but never re-sends DISPATCHING', () => {
    expect(recoverAfterRestart(job('QUEUED'))).toMatchObject({ resume: true, job: { state: 'QUEUED' } });
    expect(recoverAfterRestart(job('DISPATCHING'))).toMatchObject({ resume: false, job: { state: 'UNKNOWN', outcome: 'INTERRUPTED_DURING_DISPATCH' } });
    expect(recoverAfterRestart(job('WAITING_PERMISSION')).job.state).toBe('CANCELLED');
    expect(recoverAfterRestart(job('VALIDATING')).job.state).toBe('FAILED');
    expect(recoverAfterRestart(job('SUBMITTED'))).toMatchObject({ resume: false, job: { state: 'SUBMITTED' } });
  });
});

describe('RateLimiter', () => {
  it('limits per key inside the window and frees up afterwards', () => {
    let now = 0;
    const rl = new RateLimiter(2, 1000, () => now);
    expect(rl.tryAcquire('a')).toBe(true);
    expect(rl.tryAcquire('a')).toBe(true);
    expect(rl.tryAcquire('a')).toBe(false);
    expect(rl.tryAcquire('b')).toBe(true);
    expect(rl.retryAfterMs('a')).toBe(1000);
    now = 1000;
    expect(rl.tryAcquire('a')).toBe(true);
  });
});

describe('ReplayGuard', () => {
  it('rejects reused requestIds per key and stale timestamps', () => {
    let now = 100_000;
    const g = new ReplayGuard(60_000, () => now);
    g.check('a', 'req_00000001', now);
    expect(() => g.check('a', 'req_00000001', now)).toThrowError(expect.objectContaining({ code: 'REPLAY_DETECTED' }));
    expect(() => g.check('b', 'req_00000001', now)).not.toThrow();
    expect(() => g.check('a', 'req_00000002', now - 60_001)).toThrowError(expect.objectContaining({ code: 'REPLAY_DETECTED' }));
    expect(() => g.check('a', 'short', now)).toThrowError(expect.objectContaining({ code: 'INVALID_REQUEST' }));
    now += 1;
  });
});
