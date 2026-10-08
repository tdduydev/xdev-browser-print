import type {
  AdapterType,
  Orientation,
  PrintFormat,
  PrinterCapabilities,
  PrinterProfile,
  PrinterStatus,
  SerializedError,
} from '@xdev/shared-types';
import type { StoredPayload } from '../storage/job-store';

export interface PrintRequest {
  jobId: string;
  format: PrintFormat;
  payload: StoredPayload;
  profile: PrinterProfile;
  copies: number;
  paperSize: string;
  orientation: Orientation;
  title?: string;
}

/**
 * SUBMITTED = bytes accepted by the device endpoint / port without error.
 * UNKNOWN   = handed to a flow whose outcome we cannot observe (Chrome print dialog).
 * Neither means "paper came out".
 */
export type PrintResult =
  | { state: 'SUBMITTED' | 'UNKNOWN'; outcome: string; bytesWritten?: number }
  | { state: 'FAILED'; outcome: string; error: SerializedError; retryable: boolean; bytesWritten?: number };

export interface PrintAdapter {
  readonly id: AdapterType;
  isSupported(): Promise<boolean>;
  getCapabilities(): Promise<PrinterCapabilities>;
  print(request: PrintRequest): Promise<PrintResult>;
  getStatus(profile?: PrinterProfile): Promise<PrinterStatus>;
}

export class TimeoutError extends Error {
  constructor(label: string) {
    super(`${label} timed out`);
    this.name = 'TimeoutError';
  }
}

export function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    p.finally(() => clearTimeout(timer)),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new TimeoutError(label)), ms);
    }),
  ]);
}
