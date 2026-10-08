import type {
  AdapterType,
  PrintAccepted,
  PrintConfig,
  PrintJobRecord,
  PrintParams,
  PrinterProfile,
  PublicJobStatus,
} from '@xdev/shared-types';
import {
  PrintError,
  RateLimiter,
  base64ToBytes,
  isTerminal,
  looksLikePdf,
  randomId,
  recoverAfterRestart,
  resolveRoute,
  transition,
  validatePrintParams,
} from '@xdev/core';
import type { PrintAdapter, PrintResult } from '../adapters/types';
import { withTimeout } from '../adapters/types';
import type { JobStore, StoredPayload } from '../storage/job-store';

export interface ConfirmRequest {
  jobId: string;
  origin: string;
  documentType: string;
  format: string;
  sizeBytes: number;
  printerName: string;
}

export interface JobManagerDeps {
  store: JobStore;
  getConfig: () => Promise<PrintConfig>;
  adapters: Record<AdapterType, PrintAdapter>;
  emit: (job: PrintJobRecord) => void;
  /** Asks the user to approve one job (per-site policy). Resolves false on deny/timeout. */
  confirm?: (req: ConfirmRequest) => Promise<boolean>;
  /** A browser job's print window can outlive a service-worker restart. */
  isRunnerAlive?: (jobId: string) => Promise<boolean>;
  now?: () => number;
  maxAttempts?: number;
  retryDelaysMs?: number[];
  dispatchTimeoutMs?: Partial<Record<AdapterType, number>>;
}

export interface SubmitOptions {
  requireConfirmation?: boolean;
}

const DEFAULT_TIMEOUTS: Record<AdapterType, number> = {
  // The user may sit in Chrome's print dialog for a while.
  browser: 15 * 60_000,
  webusb: 60_000,
  webserial: 60_000,
};

export function toPublic(j: PrintJobRecord): PublicJobStatus {
  return {
    jobId: j.jobId,
    idempotencyKey: j.idempotencyKey,
    documentType: j.documentType,
    format: j.format,
    state: j.state,
    ...(j.outcome !== undefined && { outcome: j.outcome }),
    ...(j.errorCode !== undefined && { errorCode: j.errorCode }),
    ...(j.errorMessage !== undefined && { errorMessage: j.errorMessage }),
    ...(j.adapter !== undefined && { adapter: j.adapter }),
    ...(j.profileId !== undefined && { profileId: j.profileId }),
    createdAt: j.createdAt,
    updatedAt: j.updatedAt,
  };
}

export class JobManager {
  private readonly limiter: RateLimiter;
  private readonly lanes = new Map<string, Promise<void>>();
  private readonly pendingKeys = new Set<string>();
  private readonly now: () => number;

  constructor(private readonly deps: JobManagerDeps) {
    this.now = deps.now ?? Date.now;
    this.limiter = new RateLimiter(20, 60_000, this.now);
  }

  async submit(origin: string, raw: PrintParams, opts: SubmitOptions = {}): Promise<PrintAccepted> {
    const config = await this.deps.getConfig();
    const { settings } = config;
    const params = validatePrintParams(raw, settings.maxJobBytes);

    const existing = await this.deps.store.findByIdempotency(origin, params.idempotencyKey);
    if (existing) return { jobId: existing.jobId, state: existing.state, duplicate: true };
    const lockKey = `${origin}|${params.idempotencyKey}`;
    if (this.pendingKeys.has(lockKey)) throw new PrintError('REPLAY_DETECTED', 'A job with this idempotencyKey is being created');

    // Duplicates are answered above without spending rate-limit budget.
    this.limiter.configure(settings.rateLimitJobs, settings.rateLimitWindowMs);
    if (!this.limiter.tryAcquire(origin)) {
      throw new PrintError('RATE_LIMITED', 'Too many print jobs from this site', { retryAfterMs: this.limiter.retryAfterMs(origin) });
    }

    this.pendingKeys.add(lockKey);
    try {
      const t = this.now();
      let job: PrintJobRecord = {
        jobId: randomId('job'),
        idempotencyKey: params.idempotencyKey,
        origin,
        documentType: params.documentType,
        format: params.format,
        sizeBytes: params.sizeBytes,
        state: 'CREATED',
        attempts: 0,
        createdAt: t,
        updatedAt: t,
        history: [{ state: 'CREATED', at: t }],
      };
      await this.save(job);
      job = await this.save(transition(job, 'VALIDATING', {}, this.now()));

      let profile: PrinterProfile;
      let payload: StoredPayload;
      let copies: number;
      try {
        const route = resolveRoute(config, params);
        profile = route.profile;
        copies = route.copies;
        payload = decodePayload(job.jobId, params);
        if (params.format === 'PDF' && payload.kind === 'bytes' && !looksLikePdf(payload.bytes)) {
          throw new PrintError('INVALID_REQUEST', 'data is not a PDF document');
        }
      } catch (e) {
        const err = e instanceof PrintError ? e : new PrintError('INTERNAL_ERROR', 'Validation failed');
        await this.save(transition(job, 'FAILED', { errorCode: err.code, errorMessage: err.message, outcome: 'VALIDATION_FAILED' }, this.now()));
        throw err;
      }

      await this.deps.store.putPayload(payload);
      job = { ...job, profileId: profile.id, adapter: profile.adapter, copies };

      if (opts.requireConfirmation && this.deps.confirm) {
        job = await this.save(transition(job, 'WAITING_PERMISSION', {}, this.now()));
        void this.awaitConfirmation(job, profile);
        return { jobId: job.jobId, state: job.state, duplicate: false };
      }

      job = await this.save(transition(job, 'QUEUED', {}, this.now()));
      this.schedule(job);
      return { jobId: job.jobId, state: job.state, duplicate: false };
    } finally {
      this.pendingKeys.delete(lockKey);
    }
  }

  async get(jobId: string): Promise<PrintJobRecord | undefined> {
    return this.deps.store.get(jobId);
  }

  async findByIdempotency(origin: string, key: string) {
    return this.deps.store.findByIdempotency(origin, key);
  }

  async cancel(jobId: string): Promise<PrintJobRecord> {
    const job = await this.deps.store.get(jobId);
    if (!job) throw new PrintError('JOB_NOT_FOUND', 'Job not found');
    if (job.state !== 'QUEUED' && job.state !== 'WAITING_PERMISSION') {
      throw new PrintError('INVALID_REQUEST', `Job in state ${job.state} cannot be cancelled`);
    }
    const next = await this.save(transition(job, 'CANCELLED', { outcome: 'CANCELLED_BY_REQUEST' }, this.now()));
    await this.deps.store.deletePayload(jobId);
    return next;
  }

  /** Called once per service-worker start. Never re-sends a job that may have printed. */
  async recover(): Promise<void> {
    for (const job of await this.deps.store.listActive()) {
      if (job.state === 'DISPATCHING' && job.adapter && this.deps.isRunnerAlive && (await this.deps.isRunnerAlive(job.jobId))) {
        continue; // the print window is still open and will report back
      }
      const { job: next, resume } = recoverAfterRestart(job, this.now());
      if (next !== job) {
        await this.save(next);
        if (isTerminal(next.state)) await this.deps.store.deletePayload(next.jobId);
      }
      if (resume) this.schedule(next);
    }
  }

  /**
   * Result reported by a print window after the service worker may have restarted and lost
   * the in-memory promise. Applied only when the job is still DISPATCHING.
   */
  async applyDetachedResult(jobId: string, result: PrintResult): Promise<void> {
    const job = await this.deps.store.get(jobId);
    if (!job || job.state !== 'DISPATCHING') return;
    await this.finish(job, result, false);
  }

  private async awaitConfirmation(job: PrintJobRecord, profile: PrinterProfile) {
    let ok = false;
    try {
      ok = await this.deps.confirm!({
        jobId: job.jobId,
        origin: job.origin,
        documentType: job.documentType,
        format: job.format,
        sizeBytes: job.sizeBytes,
        printerName: profile.name,
      });
    } catch {
      ok = false;
    }
    const current = await this.deps.store.get(job.jobId);
    if (!current || current.state !== 'WAITING_PERMISSION') return;
    if (!ok) {
      await this.save(transition(current, 'CANCELLED', { outcome: 'USER_DENIED', errorCode: 'PERMISSION_DENIED' }, this.now()));
      await this.deps.store.deletePayload(job.jobId);
      return;
    }
    this.schedule(await this.save(transition(current, 'QUEUED', {}, this.now())));
  }

  /** One lane per printer profile so two jobs never interleave bytes on one device. */
  private schedule(job: PrintJobRecord, delayMs = 0): void {
    const lane = job.profileId ?? 'default';
    const prev = this.lanes.get(lane) ?? Promise.resolve();
    const next = prev
      .then(() => (delayMs ? new Promise((r) => setTimeout(r, delayMs)) : undefined))
      .then(() => this.dispatch(job.jobId))
      .catch(() => undefined);
    this.lanes.set(lane, next);
  }

  /** Resolves when every lane is idle (used by tests). */
  async idle(): Promise<void> {
    for (;;) {
      const all = [...this.lanes.values()];
      await Promise.all(all);
      if ([...this.lanes.values()].every((p) => all.includes(p))) return;
    }
  }

  private async dispatch(jobId: string): Promise<void> {
    let job = await this.deps.store.get(jobId);
    if (!job || job.state !== 'QUEUED') return;
    const config = await this.deps.getConfig();
    const profile = config.profiles.find((p) => p.id === job!.profileId);
    const payload = await this.deps.store.getPayload(jobId);
    if (!profile || !payload) {
      await this.save(
        transition(job, 'FAILED', {
          errorCode: profile ? 'INTERNAL_ERROR' : 'PROFILE_NOT_FOUND',
          errorMessage: profile ? 'Payload missing' : 'Printer profile was removed',
          outcome: 'NOT_DISPATCHED',
        }, this.now()),
      );
      await this.deps.store.deletePayload(jobId);
      return;
    }
    const adapter = this.deps.adapters[profile.adapter];
    const mapping = config.mappings[job.documentType];
    const useMapping = mapping?.printerId === profile.id ? mapping : undefined;
    // Persist DISPATCHING before touching the device: after a crash this marks "maybe printed".
    job = await this.save(transition(job, 'DISPATCHING', { attempts: job.attempts + 1, adapter: profile.adapter }, this.now()));

    let result: PrintResult;
    try {
      result = await withTimeout(
        adapter.print({
          jobId,
          format: job.format,
          payload,
          profile,
          copies: job.copies ?? useMapping?.copies ?? profile.copies,
          paperSize: useMapping?.paperSize ?? profile.paperSize,
          orientation: useMapping?.orientation ?? profile.orientation,
        }),
        { ...DEFAULT_TIMEOUTS, ...this.deps.dispatchTimeoutMs }[profile.adapter],
        'dispatch',
      );
    } catch (e) {
      // The adapter may still be writing: we cannot say whether anything printed.
      result = { state: 'UNKNOWN', outcome: e instanceof Error && e.name === 'TimeoutError' ? 'DISPATCH_TIMEOUT' : 'ADAPTER_THREW' };
    }
    const latest = await this.deps.store.get(jobId);
    if (!latest || latest.state !== 'DISPATCHING') return; // finalized by a detached result
    await this.finish(latest, result, true);
  }

  private async finish(job: PrintJobRecord, result: PrintResult, allowRetry: boolean): Promise<void> {
    const max = this.deps.maxAttempts ?? 3;
    if (result.state === 'FAILED' && result.retryable && allowRetry && job.attempts < max) {
      const next = await this.save(
        transition(job, 'QUEUED', { outcome: `RETRY_AFTER_${result.outcome}`, errorCode: result.error.code, errorMessage: result.error.message }, this.now()),
      );
      const delays = this.deps.retryDelaysMs ?? [1000, 3000, 8000];
      this.schedule(next, delays[Math.min(job.attempts - 1, delays.length - 1)] ?? 1000);
      return;
    }
    const patch: Partial<PrintJobRecord> =
      result.state === 'FAILED'
        ? { outcome: result.outcome, errorCode: result.error.code, errorMessage: result.error.message }
        : { outcome: result.outcome, errorCode: undefined, errorMessage: undefined };
    await this.save(transition(job, result.state, patch, this.now()));
    await this.deps.store.deletePayload(job.jobId);
    const { settings } = await this.deps.getConfig();
    await this.deps.store.prune(settings.historyLimit);
  }

  private async save(job: PrintJobRecord): Promise<PrintJobRecord> {
    await this.deps.store.put(job);
    this.deps.emit(job);
    return job;
  }
}

function decodePayload(jobId: string, params: PrintParams): StoredPayload {
  if (params.dataEncoding === 'base64') return { jobId, kind: 'bytes', bytes: base64ToBytes(params.data) };
  return { jobId, kind: 'text', text: params.data };
}
