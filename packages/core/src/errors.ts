import type { ErrorCode, SerializedError } from '@xdev/shared-types';

export class PrintError extends Error {
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'PrintError';
    this.code = code;
    this.details = details;
  }

  toJSON(): SerializedError {
    return this.details ? { code: this.code, message: this.message, details: this.details } : { code: this.code, message: this.message };
  }
}

export function toSerializedError(err: unknown): SerializedError {
  if (err instanceof PrintError) return err.toJSON();
  // Unknown errors may carry document fragments in their message; keep it generic.
  return { code: 'INTERNAL_ERROR', message: err instanceof Error ? err.name : 'Internal error' };
}
