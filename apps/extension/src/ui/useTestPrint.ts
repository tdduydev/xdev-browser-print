import { useCallback, useState } from 'react';
import type { PrintJobRecord, PrinterProfile } from '@xdev/shared-types';
import { TERMINAL_JOB_STATES } from '@xdev/shared-types';
import { callBackground, type TestKind } from '../lib/messages';
import { t } from './i18n';
import { errorText } from './useBackground';

/** The sample a one-click test sends: what the printer type most likely understands. */
export function defaultTestKind(profile: PrinterProfile): TestKind {
  if (profile.adapter === 'browser') return 'html';
  return profile.category === 'BARCODE' ? 'zpl' : 'escpos';
}

export function testKinds(profile: PrinterProfile | undefined): TestKind[] {
  return profile?.adapter === 'browser' ? ['pdf', 'html'] : ['escpos', 'zpl', 'tspl'];
}

export type TestState =
  | { phase: 'running'; jobId?: string }
  | { phase: 'done'; ok: boolean; text: string; job?: PrintJobRecord };

export function resultText(job: PrintJobRecord): { ok: boolean; text: string } {
  if (job.state === 'SUBMITTED') return { ok: true, text: t('test.submitted', { bytes: job.sizeBytes }) };
  if (job.state === 'UNKNOWN' && job.outcome === 'PRINT_DIALOG_CLOSED') return { ok: true, text: t('test.dialogClosed') };
  const reason = job.errorCode ? `${job.errorCode}: ${job.errorMessage ?? ''}` : (job.outcome ?? '');
  return { ok: false, text: t('test.failedState', { state: job.state, reason }) };
}

const POLL_MS = 500;
// Retries of a missing USB device back off for tens of seconds; the dialog path waits for the user.
const WAIT_MS = 120_000;

async function waitForJob(jobId: string): Promise<PrintJobRecord | undefined> {
  const until = Date.now() + WAIT_MS;
  while (Date.now() < until) {
    const job = (await callBackground('jobs.list', { limit: 50 })).find((j) => j.jobId === jobId);
    if (job && TERMINAL_JOB_STATES.includes(job.state)) return job;
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  return undefined;
}

/** Sends a test job and follows it to its final state, so the user sees whether the printer took it. */
export function useTestPrint() {
  const [state, setState] = useState<TestState | null>(null);
  const run = useCallback(async (profileId: string, kind: TestKind) => {
    setState({ phase: 'running' });
    try {
      const { jobId } = await callBackground('test.print', { profileId, kind });
      setState({ phase: 'running', jobId });
      const job = await waitForJob(jobId);
      setState(job ? { phase: 'done', ...resultText(job), job } : { phase: 'done', ok: false, text: t('test.timeout', { jobId }) });
    } catch (e) {
      setState({ phase: 'done', ok: false, text: errorText(e) });
    }
  }, []);
  return { state, run };
}
