import { PrintError, toSerializedError } from '@xdev/core';
import { WebSerialPrintAdapter, type SerialLike } from '../adapters/webserial-adapter';
import { WebUsbPrintAdapter, type UsbLike } from '../adapters/webusb-adapter';
import type { PrintResult } from '../adapters/types';
import { callBackground } from '../lib/messages';
import { IdbJobStore } from '../storage/job-store';
import { t, loadLanguage } from '../ui/i18n';
import { buildPrintableHtml, printHtml, printPdf } from './render';

const jobId = new URLSearchParams(location.search).get('job') ?? '';
const statusEl = document.getElementById('status')!;
const detailEl = document.getElementById('detail')!;
const stage = document.getElementById('stage')!;
const closeBtn = document.getElementById('close') as HTMLButtonElement;

// Keeps the service worker alive while the user is in the print dialog.
const keepAlive = chrome.runtime.connect({ name: 'xdbp-keepalive' });
const ping = setInterval(() => keepAlive.postMessage({ ping: Date.now() }), 20_000);

let reported = false;
async function report(result: PrintResult) {
  if (reported) return;
  reported = true;
  await callBackground('runner.result', { jobId, result }).catch(() => undefined);
}

function setStatus(text: string, detail = '') {
  statusEl.textContent = text;
  detailEl.textContent = detail;
}

async function run() {
  await loadLanguage();
  document.title = t('print.title');
  closeBtn.textContent = t('common.close');
  closeBtn.onclick = () => window.close();
  setStatus(t('print.preparing'));

  const job = await callBackground('runner.request', { jobId });
  const payload = await new IdbJobStore().getPayload(jobId);
  if (!payload) throw new PrintError('INTERNAL_ERROR', 'Payload missing');
  await callBackground('runner.progress', { jobId, stage: 'loaded' });

  if (job.adapter === 'browser') {
    setStatus(t('print.dialog'), t('print.copiesHint', { copies: job.copies }));
    const onDialog = () => void callBackground('runner.progress', { jobId, stage: 'dialog-opened' });
    if (job.format === 'PDF') {
      if (payload.kind !== 'bytes') throw new PrintError('INVALID_REQUEST', 'PDF payload must be binary');
      const revoke = await printPdf(stage, payload.bytes, onDialog);
      setTimeout(revoke, 60_000);
    } else {
      const html = payload.kind === 'text' ? payload.text : new TextDecoder().decode(payload.bytes);
      await printHtml(stage, buildPrintableHtml(html, { paperSize: job.paperSize, orientation: job.orientation, margins: job.profile.marginsMm, copies: job.copies }), onDialog);
    }
    // print() returned: the dialog closed. Chrome does not tell us whether the user printed.
    await report({ state: 'UNKNOWN', outcome: 'PRINT_DIALOG_CLOSED' });
    setStatus(t('print.dialogClosed'));
    setTimeout(() => window.close(), 1500);
    return;
  }

  setStatus(t('print.sending'));
  await callBackground('runner.progress', { jobId, stage: 'transfer-started' });
  const nav = navigator as Navigator & { usb?: UsbLike; serial?: SerialLike };
  const adapter = job.adapter === 'webusb' ? new WebUsbPrintAdapter(() => nav.usb) : new WebSerialPrintAdapter(() => nav.serial);
  const result = await adapter.print({ jobId, format: job.format, payload, profile: job.profile, copies: job.copies, paperSize: job.paperSize, orientation: job.orientation });
  await report(result);
  setStatus(result.state === 'FAILED' ? t('print.failed') : t('print.sent'), result.state === 'FAILED' ? result.error.message : '');
  setTimeout(() => window.close(), result.state === 'FAILED' ? 4000 : 800);
}

run()
  .catch(async (e: unknown) => {
    const error = toSerializedError(e);
    setStatus(t('print.failed'), error.message);
    await report({ state: 'FAILED', outcome: 'RUNNER_ERROR', error, retryable: false });
  })
  .finally(() => clearInterval(ping));
