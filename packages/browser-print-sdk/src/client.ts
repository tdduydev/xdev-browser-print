import type {
  BridgeEvent,
  Capabilities,
  ConnectResult,
  DocumentMapping,
  ExtensionStatus,
  PrintFormat,
  PublicJobStatus,
  PublicPrinter,
  SaveMappingParams,
  Scope,
} from '@xdev/shared-types';
import { TERMINAL_JOB_STATES } from '@xdev/shared-types';
import { bytesToBase64, randomId } from '@xdev/core';
import { BrowserPrintError, NotInstalledError, PrintJobError, UnsupportedCapabilityError } from './errors';
import { PostMessageTransport } from './transport';

// release-please rewrites the marked line on every release, keeping it equal to package.json.
export const SDK_VERSION = '0.2.0'; // x-release-please-version

export interface XDevBrowserPrintOptions {
  /** Pin to one extension build; others answering on the page are ignored. */
  extensionId?: string;
  /** Scopes requested by connect(). Default read + print. */
  scopes?: Scope[];
  appName?: string;
  /** Per-request timeout (ms). Default 10 000. */
  timeoutMs?: number;
  /** How long to wait for the content script on detection (ms). Default 1 500. */
  detectTimeoutMs?: number;
  /** connect() waits for the user in the approval window; default 130 000. */
  connectTimeoutMs?: number;
  /** For tests: window to talk through. */
  target?: Window;
}

export type PrintData = Blob | ArrayBuffer | Uint8Array | string;

export interface PrintOptions {
  documentType: string;
  format: PrintFormat;
  data: PrintData;
  copies?: number;
  printerId?: string;
  title?: string;
  /** Re-use to make retries safe; default: a fresh key per call. */
  idempotencyKey?: string;
  /** 'accepted' resolves once queued; 'settled' (default) waits for a terminal state. */
  wait?: 'accepted' | 'settled';
  /** Max wait for 'settled' (ms). Default 15 minutes (the user may sit in the print dialog). */
  settleTimeoutMs?: number;
}

export type StatusListener = (event: { type: 'job'; job: PublicJobStatus } | { type: 'status'; reason: string }) => void;

const BINARY_FORMATS: PrintFormat[] = ['PDF', 'RAW'];

/** Blob.arrayBuffer() is missing in older Safari and in jsdom; FileReader works everywhere. */
function blobToBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer().then((b) => new Uint8Array(b));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

async function encodeData(format: PrintFormat, data: PrintData): Promise<{ data: string; dataEncoding: 'base64' | 'text' }> {
  if (typeof data === 'string') {
    if (BINARY_FORMATS.includes(format)) return { data, dataEncoding: 'base64' }; // caller passes base64
    return { data, dataEncoding: 'text' };
  }
  let bytes: Uint8Array;
  if (data instanceof Uint8Array) bytes = data;
  else if (data instanceof ArrayBuffer) bytes = new Uint8Array(data);
  else if (typeof Blob !== 'undefined' && data instanceof Blob) bytes = await blobToBytes(data);
  else throw new BrowserPrintError('INVALID_REQUEST', 'Unsupported data type');
  return { data: bytesToBase64(bytes), dataEncoding: 'base64' };
}

export class XDevBrowserPrint {
  private readonly transport: PostMessageTransport;
  private readonly opts: Required<Pick<XDevBrowserPrintOptions, 'timeoutMs' | 'detectTimeoutMs' | 'connectTimeoutMs'>> & XDevBrowserPrintOptions;
  private session: ConnectResult | null = null;
  private readonly listeners = new Set<StatusListener>();

  constructor(options: XDevBrowserPrintOptions = {}) {
    this.opts = { timeoutMs: 10_000, detectTimeoutMs: 1_500, connectTimeoutMs: 130_000, ...options };
    this.transport = new PostMessageTransport({ ...(options.extensionId && { extensionId: options.extensionId }), ...(options.target && { target: options.target }) });
    this.transport.onEvent((e: BridgeEvent) => {
      if (e.type === 'status' && e.status.reason === 'PORT_DISCONNECTED') {
        // The worker restarted or the site was revoked; the next call reconnects.
      }
      const ev = e.type === 'job' ? { type: 'job' as const, job: e.job } : { type: 'status' as const, reason: e.status.reason };
      for (const l of this.listeners) l(ev);
    });
  }

  get connected(): boolean {
    return this.session !== null;
  }

  get scopes(): Scope[] {
    return this.session?.scopes ?? [];
  }

  /** True when the extension bridge answers on this page (installed, enabled, site allowed). */
  async isInstalled(): Promise<boolean> {
    return (await this.transport.detect(this.opts.detectTimeoutMs)) !== false;
  }

  /** Pairs with the extension. May open an approval window in the extension. */
  async connect(): Promise<ConnectResult> {
    if (!(await this.isInstalled())) throw new NotInstalledError();
    this.session = await this.transport.request(
      'connect',
      { scopes: this.opts.scopes ?? ['read', 'print'], sdkVersion: SDK_VERSION, ...(this.opts.appName && { appName: this.opts.appName }) },
      this.opts.connectTimeoutMs,
    );
    return this.session;
  }

  async disconnect(): Promise<void> {
    if (this.session) await this.transport.request('disconnect', {}, this.opts.timeoutMs).catch(() => undefined);
    this.session = null;
  }

  /** Releases listeners; the instance cannot be used afterwards. */
  dispose(): void {
    this.listeners.clear();
    this.transport.dispose();
  }

  getStatus(): Promise<ExtensionStatus> {
    return this.call('getStatus', {});
  }

  getCapabilities(): Promise<Capabilities> {
    return this.call('getCapabilities', {});
  }

  /** Configured printer profiles. Chrome cannot enumerate OS printers outside ChromeOS. */
  getPrinters(): Promise<PublicPrinter[]> {
    return this.call('getPrinters', {});
  }

  getMappings(): Promise<DocumentMapping[]> {
    return this.call('getMappings', {});
  }

  saveMapping(mapping: SaveMappingParams): Promise<DocumentMapping> {
    return this.call('saveMapping', mapping);
  }

  async deleteMapping(documentType: string): Promise<void> {
    await this.call('deleteMapping', { documentType });
  }

  getJobStatus(jobId: string): Promise<PublicJobStatus> {
    return this.call('getJobStatus', { jobId });
  }

  cancelJob(jobId: string): Promise<PublicJobStatus> {
    return this.call('cancelJob', { jobId });
  }

  /**
   * Submits a job. Resolves with the job status: SUBMITTED (device accepted the bytes) or
   * UNKNOWN (e.g. PRINT_DIALOG_CLOSED — Chrome does not report whether the user printed).
   * Rejects with PrintJobError on FAILED/CANCELLED.
   */
  async print(options: PrintOptions): Promise<PublicJobStatus> {
    const encoded = await encodeData(options.format, options.data);
    const idempotencyKey = options.idempotencyKey ?? randomId('idem');
    const accepted = await this.call('print', {
      documentType: options.documentType,
      format: options.format,
      ...encoded,
      idempotencyKey,
      ...(options.copies !== undefined && { copies: options.copies }),
      ...(options.printerId !== undefined && { printerId: options.printerId }),
      ...(options.title !== undefined && { title: options.title }),
    }, Math.max(this.opts.timeoutMs, 30_000));
    if (options.wait === 'accepted') return this.getJobStatus(accepted.jobId);
    return this.waitForJob(accepted.jobId, options.settleTimeoutMs ?? 15 * 60_000);
  }

  printPdf(documentType: string, data: PrintData, options: Omit<PrintOptions, 'documentType' | 'format' | 'data'> = {}): Promise<PublicJobStatus> {
    return this.print({ ...options, documentType, format: 'PDF', data });
  }

  printRaw(
    documentType: string,
    format: 'ESCPOS' | 'ZPL' | 'TSPL' | 'RAW',
    data: PrintData,
    options: Omit<PrintOptions, 'documentType' | 'format' | 'data'> = {},
  ): Promise<PublicJobStatus> {
    if (!['ESCPOS', 'ZPL', 'TSPL', 'RAW'].includes(format)) {
      return Promise.reject(new UnsupportedCapabilityError(`Format ${format} is not a raw format`));
    }
    return this.print({ ...options, documentType, format, data });
  }

  /** Job and connection events. Returns an unsubscribe function. */
  onStatusChanged(listener: StatusListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Events first, polling as a fallback: events are lost while the worker restarts. */
  private waitForJob(jobId: string, timeoutMs: number): Promise<PublicJobStatus> {
    return new Promise((resolve, reject) => {
      let finished = false;
      const settle = (job: PublicJobStatus) => {
        if (finished || !TERMINAL_JOB_STATES.includes(job.state)) return;
        finished = true;
        cleanup();
        if (job.state === 'FAILED' || job.state === 'CANCELLED') reject(new PrintJobError(job));
        else resolve(job);
      };
      const unsubscribe = this.onStatusChanged((e) => {
        if (e.type === 'job' && e.job.jobId === jobId) settle(e.job);
      });
      const poll = setInterval(() => {
        this.getJobStatus(jobId).then(settle, () => undefined);
      }, 2_000);
      const timer = setTimeout(() => {
        if (finished) return;
        finished = true;
        cleanup();
        reject(new BrowserPrintError('TIMEOUT', `Job ${jobId} did not settle in time`, { jobId }));
      }, timeoutMs);
      const cleanup = () => {
        unsubscribe();
        clearInterval(poll);
        clearTimeout(timer);
      };
      this.getJobStatus(jobId).then(settle, () => undefined);
    });
  }

  private call<M extends Parameters<PostMessageTransport['request']>[0]>(
    method: M,
    params: Parameters<PostMessageTransport['request']>[1] & object,
    timeoutMs = this.opts.timeoutMs,
  ) {
    return this.transport.request(method, params as never, timeoutMs);
  }
}
