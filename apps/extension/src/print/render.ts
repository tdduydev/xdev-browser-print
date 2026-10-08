import DOMPurify from 'dompurify';
import type { Orientation } from '@xdev/shared-types';
import { pageCss, parsePaperSize } from '@xdev/core';

/**
 * Untrusted site HTML is (1) sanitized, (2) placed in a sandboxed iframe without
 * allow-scripts, and (3) still under the extension-page CSP (srcdoc inherits it).
 * So no site-supplied script ever runs with extension privileges.
 */
export function buildPrintableHtml(html: string, opts: { paperSize: string; orientation: Orientation; margins: { top: number; right: number; bottom: number; left: number }; copies: number }): string {
  const clean = DOMPurify.sanitize(html, {
    WHOLE_DOCUMENT: true,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'base', 'meta', 'link'],
    FORBID_ATTR: ['srcset', 'action', 'formaction'],
    ADD_TAGS: ['style'],
  });
  const doc = new DOMParser().parseFromString(clean, 'text/html');
  const css = pageCss(parsePaperSize(opts.paperSize), opts.orientation, opts.margins);
  const styles = Array.from(doc.querySelectorAll('style')).map((s) => s.outerHTML).join('');
  const body = doc.body.innerHTML;
  // Copies inside one document because the print dialog's copy count cannot be preset.
  const copies = Array.from({ length: Math.max(1, opts.copies) }, (_, i) =>
    `<section class="xdbp-copy"${i > 0 ? ' style="break-before: page"' : ''}>${body}</section>`,
  ).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style>${styles}</head><body>${copies}</body></html>`;
}

function waitForLoad(frame: HTMLIFrameElement): Promise<void> {
  return new Promise((resolve) => frame.addEventListener('load', () => resolve(), { once: true }));
}

/** Resolves when the print dialog closed (Chrome's print() blocks until then). */
async function printFrame(frame: HTMLIFrameElement, onDialog: () => void): Promise<void> {
  const win = frame.contentWindow;
  if (!win) throw new Error('Print frame has no window');
  win.focus();
  onDialog();
  win.print();
}

export async function printHtml(container: HTMLElement, html: string, onDialog: () => void): Promise<void> {
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', 'allow-same-origin allow-modals');
  frame.className = 'print-frame';
  frame.srcdoc = html;
  const loaded = waitForLoad(frame);
  container.appendChild(frame);
  await loaded;
  await Promise.all(Array.from(frame.contentDocument?.images ?? []).map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; }))));
  await printFrame(frame, onDialog);
}

export async function printPdf(container: HTMLElement, bytes: Uint8Array, onDialog: () => void): Promise<() => void> {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
  const frame = document.createElement('iframe');
  frame.className = 'print-frame';
  frame.src = url;
  const loaded = waitForLoad(frame);
  container.appendChild(frame);
  await loaded;
  // Chrome's PDF viewer needs a moment after load before print() targets the document.
  await new Promise((r) => setTimeout(r, 600));
  await printFrame(frame, onDialog);
  return () => URL.revokeObjectURL(url);
}
