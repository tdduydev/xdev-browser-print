import type { PrintParams } from '@xdev/shared-types';
import { PRINT_FORMATS } from '@xdev/shared-types';
import { base64DecodedLength, isBase64 } from './base64';
import { validateDocumentType } from './config';
import { PrintError } from './errors';

const IDEMPOTENCY_RE = /^[A-Za-z0-9_.:-]{8,128}$/;

export function validatePrintParams(p: unknown, maxBytes: number): PrintParams & { sizeBytes: number } {
  if (!p || typeof p !== 'object') throw new PrintError('INVALID_REQUEST', 'params must be an object');
  const v = p as PrintParams;
  validateDocumentType(v.documentType);
  if (!PRINT_FORMATS.includes(v.format)) throw new PrintError('UNSUPPORTED_FORMAT', 'Unknown format', { format: v.format });
  if (typeof v.idempotencyKey !== 'string' || !IDEMPOTENCY_RE.test(v.idempotencyKey)) {
    throw new PrintError('INVALID_REQUEST', 'idempotencyKey must match ^[A-Za-z0-9_.:-]{8,128}$');
  }
  if (typeof v.data !== 'string' || v.data.length === 0) throw new PrintError('INVALID_REQUEST', 'data is required');
  if (v.dataEncoding !== 'base64' && v.dataEncoding !== 'text') throw new PrintError('INVALID_REQUEST', 'Invalid dataEncoding');
  if ((v.format === 'PDF' || v.format === 'RAW') && v.dataEncoding !== 'base64') {
    throw new PrintError('INVALID_REQUEST', `${v.format} data must be base64`);
  }
  let sizeBytes: number;
  if (v.dataEncoding === 'base64') {
    if (!isBase64(v.data)) throw new PrintError('INVALID_REQUEST', 'data is not valid base64');
    sizeBytes = base64DecodedLength(v.data);
  } else {
    sizeBytes = new TextEncoder().encode(v.data).length;
  }
  if (sizeBytes > maxBytes) {
    throw new PrintError('PAYLOAD_TOO_LARGE', `Payload exceeds ${maxBytes} bytes`, { sizeBytes, maxBytes });
  }
  if (v.copies !== undefined && (!Number.isInteger(v.copies) || v.copies < 1 || v.copies > 20)) {
    throw new PrintError('INVALID_REQUEST', 'copies must be an integer 1..20');
  }
  if (v.printerId !== undefined && typeof v.printerId !== 'string') throw new PrintError('INVALID_REQUEST', 'Invalid printerId');
  if (v.title !== undefined && (typeof v.title !== 'string' || v.title.length > 200)) throw new PrintError('INVALID_REQUEST', 'Invalid title');
  return { ...v, sizeBytes };
}

/** PDF magic check so arbitrary bytes are not fed to Chrome's PDF viewer under a PDF label. */
export function looksLikePdf(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}
