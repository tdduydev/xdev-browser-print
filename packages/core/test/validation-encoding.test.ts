import { describe, expect, it } from 'vitest';
import {
  EscPosBuilder,
  base64DecodedLength,
  base64ToBytes,
  buildTextPdf,
  bytesToBase64,
  encodeText,
  looksLikePdf,
  pageCss,
  parsePaperSize,
  stripDiacritics,
  testReceipt,
  testTspl,
  testZpl,
  validatePrintParams,
} from '../src';

const base = { documentType: 'PRESCRIPTION', format: 'HTML' as const, data: '<p>x</p>', dataEncoding: 'text' as const, idempotencyKey: 'idem-12345678' };

describe('validatePrintParams', () => {
  it('accepts valid text and base64 payloads and reports decoded size', () => {
    expect(validatePrintParams(base, 1000).sizeBytes).toBe(8);
    const pdf = bytesToBase64(new Uint8Array(10));
    expect(validatePrintParams({ ...base, format: 'PDF', data: pdf, dataEncoding: 'base64' }, 1000).sizeBytes).toBe(10);
  });

  it.each([
    [{ format: 'DOCX' }, 'UNSUPPORTED_FORMAT'],
    [{ idempotencyKey: 'short' }, 'INVALID_REQUEST'],
    [{ data: '' }, 'INVALID_REQUEST'],
    [{ format: 'PDF', dataEncoding: 'text' }, 'INVALID_REQUEST'],
    [{ dataEncoding: 'base64', data: '***' }, 'INVALID_REQUEST'],
    [{ copies: 0 }, 'INVALID_REQUEST'],
    [{ documentType: 'lower' }, 'INVALID_REQUEST'],
    [{ data: 'x'.repeat(1001) }, 'PAYLOAD_TOO_LARGE'],
  ])('rejects %o', (over, code) => {
    expect(() => validatePrintParams({ ...base, ...over } as never, 1000)).toThrowError(expect.objectContaining({ code }));
  });

  it('counts UTF-8 bytes for text payloads', () => {
    expect(validatePrintParams({ ...base, data: 'Đơn' }, 1000).sizeBytes).toBe(5);
  });
});

describe('base64', () => {
  it('round-trips binary data larger than one chunk', () => {
    const bytes = Uint8Array.from({ length: 100_000 }, (_, i) => i % 256);
    const b64 = bytesToBase64(bytes);
    expect(base64DecodedLength(b64)).toBe(bytes.length);
    expect(base64ToBytes(b64)).toEqual(bytes);
  });
});

describe('text encoding', () => {
  it('folds Vietnamese diacritics for ascii printers', () => {
    expect(stripDiacritics('Đơn thuốc – Hóa đơn')).toBe('Don thuoc – Hoa don');
    expect(Array.from(encodeText('Đơn–', 'ascii'))).toEqual([68, 111, 110, 0x3f]);
    expect(new TextDecoder().decode(encodeText('Đơn', 'utf-8'))).toBe('Đơn');
    expect(encodeText('é', 'latin1')).toEqual(Uint8Array.from([0xe9]));
  });
});

describe('ESC/POS', () => {
  it('starts with initialize and ends with a cut when requested', () => {
    const r = testReceipt({ encoding: 'ascii', widthChars: 48, autoCut: true, title: 'T', now: new Date(0) });
    expect(Array.from(r.subarray(0, 2))).toEqual([0x1b, 0x40]);
    expect(Array.from(r.subarray(-4))).toEqual([0x1d, 0x56, 65, 3]);
    const noCut = testReceipt({ encoding: 'ascii', widthChars: 32, autoCut: false, title: 'T', now: new Date(0) });
    expect(Array.from(noCut.subarray(-4))).not.toEqual([0x1d, 0x56, 65, 3]);
  });

  it('encodes CODE128 barcodes with a length prefix', () => {
    const b = new EscPosBuilder('ascii').barcode128('AB').build();
    const i = b.indexOf(73);
    expect(b[i + 1]).toBe(4); // "{BAB"
  });
});

describe('labels', () => {
  it('builds ZPL sized in dots and strips control characters from text', () => {
    const z = testZpl({ widthMm: 50, heightMm: 30, dpmm: 8, text: 'a^b~c' });
    expect(z).toMatch(/^\^XA/);
    expect(z).toContain('^PW400');
    expect(z).toContain('^LL240');
    expect(z).toContain('a b c');
    expect(z.trim().endsWith('^XZ')).toBe(true);
  });

  it('builds TSPL with size and escaped quotes', () => {
    const t = testTspl({ widthMm: 50, heightMm: 30, text: 'say "hi"' });
    expect(t).toContain('SIZE 50 mm, 30 mm');
    expect(t).toContain("say 'hi'");
    expect(t).toContain('PRINT 1,1');
  });
});

describe('paper and PDF', () => {
  it('parses named and label sizes', () => {
    expect(parsePaperSize('a5')).toEqual({ widthMm: 148, heightMm: 210 });
    expect(parsePaperSize('K80')).toEqual({ widthMm: 80 });
    expect(parsePaperSize('50x30')).toEqual({ widthMm: 50, heightMm: 30 });
    expect(parsePaperSize('B9')).toBeNull();
  });

  it('emits @page CSS honouring orientation and roll paper', () => {
    const m = { top: 1, right: 2, bottom: 3, left: 4 };
    expect(pageCss({ widthMm: 148, heightMm: 210 }, 'landscape', m)).toBe('@page { size: 210mm 148mm; margin: 1mm 2mm 3mm 4mm; }');
    expect(pageCss({ widthMm: 80 }, 'portrait', m)).toContain('size: 80mm auto');
  });

  it('builds a structurally valid PDF', () => {
    const pdf = buildTextPdf({ widthMm: 148, heightMm: 210, lines: ['Xin chào (test)'] });
    expect(looksLikePdf(pdf)).toBe(true);
    const text = new TextDecoder().decode(pdf);
    expect(text).toContain('/MediaBox [0 0 420 595]');
    expect(text).toContain('(Xin chao \\(test\\)) Tj');
    const xref = Number(/startxref\n(\d+)/.exec(text)![1]);
    expect(text.slice(xref, xref + 4)).toBe('xref');
    expect(looksLikePdf(new Uint8Array([1, 2, 3, 4, 5]))).toBe(false);
  });
});
