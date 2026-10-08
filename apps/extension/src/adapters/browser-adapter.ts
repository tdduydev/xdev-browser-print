import type { PrinterCapabilities, PrinterStatus } from '@xdev/shared-types';
import type { RunnerHost } from '../background/runner';
import type { PrintAdapter, PrintRequest, PrintResult } from './types';

/**
 * PDF/HTML through Chrome's own print preview. The user picks the printer in the dialog;
 * Chrome gives no "printed" signal, so the best possible result is UNKNOWN/PRINT_DIALOG_CLOSED.
 * The only dialog-free path is an admin launching Chrome with --kiosk-printing, which prints
 * to the OS default printer — documented, not assumed.
 */
export class BrowserPrintAdapter implements PrintAdapter {
  readonly id = 'browser' as const;

  constructor(private readonly runner: RunnerHost) {}

  async isSupported() {
    return true;
  }

  async getCapabilities(): Promise<PrinterCapabilities> {
    return { formats: ['PDF', 'HTML'], silent: false, selectPrinter: false };
  }

  async getStatus(): Promise<PrinterStatus> {
    return { ready: true };
  }

  print(req: PrintRequest): Promise<PrintResult> {
    return this.runner.run(req.jobId, { focused: true });
  }
}

/** WebUSB/Web Serial executed in print.html when the service worker lacks the API. */
export class RunnerRawAdapter implements PrintAdapter {
  constructor(
    readonly id: 'webusb' | 'webserial',
    private readonly runner: RunnerHost,
  ) {}

  async isSupported() {
    return true;
  }

  async getCapabilities(): Promise<PrinterCapabilities> {
    return { formats: ['ESCPOS', 'ZPL', 'TSPL', 'RAW'], silent: false, selectPrinter: true };
  }

  async getStatus(): Promise<PrinterStatus> {
    return { ready: true, reason: 'CHECKED_AT_PRINT_TIME' };
  }

  print(req: PrintRequest): Promise<PrintResult> {
    return this.runner.run(req.jobId, { focused: false });
  }
}
