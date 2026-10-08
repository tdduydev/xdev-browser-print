import type {
  Capabilities,
  DocumentMapping,
  ExtensionSettings,
  PrintAccepted,
  PrintConfig,
  PrintFormat,
  PrintJobRecord,
  PrinterProfile,
  PrinterStatus,
  SaveMappingParams,
  Scope,
  SerializedError,
  SiteGrant,
} from '@xdev/shared-types';
import type { PrintResult } from '../adapters/types';
import type { ApprovalAnswer, ApprovalRequest } from '../background/approvals';
import type { RunnerStage } from '../background/runner';

export type TestKind = 'pdf' | 'html' | 'escpos' | 'zpl' | 'tspl';

export interface RunnerJob {
  jobId: string;
  format: PrintFormat;
  adapter: PrinterProfile['adapter'];
  profile: PrinterProfile;
  copies: number;
  paperSize: string;
  orientation: PrinterProfile['orientation'];
  documentType: string;
}

export interface DashboardStatus {
  version: string;
  platform: string;
  sites: number;
  profiles: number;
  mappings: number;
  activeJobs: number;
  capabilities: Capabilities;
}

/** Messages between extension pages and the service worker (never accepted from web pages). */
export interface InternalApi {
  'config.get': { req: Record<string, never>; res: { config: PrintConfig; sites: SiteGrant[] } };
  'profile.upsert': { req: { profile: PrinterProfile }; res: PrintConfig };
  'profile.delete': { req: { id: string }; res: PrintConfig };
  'profile.status': { req: { id: string }; res: PrinterStatus };
  'mapping.save': { req: { params: SaveMappingParams }; res: DocumentMapping };
  'mapping.delete': { req: { documentType: string }; res: PrintConfig };
  'settings.update': { req: { patch: Partial<ExtensionSettings> }; res: PrintConfig };
  'sites.pending': { req: { origin: string; scopes: Scope[]; confirmEachJob: boolean }; res: null };
  'sites.add': { req: { origin: string; scopes: Scope[]; confirmEachJob: boolean; label?: string }; res: SiteGrant };
  'sites.update': { req: { origin: string; scopes?: Scope[]; confirmEachJob?: boolean }; res: null };
  'sites.remove': { req: { origin: string }; res: null };
  'jobs.list': { req: { limit: number }; res: PrintJobRecord[] };
  'jobs.clear': { req: Record<string, never>; res: null };
  'jobs.cancel': { req: { jobId: string }; res: PrintJobRecord };
  'test.print': { req: { profileId: string; kind: TestKind }; res: PrintAccepted };
  'status.get': { req: Record<string, never>; res: DashboardStatus };
  'approval.get': { req: { id: string }; res: ApprovalRequest | null };
  'approval.respond': { req: { id: string; answer: ApprovalAnswer }; res: boolean };
  'runner.request': { req: { jobId: string }; res: RunnerJob };
  'runner.progress': { req: { jobId: string; stage: RunnerStage }; res: null };
  'runner.result': { req: { jobId: string; result: PrintResult }; res: null };
}

export type InternalType = keyof InternalApi;
export type InternalMessage<T extends InternalType = InternalType> = { type: T } & InternalApi[T]['req'];
export type InternalReply<T extends InternalType = InternalType> = { ok: true; result: InternalApi[T]['res'] } | { ok: false; error: SerializedError };

/** Broadcast from the service worker to open extension pages. */
export type Broadcast = { type: 'broadcast.jobs' } | { type: 'broadcast.config' };

export class InternalError extends Error {
  constructor(readonly error: SerializedError) {
    super(error.message);
    this.name = 'InternalError';
  }
}

export async function callBackground<T extends InternalType>(type: T, req: InternalApi[T]['req']): Promise<InternalApi[T]['res']> {
  const reply = (await chrome.runtime.sendMessage({ type, ...req })) as InternalReply<T> | undefined;
  if (!reply) throw new InternalError({ code: 'EXTENSION_DISCONNECTED', message: 'No reply from service worker' });
  if (!reply.ok) throw new InternalError(reply.error);
  return reply.result;
}
