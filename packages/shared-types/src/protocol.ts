import type { SerializedError } from './errors';
import type { Capabilities, PrinterStatus } from './capabilities';
import type { DocumentMapping, Orientation, PrintFormat, PrinterCategory, AdapterType, Scope } from './config';
import type { JobState, PublicJobStatus } from './jobs';

export const PROTOCOL_VERSION = 1;
/** window.postMessage channel tag between page SDK and content script. */
export const BRIDGE_CHANNEL = 'xdev-browser-print';
export const BRIDGE_PORT_NAME = 'xdbp-bridge';

export interface ConnectParams {
  scopes: Scope[];
  sdkVersion: string;
  appName?: string;
}

export interface ConnectResult {
  extensionId: string;
  extensionVersion: string;
  protocolVersion: number;
  origin: string;
  scopes: Scope[];
}

export interface ExtensionStatus {
  extensionVersion: string;
  connected: boolean;
  origin: string;
  scopes: Scope[];
  profiles: number;
  mappings: number;
  queuedJobs: number;
}

/** What sites see about a printer: no device serials, no internal fields. */
export interface PublicPrinter {
  id: string;
  name: string;
  adapter: AdapterType;
  category: PrinterCategory;
  paperSize: string;
  isDefault: boolean;
  status: PrinterStatus;
}

export interface SaveMappingParams {
  documentType: string;
  printerId: string;
  paperSize?: string;
  copies?: number;
  orientation?: Orientation;
}

export interface PrintParams {
  documentType: string;
  format: PrintFormat;
  /** Base64 for binary formats (PDF, RAW); plain string allowed for HTML/ZPL/TSPL/ESCPOS text. */
  data: string;
  dataEncoding: 'base64' | 'text';
  idempotencyKey: string;
  copies?: number;
  /** Explicit profile instead of the mapping. Requires the profile to exist. */
  printerId?: string;
  title?: string;
}

export interface PrintAccepted {
  jobId: string;
  state: JobState;
  duplicate: boolean;
}

export interface MethodMap {
  connect: { params: ConnectParams; result: ConnectResult };
  disconnect: { params: Record<string, never>; result: { ok: true } };
  ping: { params: Record<string, never>; result: { extensionId: string; extensionVersion: string; protocolVersion: number } };
  getStatus: { params: Record<string, never>; result: ExtensionStatus };
  getCapabilities: { params: Record<string, never>; result: Capabilities };
  getPrinters: { params: Record<string, never>; result: PublicPrinter[] };
  getMappings: { params: Record<string, never>; result: DocumentMapping[] };
  saveMapping: { params: SaveMappingParams; result: DocumentMapping };
  deleteMapping: { params: { documentType: string }; result: { ok: true } };
  print: { params: PrintParams; result: PrintAccepted };
  getJobStatus: { params: { jobId?: string; idempotencyKey?: string }; result: PublicJobStatus };
  cancelJob: { params: { jobId: string }; result: PublicJobStatus };
}

export type MethodName = keyof MethodMap;

export const METHOD_SCOPES: Record<MethodName, Scope | null> = {
  connect: null,
  disconnect: null,
  ping: null,
  getStatus: 'read',
  getCapabilities: 'read',
  getPrinters: 'read',
  getMappings: 'read',
  saveMapping: 'configure',
  deleteMapping: 'configure',
  print: 'print',
  getJobStatus: 'print',
  cancelJob: 'print',
};

export interface BridgeRequest<M extends MethodName = MethodName> {
  /** Unique per request; the extension rejects reuse inside the replay window. */
  requestId: string;
  /** ms since epoch; stale requests are rejected. */
  sentAt: number;
  method: M;
  params: MethodMap[M]['params'];
}

export type BridgeResponse<M extends MethodName = MethodName> =
  | { requestId: string; ok: true; result: MethodMap[M]['result'] }
  | { requestId: string; ok: false; error: SerializedError };

export type BridgeEvent =
  | { type: 'job'; job: PublicJobStatus }
  | { type: 'status'; status: Partial<ExtensionStatus> & { reason: string } };

/** Envelope used on window.postMessage between the page and the content script. */
export type PageEnvelope =
  | { channel: typeof BRIDGE_CHANNEL; dir: 'to-ext'; kind: 'request'; payload: BridgeRequest; targetExtensionId?: string }
  | { channel: typeof BRIDGE_CHANNEL; dir: 'to-ext'; kind: 'hello' }
  | { channel: typeof BRIDGE_CHANNEL; dir: 'from-ext'; kind: 'response'; payload: BridgeResponse; extensionId: string }
  | { channel: typeof BRIDGE_CHANNEL; dir: 'from-ext'; kind: 'event'; payload: BridgeEvent; extensionId: string }
  | { channel: typeof BRIDGE_CHANNEL; dir: 'from-ext'; kind: 'ready'; extensionId: string; protocolVersion: number };
