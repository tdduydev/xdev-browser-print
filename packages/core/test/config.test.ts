import { describe, expect, it } from 'vitest';
import { defaultConfig, deleteMapping, deleteProfile, normalizeConfig, saveMapping, upsertProfile, validateDocumentType, validateProfile } from '../src';
import { k80, label, profile, sampleConfig } from './fixtures';

describe('validateProfile', () => {
  it('accepts the three reference profiles', () => {
    for (const p of [profile(), k80(), label()]) expect(validateProfile(p)).toBe(p);
  });

  it.each([
    ['id', { id: 'Bad Id!' }],
    ['name', { name: ' ' }],
    ['adapter', { adapter: 'cloud' as never }],
    ['category', { category: 'A3' as never }],
    ['paperSize', { paperSize: 'huge' }],
    ['copies', { copies: 0 }],
    ['copies', { copies: 21 }],
    ['marginsMm', { marginsMm: { top: -1, right: 0, bottom: 0, left: 0 } }],
    ['encoding', { encoding: 'utf-16' as never }],
    ['barcodeDensity', { barcodeDensity: 10 as never }],
    ['escposCodePage', { escposCodePage: 256 }],
    ['escposCodePage', { escposCodePage: 1.5 }],
  ])('rejects invalid %s', (field, over) => {
    expect(() => validateProfile(profile(over))).toThrowError(expect.objectContaining({ code: 'INVALID_REQUEST', details: { field } }));
  });

  it('requires a device for RAW adapters and serial options for webserial', () => {
    expect(() => validateProfile(k80({ device: undefined }))).toThrow();
    expect(() => validateProfile(label({ serial: undefined }))).toThrow();
    expect(() => validateProfile(label({ serial: { baudRate: 10, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' } }))).toThrow();
  });

  it('accepts a custom size via width when paperSize is not a known name', () => {
    expect(() => validateProfile(profile({ paperSize: 'custom', paperWidthMm: 100 }))).not.toThrow();
  });
});

describe('upsertProfile', () => {
  it('keeps one default per category', () => {
    let c = defaultConfig();
    c = upsertProfile(c, profile({ id: 'a', isDefault: true }));
    c = upsertProfile(c, profile({ id: 'b', isDefault: true }));
    c = upsertProfile(c, k80({ isDefault: true }));
    expect(c.profiles.filter((p) => p.isDefault).map((p) => p.id).sort()).toEqual(['b', 'printer-k80']);
  });

  it('preserves createdAt when updating', () => {
    let c = upsertProfile(defaultConfig(), profile());
    const created = c.profiles[0]!.createdAt;
    c = upsertProfile(c, profile({ name: 'Renamed' }));
    expect(c.profiles).toHaveLength(1);
    expect(c.profiles[0]!.createdAt).toBe(created);
    expect(c.profiles[0]!.name).toBe('Renamed');
  });
});

describe('mappings', () => {
  it('refuses to delete a profile that is still mapped', () => {
    expect(() => deleteProfile(sampleConfig(), 'printer-a5')).toThrowError(expect.objectContaining({ details: { documentTypes: ['PRESCRIPTION'] } }));
    const c = deleteMapping(sampleConfig(), 'PRESCRIPTION');
    expect(deleteProfile(c, 'printer-a5').profiles.map((p) => p.id)).not.toContain('printer-a5');
  });

  it('saves a mapping with overrides', () => {
    const { config, mapping } = saveMapping(sampleConfig(), { documentType: 'REPORT', printerId: 'printer-a5', paperSize: 'A4', copies: 2, orientation: 'landscape' });
    expect(mapping).toMatchObject({ documentType: 'REPORT', printerId: 'printer-a5', paperSize: 'A4', copies: 2, orientation: 'landscape' });
    expect(config.mappings.REPORT).toEqual(mapping);
  });

  it.each([
    [{ documentType: 'bad type', printerId: 'printer-a5' }, 'INVALID_REQUEST'],
    [{ documentType: 'X', printerId: 'nope' }, 'PROFILE_NOT_FOUND'],
    [{ documentType: 'X', printerId: 'printer-a5', copies: 0 }, 'INVALID_REQUEST'],
    [{ documentType: 'X', printerId: 'printer-a5', paperSize: 'B9' }, 'INVALID_REQUEST'],
  ])('rejects %o', (params, code) => {
    expect(() => saveMapping(sampleConfig(), params)).toThrowError(expect.objectContaining({ code }));
  });

  it('validates document type names', () => {
    expect(validateDocumentType('PATIENT_BARCODE')).toBe('PATIENT_BARCODE');
    expect(() => validateDocumentType('patient')).toThrow();
    expect(() => validateDocumentType('A'.repeat(65))).toThrow();
  });
});

describe('normalizeConfig', () => {
  it('returns defaults for garbage', () => {
    expect(normalizeConfig(null)).toEqual(defaultConfig());
    expect(normalizeConfig('x')).toEqual(defaultConfig());
  });

  it('drops invalid profiles and mappings pointing at them, keeps settings overrides', () => {
    const raw = { ...sampleConfig(), settings: { language: 'en' } };
    raw.profiles = [...raw.profiles.filter((p) => p.id !== 'printer-k80'), { id: 'broken' } as never];
    const c = normalizeConfig(raw);
    expect(c.profiles.map((p) => p.id)).toEqual(['printer-a5', 'printer-barcode']);
    expect(Object.keys(c.mappings).sort()).toEqual(['PATIENT_BARCODE', 'PRESCRIPTION']);
    expect(c.settings.language).toBe('en');
    expect(c.settings.maxJobBytes).toBe(defaultConfig().settings.maxJobBytes);
  });
});
