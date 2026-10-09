import type { PrintFormat, PrinterProfile } from '@xdev/shared-types';
import { concatBytes, encodeText } from '@xdev/core';
import type { StoredPayload } from '../storage/job-store';

const ESC = 0x1b;
const GS = 0x1d;

function endsWithCut(bytes: Uint8Array): boolean {
  // GS V is the ESC/POS cut command; only look at the tail so data bytes are not misread.
  const tail = bytes.subarray(Math.max(0, bytes.length - 8));
  for (let i = 0; i < tail.length - 1; i++) if (tail[i] === GS && tail[i + 1] === 0x56) return true;
  return false;
}

/** Selects code page n up front and again after every ESC @, because initialize resets it to the default. */
function withCodePage(bytes: Uint8Array, n: number): Uint8Array {
  const select = [ESC, 0x74, n];
  const out: number[] = [...select];
  for (let i = 0; i < bytes.length; i++) {
    out.push(bytes[i]!);
    if (bytes[i] === ESC && bytes[i + 1] === 0x40) {
      out.push(0x40, ...select);
      i++;
    }
  }
  return Uint8Array.from(out);
}

/** Turns a stored payload into the exact bytes sent to the device, copies included. */
export function buildRawBytes(payload: StoredPayload, format: PrintFormat, profile: PrinterProfile, copies: number): Uint8Array {
  let one = payload.kind === 'bytes' ? payload.bytes : encodeText(payload.text, profile.encoding);
  // Text is encoded by us, so the printer must be told which table to read it with; raw bytes are the app's business.
  if (payload.kind === 'text' && format === 'ESCPOS' && profile.escposCodePage !== undefined) {
    one = withCodePage(one, profile.escposCodePage);
  }
  if (format === 'ESCPOS' && profile.autoCut && !endsWithCut(one)) {
    one = concatBytes([one, Uint8Array.from([0x1b, 0x64, 3, GS, 0x56, 65, 3])]);
  }
  if (copies <= 1) return one;
  return concatBytes(Array.from({ length: copies }, () => one));
}
