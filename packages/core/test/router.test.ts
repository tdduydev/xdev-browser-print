import { describe, expect, it } from 'vitest';
import { resolveRoute } from '../src';
import { profile, sampleConfig } from './fixtures';

describe('resolveRoute', () => {
  it('uses the mapping of the document type', () => {
    const r = resolveRoute(sampleConfig(), { documentType: 'INVOICE', format: 'ESCPOS' });
    expect(r.profile.id).toBe('printer-k80');
    expect(r.copies).toBe(2);
  });

  it('request copies override mapping and profile copies', () => {
    expect(resolveRoute(sampleConfig(), { documentType: 'INVOICE', format: 'ESCPOS', copies: 5 }).copies).toBe(5);
  });

  it('honours an explicit printerId', () => {
    const r = resolveRoute(sampleConfig(), { documentType: 'INVOICE', format: 'ZPL', printerId: 'printer-barcode' });
    expect(r.profile.id).toBe('printer-barcode');
    expect(r.mapping).toBeUndefined();
    expect(r.copies).toBe(1);
  });

  it('falls back to a compatible default profile', () => {
    const c = sampleConfig();
    c.profiles[0] = profile({ isDefault: true });
    expect(resolveRoute(c, { documentType: 'REPORT', format: 'PDF' }).profile.id).toBe('printer-a5');
  });

  it('fails with MAPPING_NOT_FOUND when nothing matches', () => {
    expect(() => resolveRoute(sampleConfig(), { documentType: 'REPORT', format: 'PDF' })).toThrowError(expect.objectContaining({ code: 'MAPPING_NOT_FOUND' }));
  });

  it('never routes RAW data to the browser adapter or PDF to a RAW device', () => {
    expect(() => resolveRoute(sampleConfig(), { documentType: 'PRESCRIPTION', format: 'ZPL' })).toThrowError(expect.objectContaining({ code: 'UNSUPPORTED_FORMAT' }));
    expect(() => resolveRoute(sampleConfig(), { documentType: 'INVOICE', format: 'PDF' })).toThrowError(expect.objectContaining({ code: 'UNSUPPORTED_FORMAT' }));
  });

  it('reports a dangling explicit printerId', () => {
    expect(() => resolveRoute(sampleConfig(), { documentType: 'INVOICE', format: 'ESCPOS', printerId: 'gone' })).toThrowError(expect.objectContaining({ code: 'PROFILE_NOT_FOUND' }));
  });

  it('applies mapping paper/orientation overrides', () => {
    const c = sampleConfig();
    c.mappings.PRESCRIPTION = { ...c.mappings.PRESCRIPTION!, paperSize: 'A4', orientation: 'landscape' };
    const r = resolveRoute(c, { documentType: 'PRESCRIPTION', format: 'HTML' });
    expect(r).toMatchObject({ paperSize: 'A4', orientation: 'landscape' });
  });
});
