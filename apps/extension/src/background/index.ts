import type { BridgeRequest, PrintJobRecord } from '@xdev/shared-types';
import { BRIDGE_PORT_NAME } from '@xdev/shared-types';
import {
  PrintError,
  bytesToBase64,
  buildTextPdf,
  deleteMapping,
  deleteProfile,
  originOfUrl,
  parsePaperSize,
  randomId,
  saveMapping,
  testReceipt,
  testTspl,
  testZpl,
  toSerializedError,
  upsertProfile,
} from '@xdev/core';
import { BrowserPrintAdapter, RunnerRawAdapter } from '../adapters/browser-adapter';
import type { PrintAdapter } from '../adapters/types';
import { WebSerialPrintAdapter, type SerialLike } from '../adapters/webserial-adapter';
import { WebUsbPrintAdapter, type UsbLike } from '../adapters/webusb-adapter';
import type { Broadcast, InternalApi, InternalMessage, InternalType, TestKind } from '../lib/messages';
import { JobManager, toPublic } from '../printing/job-manager';
import { ConfigStore } from '../storage/config-store';
import { IdbJobStore } from '../storage/job-store';
import { PageApi } from './api';
import { ApprovalCenter } from './approvals';
import { computeCapabilities } from './capabilities';
import { RunnerHost } from './runner';
import { SiteManager } from './sites';

// ---- composition --------------------------------------------------------------------------
// Every listener below is registered synchronously at top level: MV3 only delivers the
// event that woke the service worker to listeners that exist after the first turn.

const configStore = new ConfigStore(chrome.storage.local);
const jobStore = new IdbJobStore();
const sites = new SiteManager(configStore);
const approvals = new ApprovalCenter();
const runner = new RunnerHost();

const nav = navigator as Navigator & { usb?: UsbLike; serial?: SerialLike };
const adapters: Record<'browser' | 'webusb' | 'webserial', PrintAdapter> = {
  browser: new BrowserPrintAdapter(runner),
  webusb: nav.usb ? new WebUsbPrintAdapter(() => nav.usb) : new RunnerRawAdapter('webusb', runner),
  webserial: nav.serial ? new WebSerialPrintAdapter(() => nav.serial) : new RunnerRawAdapter('webserial', runner),
};

const ports = new Set<{ port: chrome.runtime.Port; origin: string }>();

function broadcast(msg: Broadcast) {
  chrome.runtime.sendMessage(msg).catch(() => undefined); // no page open is fine
}

function emitJob(job: PrintJobRecord) {
  const event = { type: 'job' as const, job: toPublic(job) };
  for (const p of ports) {
    if (p.origin === job.origin) {
      try {
        p.port.postMessage({ kind: 'event', payload: event });
      } catch {
        ports.delete(p);
      }
    }
  }
  broadcast({ type: 'broadcast.jobs' });
}

const jobs = new JobManager({
  store: jobStore,
  getConfig: () => configStore.getConfig(),
  adapters,
  emit: emitJob,
  confirm: (req) => approvals.confirmJob(req),
  isRunnerAlive: (id) => runner.isAlive(id),
});

const pageApi = new PageApi({
  extensionId: chrome.runtime.id,
  extensionVersion: chrome.runtime.getManifest().version,
  configStore,
  jobs,
  capabilities: computeCapabilities,
  printerStatus: async (profileId) => {
    const config = await configStore.getConfig();
    const p = config.profiles.find((x) => x.id === profileId);
    if (!p) return { ready: false, reason: 'PROFILE_NOT_FOUND' };
    return adapters[p.adapter].getStatus(p);
  },
  requestPairing: async (origin, scopes, appName) => {
    const accepted = await approvals.requestPairing(origin, scopes, appName);
    if (accepted.length) {
      const existing = await sites.find(origin);
      if (existing) await sites.addScopes(origin, accepted);
      else await sites.add(origin, accepted);
    }
    return accepted;
  },
  queuedJobs: async () => (await jobStore.listActive()).length,
});

// ---- web page bridge (via content script port) ---------------------------------------------

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== BRIDGE_PORT_NAME) return keepAlivePort(port);
  const sender = port.sender;
  // Only our own content script, in a top-level frame of a real tab, may open the bridge.
  // The origin comes from Chrome, never from the message body.
  const origin = sender?.origin ?? originOfUrl(sender?.url);
  if (sender?.id !== chrome.runtime.id || !sender.tab || sender.frameId !== 0 || !origin || origin.startsWith('chrome-extension:')) {
    port.disconnect();
    return;
  }
  const entry = { port, origin };
  ports.add(entry);
  port.onDisconnect.addListener(() => ports.delete(entry));
  port.onMessage.addListener((msg: { kind?: string; payload?: BridgeRequest }) => {
    if (msg?.kind !== 'request' || !msg.payload) return;
    void pageApi.handle(origin, msg.payload).then((response) => {
      try {
        port.postMessage({ kind: 'response', payload: response });
      } catch {
        ports.delete(entry);
      }
    });
  });
});

/** Extension pages (print/approve windows) hold a port so the worker stays alive meanwhile. */
function keepAlivePort(port: chrome.runtime.Port) {
  if (port.name !== 'xdbp-keepalive' || !port.sender?.url?.startsWith(chrome.runtime.getURL(''))) {
    port.disconnect();
    return;
  }
  port.onMessage.addListener(() => undefined);
}

// ---- extension pages ----------------------------------------------------------------------

type Handlers = { [T in InternalType]: (msg: InternalMessage<T>) => Promise<InternalApi[T]['res']> };

async function testPayload(profileId: string, kind: TestKind) {
  const config = await configStore.getConfig();
  const p = config.profiles.find((x) => x.id === profileId);
  if (!p) throw new PrintError('PROFILE_NOT_FOUND', 'Profile not found');
  const paper = parsePaperSize(p.paperSize) ?? { widthMm: 80, heightMm: 120 };
  const label = `${p.name} · ${p.paperSize}`;
  switch (kind) {
    case 'pdf':
      return { format: 'PDF' as const, dataEncoding: 'base64' as const, data: bytesToBase64(buildTextPdf({ widthMm: paper.widthMm, heightMm: paper.heightMm ?? 200, lines: ['xDev Browser Print - Test page', label, new Date().toLocaleString()] })) };
    case 'html':
      return {
        format: 'HTML' as const,
        dataEncoding: 'text' as const,
        data: `<!doctype html><html><body style="font-family:sans-serif"><h1>xDev Browser Print</h1><p>Trang in thử / Test page</p><p>${label.replace(/</g, '&lt;')}</p><p>Tiếng Việt: Đơn thuốc – Hóa đơn – Phiếu khám</p></body></html>`,
      };
    case 'escpos':
      return { format: 'ESCPOS' as const, dataEncoding: 'base64' as const, data: bytesToBase64(testReceipt({ encoding: p.encoding, codePage: p.escposCodePage, widthChars: paper.widthMm <= 58 ? 32 : 48, autoCut: false, title: label })) };
    case 'zpl':
      return { format: 'ZPL' as const, dataEncoding: 'text' as const, data: testZpl({ widthMm: paper.widthMm, heightMm: paper.heightMm ?? 30, dpmm: p.barcodeDensity ?? 8, text: label }) };
    case 'tspl':
      return { format: 'TSPL' as const, dataEncoding: 'text' as const, data: testTspl({ widthMm: paper.widthMm, heightMm: paper.heightMm ?? 30, text: label }) };
  }
}

const handlers: Handlers = {
  'config.get': async () => ({ config: await configStore.getConfig(), sites: await sites.list() }),
  'profile.upsert': async ({ profile }) => {
    const c = await configStore.updateConfig((cfg) => upsertProfile(cfg, profile));
    broadcast({ type: 'broadcast.config' });
    return c;
  },
  'profile.delete': async ({ id }) => {
    const c = await configStore.updateConfig((cfg) => deleteProfile(cfg, id));
    broadcast({ type: 'broadcast.config' });
    return c;
  },
  'profile.status': async ({ id }) => {
    const p = (await configStore.getConfig()).profiles.find((x) => x.id === id);
    if (!p) throw new PrintError('PROFILE_NOT_FOUND', 'Profile not found');
    return adapters[p.adapter].getStatus(p);
  },
  'mapping.save': async ({ params }) => {
    const m = await configStore.updateConfigWith((cfg) => {
      const r = saveMapping(cfg, params);
      return { config: r.config, result: r.mapping };
    });
    broadcast({ type: 'broadcast.config' });
    return m;
  },
  'mapping.delete': async ({ documentType }) => {
    const c = await configStore.updateConfig((cfg) => deleteMapping(cfg, documentType));
    broadcast({ type: 'broadcast.config' });
    return c;
  },
  'settings.update': async ({ patch }) => {
    const c = await configStore.updateConfig((cfg) => ({ ...cfg, settings: sanitizeSettings({ ...cfg.settings, ...patch }) }));
    broadcast({ type: 'broadcast.config' });
    return c;
  },
  'sites.pending': async ({ origin, scopes, confirmEachJob }) => {
    await sites.setPending(origin, scopes, confirmEachJob);
    return null;
  },
  'sites.add': async ({ origin, scopes, confirmEachJob, label }) => {
    const g = await sites.add(origin, scopes, confirmEachJob, label);
    broadcast({ type: 'broadcast.config' });
    return g;
  },
  'sites.update': async ({ origin, scopes, confirmEachJob }) => {
    await sites.update(origin, { ...(scopes && { scopes }), ...(confirmEachJob !== undefined && { confirmEachJob }) });
    broadcast({ type: 'broadcast.config' });
    return null;
  },
  'sites.remove': async ({ origin }) => {
    await sites.remove(origin);
    for (const p of [...ports]) if (p.origin === origin) p.port.disconnect();
    broadcast({ type: 'broadcast.config' });
    return null;
  },
  'jobs.list': ({ limit }) => jobStore.list(Math.min(Math.max(1, limit), 1000)),
  'jobs.clear': async () => {
    await jobStore.clear();
    broadcast({ type: 'broadcast.jobs' });
    return null;
  },
  'jobs.cancel': ({ jobId }) => jobs.cancel(jobId),
  'test.print': async ({ profileId, kind }) => {
    const payload = await testPayload(profileId, kind);
    const documentType = `TEST_${kind.toUpperCase()}`;
    return jobs.submit(chrome.runtime.getURL('').replace(/\/$/, ''), { ...payload, documentType, printerId: profileId, idempotencyKey: randomId('test') });
  },
  'status.get': async () => {
    const config = await configStore.getConfig();
    return {
      version: chrome.runtime.getManifest().version,
      platform: (await chrome.runtime.getPlatformInfo()).os,
      sites: (await sites.list()).length,
      profiles: config.profiles.length,
      mappings: Object.keys(config.mappings).length,
      activeJobs: (await jobStore.listActive()).length,
      capabilities: await computeCapabilities(),
    };
  },
  'approval.get': async ({ id }) => approvals.get(id) ?? null,
  'approval.respond': async ({ id, answer }) => approvals.respond(id, answer),
  'runner.request': async ({ jobId }) => {
    const job = await jobStore.get(jobId);
    if (!job || job.state !== 'DISPATCHING') throw new PrintError('JOB_NOT_FOUND', 'Job is not being dispatched');
    const config = await configStore.getConfig();
    const profile = config.profiles.find((p) => p.id === job.profileId);
    if (!profile) throw new PrintError('PROFILE_NOT_FOUND', 'Profile not found');
    const m = config.mappings[job.documentType];
    const mapping = m?.printerId === profile.id ? m : undefined;
    return {
      jobId,
      format: job.format,
      adapter: profile.adapter,
      profile,
      copies: job.copies ?? profile.copies,
      paperSize: mapping?.paperSize ?? profile.paperSize,
      orientation: mapping?.orientation ?? profile.orientation,
      documentType: job.documentType,
    };
  },
  'runner.progress': async ({ jobId, stage }) => {
    runner.progress(jobId, stage);
    return null;
  },
  'runner.result': async ({ jobId, result }) => {
    if (!runner.finish(jobId, result)) await jobs.applyDetachedResult(jobId, result);
    return null;
  },
};

function sanitizeSettings(s: InternalApi['settings.update']['res']['settings']) {
  const clamp = (n: number, lo: number, hi: number, d: number) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : d);
  return {
    language: s.language === 'en' ? ('en' as const) : ('vi' as const),
    maxJobBytes: clamp(s.maxJobBytes, 64 * 1024, 50 * 1024 * 1024, 15 * 1024 * 1024),
    rateLimitJobs: clamp(s.rateLimitJobs, 1, 1000, 20),
    rateLimitWindowMs: clamp(s.rateLimitWindowMs, 1000, 3_600_000, 60_000),
    historyLimit: clamp(s.historyLimit, 10, 5000, 500),
    allowSiteConfigure: !!s.allowSiteConfigure,
    allowLocalhost: !!s.allowLocalhost,
  };
}

chrome.runtime.onMessage.addListener((msg: InternalMessage, sender, sendResponse) => {
  // Content scripts share our extension id, so the sender URL must be an extension page.
  if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL(''))) return false;
  if (!msg || typeof msg.type !== 'string' || !(msg.type in handlers)) return false;
  const handler = handlers[msg.type] as (m: InternalMessage) => Promise<unknown>;
  handler(msg)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((e: unknown) => sendResponse({ ok: false, error: toSerializedError(e) }));
  return true;
});

// ---- lifecycle ----------------------------------------------------------------------------

chrome.windows.onRemoved.addListener((windowId) => {
  runner.onWindowRemoved(windowId);
  approvals.onWindowRemoved(windowId);
});

chrome.permissions.onAdded.addListener((p) => {
  if (p.origins?.length) void sites.completePendingFor(p.origins).then(() => broadcast({ type: 'broadcast.config' }));
});

chrome.permissions.onRemoved.addListener((p) => {
  if (!p.origins?.length) return;
  void sites.onPermissionsRemoved(p.origins).then((gone) => {
    for (const e of [...ports]) if (gone.includes(e.origin)) e.port.disconnect();
    broadcast({ type: 'broadcast.config' });
  });
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') void chrome.runtime.openOptionsPage();
});

// Runs on every worker start (install, browser start, wake-up after suspension).
void (async () => {
  await sites.reconcile().catch(() => undefined);
  await jobs.recover().catch(() => undefined);
})();
