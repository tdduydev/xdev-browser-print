import type { PrintResult } from '../adapters/types';

interface RunEntry {
  windowId?: number;
  dialogOpened: boolean;
  resolve: (r: PrintResult) => void;
}

export type RunnerStage = 'loaded' | 'dialog-opened' | 'transfer-started';

export function runnerUrl(jobId: string): string {
  return chrome.runtime.getURL(`print.html?job=${encodeURIComponent(jobId)}`);
}

/**
 * Runs a job inside an extension page (print.html). Needed because Chrome's print dialog
 * cannot be opened from a service worker, and WebUSB/Web Serial may not exist there.
 */
export class RunnerHost {
  private readonly runs = new Map<string, RunEntry>();

  run(jobId: string, opts: { focused: boolean }): Promise<PrintResult> {
    return new Promise((resolve) => {
      const entry: RunEntry = { dialogOpened: false, resolve };
      this.runs.set(jobId, entry);
      chrome.windows
        .create({ url: runnerUrl(jobId), type: 'popup', width: 560, height: 680, focused: opts.focused })
        .then((w) => {
          entry.windowId = w?.id;
        })
        .catch(() =>
          this.finish(jobId, {
            state: 'FAILED',
            outcome: 'RUNNER_NOT_OPENED',
            error: { code: 'INTERNAL_ERROR', message: 'Could not open print window' },
            retryable: true,
          }),
        );
    });
  }

  progress(jobId: string, stage: RunnerStage): void {
    const e = this.runs.get(jobId);
    if (e && (stage === 'dialog-opened' || stage === 'transfer-started')) e.dialogOpened = true;
  }

  /** Returns false when no in-memory run exists (service worker restarted meanwhile). */
  finish(jobId: string, result: PrintResult): boolean {
    const e = this.runs.get(jobId);
    if (!e) return false;
    this.runs.delete(jobId);
    e.resolve(result);
    return true;
  }

  onWindowRemoved(windowId: number): void {
    for (const [jobId, e] of this.runs) {
      if (e.windowId !== windowId) continue;
      this.finish(
        jobId,
        e.dialogOpened
          ? // The dialog was shown, so the user may have printed before closing.
            { state: 'UNKNOWN', outcome: 'PRINT_WINDOW_CLOSED' }
          : {
              state: 'FAILED',
              outcome: 'PRINT_WINDOW_CLOSED',
              error: { code: 'PRINT_WINDOW_CLOSED', message: 'Print window closed before printing started' },
              retryable: false,
            },
      );
    }
  }

  async isAlive(jobId: string): Promise<boolean> {
    if (this.runs.has(jobId)) return true;
    const contexts = await chrome.runtime.getContexts({ documentUrls: [runnerUrl(jobId)] }).catch(() => []);
    return contexts.length > 0;
  }
}
