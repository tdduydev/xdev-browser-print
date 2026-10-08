import type { ErrorCode, PublicJobStatus, SerializedError } from '@xdev/shared-types';

export class BrowserPrintError extends Error {
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'BrowserPrintError';
    this.code = code;
    this.details = details;
  }

  static from(e: SerializedError): BrowserPrintError {
    switch (e.code) {
      case 'NOT_INSTALLED':
        return new NotInstalledError(e.message);
      case 'TIMEOUT':
        return new BrowserPrintTimeoutError(e.message);
      case 'ORIGIN_NOT_ALLOWED':
      case 'PERMISSION_DENIED':
      case 'PAIRING_REJECTED':
        return new PermissionError(e.code, e.message, e.details);
      case 'UNSUPPORTED_CAPABILITY':
      case 'UNSUPPORTED_FORMAT':
        return new UnsupportedCapabilityError(e.message, e.details, e.code);
      default:
        return new BrowserPrintError(e.code, e.message, e.details);
    }
  }
}

/** The extension bridge was not detected: not installed, disabled, or this site not allowed. */
export class NotInstalledError extends BrowserPrintError {
  constructor(message = 'xDev Browser Print extension not detected on this page') {
    super('NOT_INSTALLED', message);
    this.name = 'NotInstalledError';
  }
}

export class BrowserPrintTimeoutError extends BrowserPrintError {
  constructor(message = 'Request timed out') {
    super('TIMEOUT', message);
    this.name = 'BrowserPrintTimeoutError';
  }
}

export class PermissionError extends BrowserPrintError {
  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(code, message, details);
    this.name = 'PermissionError';
  }
}

export class UnsupportedCapabilityError extends BrowserPrintError {
  constructor(message: string, details?: Record<string, unknown>, code: ErrorCode = 'UNSUPPORTED_CAPABILITY') {
    super(code, message, details);
    this.name = 'UnsupportedCapabilityError';
  }
}

/** The job reached FAILED or CANCELLED. `job` carries the final status. */
export class PrintJobError extends BrowserPrintError {
  readonly job: PublicJobStatus;

  constructor(job: PublicJobStatus) {
    super(job.errorCode ?? (job.state === 'CANCELLED' ? 'JOB_CANCELLED' : 'INTERNAL_ERROR'), job.errorMessage ?? `Print job ${job.state}`);
    this.name = 'PrintJobError';
    this.job = job;
  }
}
