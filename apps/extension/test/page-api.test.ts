import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BridgeRequest, MethodName, Scope, SiteGrant } from '@xdev/shared-types';
import { randomId } from '@xdev/core';
import { PageApi, type ApiDeps } from '../src/background/api';
import { JobManager } from '../src/printing/job-manager';
import { ConfigStore } from '../src/storage/config-store';
import { MemoryJobStore } from '../src/storage/job-store';
import { MemoryArea, escposParams, fakeAdapters, sampleConfig } from './helpers';

const SITE = 'https://his.example.vn';

function req<M extends MethodName>(method: M, params: unknown = {}, over: Partial<BridgeRequest> = {}): BridgeRequest {
  return { requestId: randomId('req'), sentAt: Date.now(), method, params: params as never, ...over };
}

function setup(sites: SiteGrant[] = [{ origin: SITE, scopes: ['read', 'print'], grantedAt: 1 }]) {
  const area = new MemoryArea();
  area.data = { config: sampleConfig(), sites };
  const configStore = new ConfigStore(area);
  const jobs = new JobManager({ store: new MemoryJobStore(), getConfig: () => configStore.getConfig(), adapters: fakeAdapters(), emit: () => undefined });
  const requestPairing = vi.fn<ApiDeps['requestPairing']>(async (_o, scopes) => scopes);
  const api = new PageApi({
    extensionId: 'ext-id',
    extensionVersion: '0.1.0',
    configStore,
    jobs,
    capabilities: async () => ({ extensionVersion: '0.1.0', protocolVersion: 1, platform: 'win', adapters: [], chromePrintingApi: false, osPrinterEnumeration: false }),
    printerStatus: async () => ({ ready: true }),
    requestPairing,
    queuedJobs: async () => 0,
  });
  return { api, area, configStore, jobs, requestPairing };
}

describe('PageApi authorization', () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => {
    ctx = setup();
  });

  it('serves read methods to a paired origin', async () => {
    const r = await ctx.api.handle(SITE, req('getPrinters'));
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.result as { id: string }[]).map((p) => p.id)).toEqual(['printer-a5', 'printer-k80', 'printer-barcode']);
  });

  it('does not leak device identifiers in getPrinters', async () => {
    const r = await ctx.api.handle(SITE, req('getPrinters'));
    expect(JSON.stringify(r)).not.toMatch(/vendorId|serialNumber|baudRate/);
  });

  it('rejects unknown origins, including look-alikes and other ports', async () => {
    for (const origin of ['https://evil.example', 'https://his.example.vn.evil.com', 'https://his.example.vn:8443', 'http://his.example.vn']) {
      const r = await ctx.api.handle(origin, req('print', escposParams()));
      expect(r).toMatchObject({ ok: false, error: { code: 'ORIGIN_NOT_ALLOWED' } });
    }
  });

  it('enforces scopes per method', async () => {
    const r = await ctx.api.handle(SITE, req('saveMapping', { documentType: 'INVOICE', printerId: 'printer-a5' }));
    expect(r).toMatchObject({ ok: false, error: { code: 'PERMISSION_DENIED', details: { scope: 'configure' } } });
    const readOnly = setup([{ origin: SITE, scopes: ['read'], grantedAt: 1 }]);
    expect(await readOnly.api.handle(SITE, req('print', escposParams()))).toMatchObject({ ok: false, error: { code: 'PERMISSION_DENIED' } });
  });

  it('lets configure-scoped sites change mappings unless disabled in settings', async () => {
    const c = setup([{ origin: SITE, scopes: ['read', 'configure'], grantedAt: 1 }]);
    expect(await c.api.handle(SITE, req('saveMapping', { documentType: 'REPORT', printerId: 'printer-a5' }))).toMatchObject({ ok: true });
    await c.configStore.updateConfig((cfg) => ({ ...cfg, settings: { ...cfg.settings, allowSiteConfigure: false } }));
    expect(await c.api.handle(SITE, req('deleteMapping', { documentType: 'REPORT' }))).toMatchObject({ ok: false, error: { code: 'PERMISSION_DENIED' } });
  });

  it('rejects replayed and stale requests', async () => {
    const r1 = req('getStatus');
    expect((await ctx.api.handle(SITE, r1)).ok).toBe(true);
    expect(await ctx.api.handle(SITE, r1)).toMatchObject({ ok: false, error: { code: 'REPLAY_DETECTED' } });
    expect(await ctx.api.handle(SITE, req('getStatus', {}, { sentAt: Date.now() - 5 * 60_000 }))).toMatchObject({ ok: false, error: { code: 'REPLAY_DETECTED' } });
  });

  it('rejects malformed requests without throwing', async () => {
    expect(await ctx.api.handle(SITE, null as never)).toMatchObject({ ok: false, error: { code: 'INVALID_REQUEST' } });
    expect(await ctx.api.handle(SITE, req('eval' as never))).toMatchObject({ ok: false, error: { code: 'INVALID_REQUEST' } });
  });

  it('only shows a site its own jobs', async () => {
    const two = setup([
      { origin: SITE, scopes: ['print'], grantedAt: 1 },
      { origin: 'https://b.example.vn', scopes: ['print'], grantedAt: 1 },
    ]);
    const r = await two.api.handle(SITE, req('print', escposParams()));
    if (!r.ok) throw new Error('print failed');
    const jobId = (r.result as { jobId: string }).jobId;
    expect(await two.api.handle('https://b.example.vn', req('getJobStatus', { jobId }))).toMatchObject({ ok: false, error: { code: 'JOB_NOT_FOUND' } });
    expect(await two.api.handle('https://b.example.vn', req('cancelJob', { jobId }))).toMatchObject({ ok: false, error: { code: 'JOB_NOT_FOUND' } });
    expect(await two.api.handle(SITE, req('getJobStatus', { jobId }))).toMatchObject({ ok: true, result: { jobId } });
  });

  it('never returns internal error messages that could contain document data', async () => {
    const c = setup();
    vi.spyOn(c.configStore, 'getConfig').mockRejectedValueOnce(new Error('secret patient name'));
    const r = await c.api.handle(SITE, req('getMappings'));
    expect(JSON.stringify(r)).not.toContain('secret');
  });
});

describe('PageApi connect / pairing', () => {
  it('returns immediately when the grant already covers the scopes', async () => {
    const ctx = setup();
    const r = await ctx.api.handle(SITE, req('connect', { scopes: ['read', 'print'], sdkVersion: '0.1.0' }));
    expect(r).toMatchObject({ ok: true, result: { origin: SITE, scopes: ['read', 'print'], extensionId: 'ext-id' } });
    expect(ctx.requestPairing).not.toHaveBeenCalled();
  });

  it('asks the user for missing scopes only', async () => {
    const ctx = setup();
    const c = setup([{ origin: SITE, scopes: ['read'], grantedAt: 1 }]);
    await c.api.handle(SITE, req('connect', { scopes: ['read', 'print'], sdkVersion: '0.1.0', appName: 'HIS' }));
    expect(c.requestPairing).toHaveBeenCalledWith(SITE, ['print'], 'HIS');
    void ctx;
  });

  it('fails with PAIRING_REJECTED when an unknown origin is denied', async () => {
    const ctx = setup([]);
    ctx.requestPairing.mockResolvedValueOnce([] as Scope[]);
    expect(await ctx.api.handle(SITE, req('connect', { scopes: ['print'], sdkVersion: '0.1.0' }))).toMatchObject({ ok: false, error: { code: 'PAIRING_REJECTED' } });
  });

  it('drops the configure scope when sites may not configure', async () => {
    const ctx = setup();
    await ctx.configStore.updateConfig((cfg) => ({ ...cfg, settings: { ...cfg.settings, allowSiteConfigure: false } }));
    const r = await ctx.api.handle(SITE, req('connect', { scopes: ['read', 'print', 'configure'], sdkVersion: '0.1.0' }));
    expect(r).toMatchObject({ ok: true, result: { scopes: ['read', 'print'] } });
    expect(ctx.requestPairing).not.toHaveBeenCalled();
  });

  it('ignores invented scopes', async () => {
    const ctx = setup();
    const r = await ctx.api.handle(SITE, req('connect', { scopes: ['admin', 'read'], sdkVersion: '0.1.0' }));
    expect(r).toMatchObject({ ok: true });
    expect(ctx.requestPairing).not.toHaveBeenCalled();
  });
});

describe('ConfigStore', () => {
  it('serializes concurrent read-modify-write updates', async () => {
    const area = new MemoryArea();
    const store = new ConfigStore(area);
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        store.updateConfig((c) => ({ ...c, settings: { ...c.settings, historyLimit: c.settings.historyLimit + i + 1 } })),
      ),
    );
    expect((await store.getConfig()).settings.historyLimit).toBe(500 + 55);
  });

  it('keeps working after a failed update', async () => {
    const store = new ConfigStore(new MemoryArea());
    await expect(store.updateConfig(() => { throw new Error('boom'); })).rejects.toThrow('boom');
    await expect(store.updateSites((s) => [...s, { origin: SITE, scopes: ['read'], grantedAt: 1 }])).resolves.toHaveLength(1);
  });
});
