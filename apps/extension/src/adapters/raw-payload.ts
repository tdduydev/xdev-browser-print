import type { PrintFormat, PrinterProfile } from '@xdev/shared-types';
import { concatBytes, encodeText } from '@xdev/core';
import type { StoredPayload } from '../storage/job-store';

const GS = 0x1d;

function endsWithCut(bytes: Uint8Array): boolean {
  // GS V is the ESC/POS cut command; only look at the tail so data bytes are not misread.
  const tail = bytes.subarray(Math.max(0, bytes.length - 8));
  for (let i = 0; i < tail.length - 1; i++) if (tail[i] === GS && tail[i + 1] === 0x56) return true;
  return false;
}

/** Turns a stored payload into the exact bytes sent to the device, copies included. */
export function buildRawBytes(payload: StoredPayload, format: PrintFormat, profile: PrinterProfile, copies: number): Uint8Array {
  let one = payload.kind === 'bytes' ? payload.bytes : encodeText(payload.text, profile.encoding);
  if (format === 'ESCPOS' && profile.autoCut && !endsWithCut(one)) {
    one = concatBytes([one, Uint8Array.from([0x1b, 0x64, 3, GS, 0x56, 65, 3])]);
  }
  if (copies <= 1) return one;
  return concatBytes(Array.from({ length: copies }, () => one));
}
