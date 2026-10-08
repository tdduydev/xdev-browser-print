import { afterEach, describe, expect, it } from 'vitest';
import { BRIDGE_CHANNEL } from '@xdev/shared-types';
import { BrowserPrintTimeoutError, NotInstalledError, PermissionError, PrintJobError, SDK_VERSION, UnsupportedCapabilityError, XDevBrowserPrint } from '../src';
import { FakeBridge, FakeWindow, NO_REPLY, ORIGIN, job } from './fake-bridge';

const clients: XDevBrowserPrint[] = [];
function client(win: FakeWindow, opts: ConstructorParameters<typeof XDevBrowserPrint>[0] = {}) {
  const c = new XDevBrowserPrint({ target: win as unknown as Window, detectTimeoutMs: 50, timeoutMs: 200, ...opts });
  clients.push(c);
  return c;
}
afterEach(() => clients.splice(0).forEach((c) => c.dispose()));

const connected = (b: FakeBridge) =>
  b.on('connect', (r) => ({ extensionId: 'ext-1', extensionVersion: '0.1.0', protocolVersion: 1, origin: ORIGIN, scopes: (r.params as { scopes: string[] }).scopes }));

describe('detection and connect', () => {
  it('reports not installed when no bridge answers', async () => {
    const c = client(new FakeWindow());
    expect(await c.isInstalled()).toBe(false);
    await expect(c.connect()).rejects.toBeInstanceOf(NotInstalledError);
  });

  it('connects and remembers granted scopes', async () => {
    const win = new FakeWindow();
    const bridge = connected(new FakeBridge(win));
    const c = client(win, { scopes: ['read', 'print', 'configure'], appName: 'HIS' });
    const s = await c.connect();
    expect(s.scopes).toEqual(['read', 'print', 'configure']);
    expect(c.connected).toBe(true);
    expect(bridge.requests[0]).toMatchObject({ method: 'connect', params: { appName: 'HIS', sdkVersion: SDK_VERSION } });
  });

  it('ignores a different extension when pinned by extensionId', async () => {
    const win = new FakeWindow();
    connected(new FakeBridge(win, 'other-ext'));
    expect(await client(win, { extensionId: 'ext-1' }).isInstalled()).toBe(false);
  });

  it('ignores messages from other origins or other windows', async () => {
    const win = new FakeWindow();
    const c = client(win);
    const ready = { channel: BRIDGE_CHANNEL, dir: 'from-ext', kind: 'ready', extensionId: 'x', protocolVersion: 1 };
    const p = c.isInstalled();
    win.inject(ready, { origin: 'https://evil.example' });
    win.inject(ready, { source: {} });
    expect(await p).toBe(false);
  });

  it('maps pairing rejection to PermissionError', async () => {
    const win = new FakeWindow();
    new FakeBridge(win).on('connect', () => {
      throw { code: 'PAIRING_REJECTED', message: 'no' };
    });
    await expect(client(win).connect()).rejects.toMatchObject({ name: 'PermissionError', code: 'PAIRING_REJECTED' });
  });
});

describe('requests', () => {
  it('times out with BrowserPrintTimeoutError', async () => {
    const win = new FakeWindow();
    new FakeBridge(win).on('getStatus', () => NO_REPLY);
    await expect(client(win, { timeoutMs: 30 }).getStatus()).rejects.toBeInstanceOf(BrowserPrintTimeoutError);
  });

  it('sends a unique requestId and a fresh timestamp each time', async () => {
    const win = new FakeWindow();
    const b = new FakeBridge(win).on('getMappings', () => []);
    const c = client(win);
    await c.getMappings();
    await c.getMappings();
    expect(b.requests[0]!.requestId).not.toBe(b.requests[1]!.requestId);
    expect(Math.abs(b.requests[0]!.sentAt - Date.now())).toBeLessThan(5000);
  });

  it('maps UNSUPPORTED errors to UnsupportedCapabilityError', async () => {
    const win = new FakeWindow();
    new FakeBridge(win).on('print', () => {
      throw { code: 'UNSUPPORTED_FORMAT', message: 'nope' };
    });
    await expect(client(win).print({ documentType: 'X', format: 'HTML', data: '<p>' })).rejects.toBeInstanceOf(UnsupportedCapabilityError);
  });

  it('passes mapping calls through', async () => {
    const win = new FakeWindow();
    const b = new FakeBridge(win)
      .on('saveMapping', (r) => ({ ...(r.params as object), updatedAt: 1 }))
      .on('deleteMapping', () => ({ ok: true }));
    const c = client(win);
    expect(await c.saveMapping({ documentType: 'PRESCRIPTION', printerId: 'printer-a5', paperSize: 'A5', copies: 1 })).toMatchObject({ printerId: 'printer-a5' });
    await c.deleteMapping('PRESCRIPTION');
    expect(b.requests.map((r) => r.method)).toEqual(['saveMapping', 'deleteMapping']);
  });
});

describe('print', () => {
  it('encodes binary data as base64 and waits until the job settles via events', async () => {
    const win = new FakeWindow();
    const b = new FakeBridge(win);
    b.on('print', () => {
      setTimeout(() => b.event({ type: 'job', job: job({ state: 'DISPATCHING' }) }), 5);
      setTimeout(() => b.event({ type: 'job', job: job({ state: 'UNKNOWN', outcome: 'PRINT_DIALOG_CLOSED' }) }), 10);
      return { jobId: 'job_1', state: 'QUEUED', duplicate: false };
    }).on('getJobStatus', () => job({ state: 'QUEUED' }));
    const c = client(win);
    const result = await c.printPdf('PRESCRIPTION', new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])]));
    expect(result).toMatchObject({ state: 'UNKNOWN', outcome: 'PRINT_DIALOG_CLOSED' });
    const sent = b.requests.find((r) => r.method === 'print')!.params as { data: string; dataEncoding: string; idempotencyKey: string };
    expect(sent).toMatchObject({ data: 'JVBERg==', dataEncoding: 'base64' });
    expect(sent.idempotencyKey).toMatch(/^idem_/);
  });

  it('falls back to polling when events are lost (worker restart)', async () => {
    const win = new FakeWindow();
    let polls = 0;
    new FakeBridge(win)
      .on('print', () => ({ jobId: 'job_1', state: 'QUEUED', duplicate: false }))
      .on('getJobStatus', () => (++polls >= 2 ? job({ state: 'SUBMITTED', format: 'ESCPOS' }) : job()));
    const r = await client(win).printRaw('INVOICE', 'ESCPOS', new Uint8Array([1, 2]));
    expect(r.state).toBe('SUBMITTED');
  }, 10_000);

  it('rejects with PrintJobError when the job fails', async () => {
    const win = new FakeWindow();
    new FakeBridge(win)
      .on('print', () => ({ jobId: 'job_1', state: 'QUEUED', duplicate: false }))
      .on('getJobStatus', () => job({ state: 'FAILED', errorCode: 'DEVICE_NOT_FOUND', errorMessage: 'unplugged' }));
    const err = await client(win).print({ documentType: 'INVOICE', format: 'ZPL', data: '^XA^XZ' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PrintJobError);
    expect(err).toMatchObject({ code: 'DEVICE_NOT_FOUND', job: { state: 'FAILED' } });
  });

  it("sends text formats as text and reuses a caller's idempotency key", async () => {
    const win = new FakeWindow();
    const b = new FakeBridge(win)
      .on('print', () => ({ jobId: 'job_1', state: 'QUEUED', duplicate: true }))
      .on('getJobStatus', () => job());
    await client(win).print({ documentType: 'PATIENT_BARCODE', format: 'ZPL', data: '^XA^XZ', idempotencyKey: 'order-123:label', wait: 'accepted' });
    expect(b.requests[0]!.params).toMatchObject({ data: '^XA^XZ', dataEncoding: 'text', idempotencyKey: 'order-123:label' });
  });

  it('refuses non-raw formats in printRaw without calling the extension', async () => {
    const win = new FakeWindow();
    const b = new FakeBridge(win);
    await expect(client(win).printRaw('X', 'PDF' as never, 'x')).rejects.toMatchObject({ code: 'UNSUPPORTED_CAPABILITY' });
    expect(b.requests).toHaveLength(0);
  });

  it('notifies status listeners and supports unsubscribe', async () => {
    const win = new FakeWindow();
    const b = new FakeBridge(win);
    const c = client(win);
    const seen: string[] = [];
    const off = c.onStatusChanged((e) => seen.push(e.type === 'job' ? e.job.state : e.reason));
    b.event({ type: 'status', status: { reason: 'PORT_DISCONNECTED' } });
    b.event({ type: 'job', job: job({ state: 'SUBMITTED' }) });
    await new Promise((r) => setTimeout(r, 20));
    off();
    b.event({ type: 'job', job: job({ state: 'FAILED' }) });
    await new Promise((r) => setTimeout(r, 20));
    expect(seen).toEqual(['PORT_DISCONNECTED', 'SUBMITTED']);
  });
});

describe('errors', () => {
  it('PermissionError is exported for instanceof checks', () => {
    expect(new PermissionError('PERMISSION_DENIED', 'x')).toBeInstanceOf(Error);
  });
});
