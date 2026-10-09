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
    expect(Array.from(encodeText('Đơn–', 'ascii'))).toEqual([68, 111, 110, 0x2d]);
    expect(Array.from(encodeText('Đơn€', 'ascii'))).toEqual([68, 111, 110, 0x3f]);
    expect(new TextDecoder().decode(encodeText('K80 · “A4”…', 'ascii'))).toBe('K80 - "A4"...');
    // latin1 keeps its own '·' (0xB7) and folds only what it cannot hold.
    expect(Array.from(encodeText('·—', 'latin1'))).toEqual([0xb7, 0x2d]);
    expect(new TextDecoder().decode(encodeText('Đơn', 'utf-8'))).toBe('Đơn');
    expect(encodeText('é', 'latin1')).toEqual(Uint8Array.from([0xe9]));
  });

  it('encodes Vietnamese in cp1258 with combining tone bytes, like Windows does', () => {
    const bytes = encodeText('Phở bò, Nguyễn Thị Hương, Đà Nẵng · ệ', 'cp1258');
    // Decoding with the platform's own windows-1258 decoder gives back the same text.
    expect(new TextDecoder('windows-1258').decode(bytes).normalize('NFC')).toBe('Phở bò, Nguyễn Thị Hương, Đà Nẵng · ệ');
    expect(Array.from(encodeText('ế', 'cp1258'))).toEqual([0xea, 0xec]);
    expect(Array.from(encodeText('ợ', 'cp1258'))).toEqual([0xf5, 0xf2]);
    expect(Array.from(encodeText('Ã', 'cp1258'))).toEqual([0x41, 0xde]);
    expect(Array.from(encodeText('đ€', 'cp1258'))).toEqual([0xf0, 0x80]);
    expect(Array.from(encodeText('中', 'cp1258'))).toEqual([0x3f]);
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

  it('selects the code page right after initialize when one is set', () => {
    expect(Array.from(new EscPosBuilder('cp1258', 52).build())).toEqual([0x1b, 0x40, 0x1b, 0x74, 52]);
    expect(Array.from(new EscPosBuilder('cp1258').build())).toEqual([0x1b, 0x40]);
  });

  it('builds a QR model 2 symbol with GS ( k', () => {
    const b = Array.from(new EscPosBuilder().qr('AB', { size: 4, ecc: 'H' }).build());
    expect(b).toEqual([
      0x1b, 0x40,
      0x1d, 0x28, 0x6b, 4, 0, 49, 65, 50, 0,
      0x1d, 0x28, 0x6b, 3, 0, 49, 67, 4,
      0x1d, 0x28, 0x6b, 3, 0, 49, 69, 51,
      0x1d, 0x28, 0x6b, 5, 0, 49, 80, 48, 0x41, 0x42,
      0x1d, 0x28, 0x6b, 3, 0, 49, 81, 48,
      0x0a,
    ]);
    const long = Array.from(new EscPosBuilder().qr('x'.repeat(300)).build());
    expect(long.slice(30, 32)).toEqual([303 & 0xff, 303 >> 8]);
    expect(() => new EscPosBuilder().qr('')).toThrow(RangeError);
    expect(() => new EscPosBuilder().qr('x'.repeat(7090))).toThrow(RangeError);
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

