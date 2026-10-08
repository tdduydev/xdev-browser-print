import type { ErrorCode } from './errors';
import type { AdapterType, PrintFormat } from './config';

/**
 * COMPLETED intentionally does not exist: neither Chrome's print dialog nor a USB/serial
 * write gives a trustworthy "paper came out" signal.
 */
export const JOB_STATES = [
  'CREATED',
  'VALIDATING',
  'WAITING_PERMISSION',
  'QUEUED',
  'DISPATCHING',
  'SUBMITTED',
  'FAILED',
  'CANCELLED',
  'UNKNOWN',
] as const;
export type JobState = (typeof JOB_STATES)[number];

export const TERMINAL_JOB_STATES: readonly JobState[] = ['SUBMITTED', 'FAILED', 'CANCELLED', 'UNKNOWN'];

/** Metadata only. Document content is never stored in history. */
export interface PrintJobRecord {
  jobId: string;
  idempotencyKey: string;
  origin: string;
  documentType: string;
  format: PrintFormat;
  sizeBytes: number;
  copies?: number;
  profileId?: string;
  adapter?: AdapterType;
  state: JobState;
  /** Why the state is what it is, e.g. PRINT_DIALOG_CLOSED for browser jobs. */
  outcome?: string;
  errorCode?: ErrorCode;
  errorMessage?: string;
  attempts: number;
  createdAt: number;
  updatedAt: number;
  history: { state: JobState; at: number }[];
}

export type PublicJobStatus = Pick<
  PrintJobRecord,
  'jobId' | 'idempotencyKey' | 'documentType' | 'format' | 'state' | 'outcome' | 'errorCode' | 'errorMessage' | 'adapter' | 'profileId' | 'createdAt' | 'updatedAt'
>;
