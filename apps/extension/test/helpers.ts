import type { AdapterType, PrintConfig, PrintParams } from '@xdev/shared-types';
import { bytesToBase64, buildTextPdf } from '@xdev/core';
import type { PrintAdapter, PrintRequest, PrintResult } from '../src/adapters/types';
import type { KeyValueArea } from '../src/storage/config-store';
import { sampleConfig } from '../../../packages/core/test/fixtures';

export { sampleConfig };

export class MemoryArea implements KeyValueArea {
  data: Record<string, unknown> = {};
  async get(keys: string | string[]) {
    const out: Record<string, unknown> = {};
    for (const k of Array.isArray(keys) ? keys : [keys]) if (k in this.data) out[k] = structuredClone(this.data[k]);
    return out;
  }
  async set(items: Record<string, unknown>) {
    // Yield like the real async API so interleavings show up in tests.
    await new Promise((r) => setTimeout(r, 0));
    Object.assign(this.data, structuredClone(items));
  }
}

export class FakeAdapter implements PrintAdapter {
  calls: PrintRequest[] = [];
  results: (PrintResult | Error | (() => Promise<PrintResult>))[] = [];
  constructor(readonly id: AdapterType) {}
  async isSupported() {
    return true;
  }
  async getCapabilities() {
    return { formats: [], silent: false, selectPrinter: false };
  }
  async getStatus() {
    return { ready: true };
  }
  async print(req: PrintRequest): Promise<PrintResult> {
    this.calls.push(req);
    const next = this.results.shift() ?? { state: 'SUBMITTED', outcome: 'OK' };
    if (next instanceof Error) throw next;
    if (typeof next === 'function') return next();
    return next;
  }
}

export function fakeAdapters() {
  return { browser: new FakeAdapter('browser'), webusb: new FakeAdapter('webusb'), webserial: new FakeAdapter('webserial') };
}

let n = 0;
export function pdfParams(over: Partial<PrintParams> = {}): PrintParams {
  n++;
  return {
    documentType: 'PRESCRIPTION',
    format: 'PDF',
    data: bytesToBase64(buildTextPdf({ widthMm: 148, heightMm: 210, lines: ['x'] })),
    dataEncoding: 'base64',
    idempotencyKey: `idem-test-${n}-${Date.now()}`,
    ...over,
  };
}

export function escposParams(over: Partial<PrintParams> = {}): PrintParams {
  return pdfParams({ documentType: 'INVOICE', format: 'ESCPOS', data: bytesToBase64(new Uint8Array([0x1b, 0x40, 0x41])), ...over });
}

export function configWith(mut: (c: PrintConfig) => void = () => undefined): PrintConfig {
  const c = sampleConfig();
  mut(c);
  return c;
}
