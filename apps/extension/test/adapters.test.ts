import { describe, expect, it } from 'vitest';
import type { PrinterProfile } from '@xdev/shared-types';
import { buildRawBytes } from '../src/adapters/raw-payload';
import { WebSerialPrintAdapter, matchSerialPort, type SerialPortLike } from '../src/adapters/webserial-adapter';
import { WebUsbPrintAdapter, findBulkOut, type UsbDeviceLike } from '../src/adapters/webusb-adapter';
import type { PrintRequest } from '../src/adapters/types';
import { k80, label } from '../../../packages/core/test/fixtures';

function usbDevice(over: Partial<UsbDeviceLike> & { chunkStatus?: ('ok' | 'stall' | Error)[] } = {}): UsbDeviceLike & { written: number[]; log: string[] } {
  const written: number[] = [];
  const log: string[] = [];
  const statuses = over.chunkStatus ?? [];
  const dev = {
    vendorId: 0x0416,
    productId: 0x5011,
    serialNumber: 'SN1',
    opened: false,
    configuration: {
      interfaces: [
        { interfaceNumber: 0, alternates: [{ alternateSetting: 0, interfaceClass: 0xff, endpoints: [{ endpointNumber: 3, direction: 'out' as const, type: 'bulk' as const }] }] },
        { interfaceNumber: 1, alternates: [{ alternateSetting: 0, interfaceClass: 7, endpoints: [{ endpointNumber: 2, direction: 'out' as const, type: 'bulk' as const }] }] },
      ],
    },
    async open() { log.push('open'); dev.opened = true; },
    async close() { log.push('close'); dev.opened = false; },
    async selectConfiguration() {},
    async claimInterface(n: number) { log.push(`claim:${n}`); },
    async releaseInterface(n: number) { log.push(`release:${n}`); },
    async transferOut(ep: number, data: Uint8Array) {
      const s = statuses.shift() ?? 'ok';
      if (s instanceof Error) throw s;
      log.push(`out:${ep}:${data.length}`);
      written.push(...data);
      return { bytesWritten: s === 'ok' ? data.length : 0, status: s };
    },
    written,
    log,
    ...over,
  };
  return dev as never;
}

function req(profile: PrinterProfile, bytes: Uint8Array, copies = 1): PrintRequest {
  return { jobId: 'job_1', format: 'ESCPOS', payload: { jobId: 'job_1', kind: 'bytes', bytes }, profile, copies, paperSize: profile.paperSize, orientation: 'portrait' };
}

const noCut = k80({ autoCut: false });

describe('buildRawBytes', () => {
  it('repeats the payload for copies and appends a cut only when missing', () => {
    expect(Array.from(buildRawBytes({ jobId: 'j', kind: 'bytes', bytes: Uint8Array.from([1, 2]) }, 'ESCPOS', noCut, 3))).toEqual([1, 2, 1, 2, 1, 2]);
    const withCut = buildRawBytes({ jobId: 'j', kind: 'bytes', bytes: Uint8Array.from([1]) }, 'ESCPOS', k80(), 1);
    expect(Array.from(withCut.subarray(-4))).toEqual([0x1d, 0x56, 65, 3]);
    const already = Uint8Array.from([1, 0x1d, 0x56, 65, 3]);
    expect(buildRawBytes({ jobId: 'j', kind: 'bytes', bytes: already }, 'ESCPOS', k80(), 1)).toEqual(already);
  });

  it('encodes text payloads with the profile encoding and never cuts ZPL', () => {
    const out = buildRawBytes({ jobId: 'j', kind: 'text', text: '^XA^FDĐơn^FS^XZ' }, 'ZPL', k80(), 1);
    expect(new TextDecoder().decode(out)).toBe('^XA^FDDon^FS^XZ');
  });

  it('selects the profile code page before ESC/POS text, but leaves raw bytes alone', () => {
    const vi = k80({ autoCut: false, encoding: 'cp1258', escposCodePage: 52 });
    expect(Array.from(buildRawBytes({ jobId: 'j', kind: 'text', text: 'ế' }, 'ESCPOS', vi, 1))).toEqual([0x1b, 0x74, 52, 0xea, 0xec]);
    // ESC @ resets the code page, so it is selected again right after.
    expect(Array.from(buildRawBytes({ jobId: 'j', kind: 'text', text: '\x1b@ế' }, 'ESCPOS', vi, 1))).toEqual([0x1b, 0x74, 52, 0x1b, 0x40, 0x1b, 0x74, 52, 0xea, 0xec]);
    expect(Array.from(buildRawBytes({ jobId: 'j', kind: 'bytes', bytes: Uint8Array.from([1]) }, 'ESCPOS', vi, 1))).toEqual([1]);
    expect(Array.from(buildRawBytes({ jobId: 'j', kind: 'text', text: 'a' }, 'TSPL', vi, 1))).toEqual([0x61]);
  });
});

describe('WebUsbPrintAdapter', () => {
  it('prefers the printer-class interface and writes in chunks, then releases and closes', async () => {
    const dev = usbDevice();
    expect(findBulkOut(dev)).toEqual({ iface: 1, alt: 0, endpoint: 2 });
    const bytes = new Uint8Array(40_000).fill(0x41);
    const r = await new WebUsbPrintAdapter(() => ({ getDevices: async () => [dev] })).print(req(noCut, bytes));
    expect(r).toEqual({ state: 'SUBMITTED', outcome: 'BYTES_WRITTEN_TO_DEVICE', bytesWritten: 40_000 });
    expect(dev.log).toEqual(['open', 'claim:1', 'out:2:16384', 'out:2:16384', 'out:2:7232', 'release:1', 'close']);
  });

  it('reports a missing/ungranted device as retryable DEVICE_NOT_FOUND', async () => {
    const r = await new WebUsbPrintAdapter(() => ({ getDevices: async () => [] })).print(req(noCut, new Uint8Array(1)));
    expect(r).toMatchObject({ state: 'FAILED', error: { code: 'DEVICE_NOT_FOUND' }, retryable: true });
  });

  it('matches serialNumber when the profile pins one', async () => {
    const r = await new WebUsbPrintAdapter(() => ({ getDevices: async () => [usbDevice()] })).print(
      req(k80({ autoCut: false, device: { kind: 'usb', vendorId: 0x0416, productId: 0x5011, serialNumber: 'OTHER' } }), new Uint8Array(1)),
    );
    expect(r).toMatchObject({ error: { code: 'DEVICE_NOT_FOUND' } });
  });

  it('maps a claim failure (OS driver owns the interface) to DEVICE_BUSY', async () => {
    const dev = usbDevice({ claimInterface: async () => { throw Object.assign(new Error('x'), { name: 'NetworkError' }); } });
    const r = await new WebUsbPrintAdapter(() => ({ getDevices: async () => [dev] })).print(req(noCut, new Uint8Array(1)));
    expect(r).toMatchObject({ state: 'FAILED', error: { code: 'DEVICE_BUSY' }, retryable: true });
    expect(dev.log).toContain('close');
  });

  it('never marks a partially written job retryable (unplugged mid-transfer)', async () => {
    const unplugged = Object.assign(new Error('gone'), { name: 'NotFoundError' });
    const dev = usbDevice({ chunkStatus: ['ok', unplugged] });
    const r = await new WebUsbPrintAdapter(() => ({ getDevices: async () => [dev] })).print(req(noCut, new Uint8Array(20_000)));
    expect(r).toMatchObject({ state: 'FAILED', outcome: 'PARTIAL_TRANSFER', retryable: false, bytesWritten: 16_384 });
  });

  it('treats a disconnect before any byte as retryable DEVICE_DISCONNECTED', async () => {
    const dev = usbDevice({ chunkStatus: [Object.assign(new Error('gone'), { name: 'NotFoundError' })] });
    const r = await new WebUsbPrintAdapter(() => ({ getDevices: async () => [dev] })).print(req(noCut, new Uint8Array(10)));
    expect(r).toMatchObject({ state: 'FAILED', error: { code: 'DEVICE_DISCONNECTED' }, retryable: true });
  });

  it('times out a stalled transfer', async () => {
    const dev = usbDevice({ transferOut: () => new Promise(() => undefined) });
    const r = await new WebUsbPrintAdapter(() => ({ getDevices: async () => [dev] }), { timeoutMs: 20 }).print(req(noCut, new Uint8Array(10)));
    expect(r).toMatchObject({ state: 'FAILED', error: { code: 'TIMEOUT' } });
  });

  it('reports UNSUPPORTED_CAPABILITY when WebUSB is missing', async () => {
    const a = new WebUsbPrintAdapter(() => undefined);
    expect(await a.isSupported()).toBe(false);
    expect(await a.print(req(noCut, new Uint8Array(1)))).toMatchObject({ error: { code: 'UNSUPPORTED_CAPABILITY' }, retryable: false });
    expect(await a.getStatus(noCut)).toEqual({ ready: false, reason: 'WEBUSB_UNAVAILABLE' });
  });
});

function serialPort(over: { openError?: string; writeError?: string; info?: { usbVendorId?: number; usbProductId?: number } } = {}) {
  const written: number[] = [];
  const log: string[] = [];
  const port: SerialPortLike & { written: number[]; log: string[]; options?: unknown } = {
    written,
    log,
    getInfo: () => over.info ?? { usbVendorId: 0x0a5f, usbProductId: 0x0001 },
    async open(o) {
      port.options = o;
      if (over.openError) throw Object.assign(new Error('x'), { name: over.openError });
      log.push('open');
    },
    async close() { log.push('close'); },
    get writable() {
      return new WritableStream<Uint8Array>({
        write(chunk) {
          if (over.writeError) throw Object.assign(new Error('x'), { name: over.writeError });
          written.push(...chunk);
        },
      });
    },
  };
  return port;
}

describe('WebSerialPrintAdapter', () => {
  it('opens with the profile settings, writes and closes', async () => {
    const port = serialPort();
    const r = await new WebSerialPrintAdapter(() => ({ getPorts: async () => [port] })).print({ ...req(label(), Uint8Array.from([1, 2, 3])), format: 'ZPL' });
    expect(r).toMatchObject({ state: 'SUBMITTED', outcome: 'BYTES_WRITTEN_TO_PORT', bytesWritten: 3 });
    expect(port.options).toEqual({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' });
    expect(port.written).toEqual([1, 2, 3]);
    expect(port.log).toEqual(['open', 'close']);
  });

  it('maps an already-open port to DEVICE_BUSY', async () => {
    const r = await new WebSerialPrintAdapter(() => ({ getPorts: async () => [serialPort({ openError: 'InvalidStateError' })] })).print(req(label(), new Uint8Array(1)));
    expect(r).toMatchObject({ state: 'FAILED', error: { code: 'DEVICE_BUSY' }, retryable: true });
  });

  it('does not retry once writing started', async () => {
    const port = serialPort({ writeError: 'NetworkError' });
    const r = await new WebSerialPrintAdapter(() => ({ getPorts: async () => [port] })).print(req(label(), new Uint8Array(4)));
    expect(r).toMatchObject({ state: 'FAILED', outcome: 'PARTIAL_TRANSFER', retryable: false });
    expect(port.log).toContain('close');
  });

  it('selects ports by USB ids and index', () => {
    const a = serialPort();
    const b = serialPort();
    const other = serialPort({ info: { usbVendorId: 1, usbProductId: 2 } });
    expect(matchSerialPort([other, a, b], { kind: 'serial', usbVendorId: 0x0a5f, usbProductId: 0x0001, index: 1 })).toBe(b);
    expect(matchSerialPort([other], { kind: 'serial', usbVendorId: 0x0a5f })).toBeUndefined();
  });
});
