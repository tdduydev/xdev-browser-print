import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrintConfig, PrintJobRecord } from '@xdev/shared-types';
import { JobManager, type JobManagerDeps } from '../src/printing/job-manager';
import { MemoryJobStore } from '../src/storage/job-store';
import { configWith, escposParams, fakeAdapters, pdfParams } from './helpers';

const ORIGIN = 'https://his.example.vn';

function setup(over: Partial<JobManagerDeps> = {}, config: PrintConfig = configWith()) {
  const store = new MemoryJobStore();
  const adapters = fakeAdapters();
  const events: PrintJobRecord[] = [];
  const jm = new JobManager({
    store,
    getConfig: async () => config,
    adapters,
    emit: (j) => events.push(j),
    retryDelaysMs: [0, 0, 0],
    ...over,
  });
  return { jm, store, adapters, events, config };
}

describe('JobManager.submit', () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => {
    ctx = setup();
  });

  it('routes by mapping, dispatches and ends SUBMITTED for a RAW device', async () => {
    const r = await ctx.jm.submit(ORIGIN, escposParams());
    expect(r).toMatchObject({ state: 'QUEUED', duplicate: false });
    await ctx.jm.idle();
    const job = await ctx.store.get(r.jobId);
    expect(job).toMatchObject({ state: 'SUBMITTED', profileId: 'printer-k80', adapter: 'webusb', copies: 2, attempts: 1 });
    expect(job!.history.map((h) => h.state)).toEqual(['CREATED', 'VALIDATING', 'QUEUED', 'DISPATCHING', 'SUBMITTED']);
    expect(ctx.adapters.webusb.calls[0]).toMatchObject({ copies: 2, paperSize: 'K80' });
    // Payload is deleted once the job is final: no document content is kept.
    expect(await ctx.store.getPayload(r.jobId)).toBeUndefined();
  });

  it('keeps a browser job UNKNOWN when only the dialog closed', async () => {
    ctx.adapters.browser.results.push({ state: 'UNKNOWN', outcome: 'PRINT_DIALOG_CLOSED' });
    const r = await ctx.jm.submit(ORIGIN, pdfParams());
    await ctx.jm.idle();
    expect(await ctx.store.get(r.jobId)).toMatchObject({ state: 'UNKNOWN', outcome: 'PRINT_DIALOG_CLOSED' });
  });

  it('returns the existing job for a repeated idempotency key without printing twice', async () => {
    const p = escposParams();
    const a = await ctx.jm.submit(ORIGIN, p);
    await ctx.jm.idle();
    const b = await ctx.jm.submit(ORIGIN, { ...p });
    expect(b).toEqual({ jobId: a.jobId, state: 'SUBMITTED', duplicate: true });
    expect(ctx.adapters.webusb.calls).toHaveLength(1);
  });

  it('scopes idempotency keys per origin', async () => {
    const p = escposParams();
    const a = await ctx.jm.submit(ORIGIN, p);
    const b = await ctx.jm.submit('https://other.example.vn', p);
    expect(b.jobId).not.toBe(a.jobId);
  });

  it('rejects a concurrent duplicate while the first is being created', async () => {
    const p = escposParams();
    const results = await Promise.allSettled([ctx.jm.submit(ORIGIN, p), ctx.jm.submit(ORIGIN, p)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((r) => r.status === 'rejected')).toMatchObject({ reason: { code: 'REPLAY_DETECTED' } });
  });

  it('rate-limits per origin', async () => {
    const c = configWith((cfg) => {
      cfg.settings.rateLimitJobs = 2;
    });
    ctx = setup({}, c);
    await ctx.jm.submit(ORIGIN, escposParams());
    await ctx.jm.submit(ORIGIN, escposParams());
    await expect(ctx.jm.submit(ORIGIN, escposParams())).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    await expect(ctx.jm.submit('https://b.example.vn', escposParams())).resolves.toBeTruthy();
  });

  it('records routing failures as FAILED history entries and throws', async () => {
    await expect(ctx.jm.submit(ORIGIN, pdfParams({ documentType: 'UNMAPPED' }))).rejects.toMatchObject({ code: 'MAPPING_NOT_FOUND' });
    const [job] = await ctx.store.list(10);
    expect(job).toMatchObject({ state: 'FAILED', outcome: 'VALIDATION_FAILED', errorCode: 'MAPPING_NOT_FOUND' });
  });

  it('rejects non-PDF bytes labelled as PDF', async () => {
    await expect(ctx.jm.submit(ORIGIN, pdfParams({ data: btoa('hello world!') }))).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
  });

  it('rejects oversized payloads before creating a job', async () => {
    ctx = setup({}, configWith((c) => (c.settings.maxJobBytes = 10)));
    await expect(ctx.jm.submit(ORIGIN, pdfParams())).rejects.toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
    expect(await ctx.store.list(10)).toHaveLength(0);
  });

  it('emits every state change', async () => {
    const r = await ctx.jm.submit(ORIGIN, escposParams());
    await ctx.jm.idle();
    expect(ctx.events.filter((e) => e.jobId === r.jobId).map((e) => e.state)).toEqual(['CREATED', 'VALIDATING', 'QUEUED', 'DISPATCHING', 'SUBMITTED']);
  });
});

describe('JobManager retries', () => {
  it('retries a retryable failure where nothing was written, then succeeds', async () => {
    const ctx = setup();
    ctx.adapters.webusb.results.push({ state: 'FAILED', outcome: 'DEVICE_NOT_FOUND', error: { code: 'DEVICE_NOT_FOUND', message: 'x' }, retryable: true });
    const r = await ctx.jm.submit(ORIGIN, escposParams());
    await ctx.jm.idle();
    expect(await ctx.store.get(r.jobId)).toMatchObject({ state: 'SUBMITTED', attempts: 2 });
  });

  it('stops after maxAttempts', async () => {
    const ctx = setup({ maxAttempts: 2 });
    const fail = { state: 'FAILED' as const, outcome: 'DEVICE_BUSY', error: { code: 'DEVICE_BUSY' as const, message: 'busy' }, retryable: true };
    ctx.adapters.webusb.results.push(fail, fail, fail);
    const r = await ctx.jm.submit(ORIGIN, escposParams());
    await ctx.jm.idle();
    expect(await ctx.store.get(r.jobId)).toMatchObject({ state: 'FAILED', attempts: 2, errorCode: 'DEVICE_BUSY' });
    expect(ctx.adapters.webusb.calls).toHaveLength(2);
  });

  it('never retries a partial transfer', async () => {
    const ctx = setup();
    ctx.adapters.webusb.results.push({ state: 'FAILED', outcome: 'PARTIAL_TRANSFER', error: { code: 'TRANSFER_FAILED', message: 'x' }, retryable: false, bytesWritten: 10 });
    const r = await ctx.jm.submit(ORIGIN, escposParams());
    await ctx.jm.idle();
    expect(await ctx.store.get(r.jobId)).toMatchObject({ state: 'FAILED', outcome: 'PARTIAL_TRANSFER', attempts: 1 });
  });

  it('marks UNKNOWN (not FAILED, not retried) when the adapter throws or times out', async () => {
    const ctx = setup({ dispatchTimeoutMs: { webusb: 20 } });
    ctx.adapters.webusb.results.push(() => new Promise(() => undefined));
    const r = await ctx.jm.submit(ORIGIN, escposParams());
    await ctx.jm.idle();
    expect(await ctx.store.get(r.jobId)).toMatchObject({ state: 'UNKNOWN', outcome: 'DISPATCH_TIMEOUT' });
    expect(ctx.adapters.webusb.calls).toHaveLength(1);
  });
});

describe('JobManager serialization', () => {
  it('never runs two jobs on the same printer at once', async () => {
    const ctx = setup();
    let running = 0;
    let maxRunning = 0;
    const slow = async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      return { state: 'SUBMITTED' as const, outcome: 'OK' };
    };
    ctx.adapters.webusb.results.push(slow, slow, slow);
    await Promise.all([1, 2, 3].map(() => ctx.jm.submit(ORIGIN, escposParams())));
    await ctx.jm.idle();
    expect(maxRunning).toBe(1);
    expect(ctx.adapters.webusb.calls).toHaveLength(3);
  });
});

describe('JobManager confirmation and cancel', () => {
  it('waits for user approval and cancels on deny', async () => {
    const confirm = vi.fn().mockResolvedValue(false);
    const ctx = setup({ confirm });
    const r = await ctx.jm.submit(ORIGIN, escposParams(), { requireConfirmation: true });
    expect(r.state).toBe('WAITING_PERMISSION');
    await vi.waitFor(async () => expect((await ctx.store.get(r.jobId))?.state).toBe('CANCELLED'));
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ origin: ORIGIN, documentType: 'INVOICE', printerName: 'Máy in hoá đơn' }));
    expect(ctx.adapters.webusb.calls).toHaveLength(0);
  });

  it('prints after approval', async () => {
    const ctx = setup({ confirm: async () => true });
    const r = await ctx.jm.submit(ORIGIN, escposParams(), { requireConfirmation: true });
    await vi.waitFor(async () => expect((await ctx.store.get(r.jobId))?.state).toBe('SUBMITTED'));
  });

  it('cancels only jobs that have not been dispatched', async () => {
    let release!: () => void;
    const ctx = setup({ confirm: () => new Promise<boolean>((r) => (release = () => r(true))) });
    const r = await ctx.jm.submit(ORIGIN, escposParams(), { requireConfirmation: true });
    expect((await ctx.jm.cancel(r.jobId)).state).toBe('CANCELLED');
    release();
    await ctx.jm.idle();
    expect(ctx.adapters.webusb.calls).toHaveLength(0);
    await expect(ctx.jm.cancel(r.jobId)).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    await expect(ctx.jm.cancel('nope')).rejects.toMatchObject({ code: 'JOB_NOT_FOUND' });
  });
});

describe('JobManager recovery after service-worker restart', () => {
  it('resumes QUEUED jobs and turns DISPATCHING into UNKNOWN without re-sending', async () => {
    const first = setup();
    first.adapters.webusb.results.push(() => new Promise(() => undefined)); // worker "dies" mid-dispatch
    const inFlight = await first.jm.submit(ORIGIN, escposParams());
    await vi.waitFor(async () => expect((await first.store.get(inFlight.jobId))?.state).toBe('DISPATCHING'));
    // A second job waiting behind it on the same printer.
    const queued = await first.jm.submit(ORIGIN, escposParams());

    const second = setup({ store: first.store });
    await second.jm.recover();
    await second.jm.idle();
    expect(await first.store.get(inFlight.jobId)).toMatchObject({ state: 'UNKNOWN', outcome: 'INTERRUPTED_DURING_DISPATCH' });
    expect(await first.store.get(queued.jobId)).toMatchObject({ state: 'SUBMITTED' });
    expect(second.adapters.webusb.calls.map((c) => c.jobId)).toEqual([queued.jobId]);
  });

  it('leaves a browser job alone while its print window is still open, then applies its result', async () => {
    const first = setup();
    first.adapters.browser.results.push(() => new Promise(() => undefined));
    const r = await first.jm.submit(ORIGIN, pdfParams());
    await vi.waitFor(async () => expect((await first.store.get(r.jobId))?.state).toBe('DISPATCHING'));

    const second = setup({ store: first.store, isRunnerAlive: async () => true });
    await second.jm.recover();
    expect((await first.store.get(r.jobId))?.state).toBe('DISPATCHING');
    await second.jm.applyDetachedResult(r.jobId, { state: 'UNKNOWN', outcome: 'PRINT_DIALOG_CLOSED' });
    expect(await first.store.get(r.jobId)).toMatchObject({ state: 'UNKNOWN', outcome: 'PRINT_DIALOG_CLOSED' });
    // A late duplicate report changes nothing.
    await second.jm.applyDetachedResult(r.jobId, { state: 'SUBMITTED', outcome: 'X' });
    expect((await first.store.get(r.jobId))?.outcome).toBe('PRINT_DIALOG_CLOSED');
  });

  it('prunes history to the configured limit', async () => {
    const ctx = setup({}, configWith((c) => (c.settings.historyLimit = 2)));
    for (let i = 0; i < 4; i++) await ctx.jm.submit(ORIGIN, escposParams());
    await ctx.jm.idle();
    expect(await ctx.store.list(100)).toHaveLength(2);
  });
});
