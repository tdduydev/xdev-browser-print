import type {
  DocumentMapping,
  ExtensionSettings,
  PrintConfig,
  PrinterProfile,
  SaveMappingParams,
} from '@xdev/shared-types';
import { ADAPTER_TYPES, PRINTER_CATEGORIES, TEXT_ENCODINGS } from '@xdev/shared-types';
import { PrintError } from './errors';
import { parsePaperSize } from './paper';

export const DEFAULT_SETTINGS: ExtensionSettings = {
  language: 'vi',
  maxJobBytes: 15 * 1024 * 1024,
  rateLimitJobs: 20,
  rateLimitWindowMs: 60_000,
  historyLimit: 500,
  allowSiteConfigure: true,
  allowLocalhost: true,
};

export function defaultConfig(): PrintConfig {
  return { schemaVersion: 1, profiles: [], mappings: {}, settings: { ...DEFAULT_SETTINGS } };
}

/** Tolerates partial / older stored data so a bad write never bricks the extension. */
export function normalizeConfig(raw: unknown): PrintConfig {
  const base = defaultConfig();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<PrintConfig>;
  const profiles = Array.isArray(r.profiles) ? r.profiles.filter((p) => safeValidateProfile(p)) : [];
  const ids = new Set(profiles.map((p) => p.id));
  const mappings: Record<string, DocumentMapping> = {};
  if (r.mappings && typeof r.mappings === 'object') {
    for (const [k, m] of Object.entries(r.mappings)) {
      if (m && typeof m === 'object' && ids.has((m as DocumentMapping).printerId) && DOC_TYPE_RE.test(k)) {
        mappings[k] = { ...(m as DocumentMapping), documentType: k };
      }
    }
  }
  return {
    schemaVersion: 1,
    profiles,
    mappings,
    settings: { ...base.settings, ...(r.settings ?? {}) },
  };
}

export const DOC_TYPE_RE = /^[A-Z][A-Z0-9_]{0,63}$/;
const PROFILE_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export function validateDocumentType(t: unknown): string {
  if (typeof t !== 'string' || !DOC_TYPE_RE.test(t)) {
    throw new PrintError('INVALID_REQUEST', 'documentType must match ^[A-Z][A-Z0-9_]{0,63}$');
  }
  return t;
}

function safeValidateProfile(p: unknown): p is PrinterProfile {
  try {
    validateProfile(p);
    return true;
  } catch {
    return false;
  }
}

export function validateProfile(p: unknown): PrinterProfile {
  if (!p || typeof p !== 'object') throw new PrintError('INVALID_REQUEST', 'Profile must be an object');
  const v = p as PrinterProfile;
  const fail = (field: string): never => {
    throw new PrintError('INVALID_REQUEST', `Invalid profile field: ${field}`, { field });
  };
  if (typeof v.id !== 'string' || !PROFILE_ID_RE.test(v.id)) fail('id');
  if (typeof v.name !== 'string' || !v.name.trim() || v.name.length > 100) fail('name');
  if (!ADAPTER_TYPES.includes(v.adapter)) fail('adapter');
  if (!PRINTER_CATEGORIES.includes(v.category)) fail('category');
  if (typeof v.paperSize !== 'string' || (!parsePaperSize(v.paperSize) && !v.paperWidthMm)) fail('paperSize');
  if (v.paperWidthMm !== undefined && !(v.paperWidthMm > 0 && v.paperWidthMm <= 1000)) fail('paperWidthMm');
  if (v.paperHeightMm !== undefined && !(v.paperHeightMm > 0 && v.paperHeightMm <= 3000)) fail('paperHeightMm');
  if (v.orientation !== 'portrait' && v.orientation !== 'landscape') fail('orientation');
  if (!Number.isInteger(v.copies) || v.copies < 1 || v.copies > 20) fail('copies');
  if (!v.marginsMm || ['top', 'right', 'bottom', 'left'].some((k) => {
    const n = (v.marginsMm as unknown as Record<string, unknown>)[k];
    return typeof n !== 'number' || n < 0 || n > 100;
  })) fail('marginsMm');
  if (!TEXT_ENCODINGS.includes(v.encoding)) fail('encoding');
  if (v.escposCodePage !== undefined && !(Number.isInteger(v.escposCodePage) && v.escposCodePage >= 0 && v.escposCodePage <= 255)) fail('escposCodePage');
  if (typeof v.autoCut !== 'boolean') fail('autoCut');
  if (v.barcodeDensity !== undefined && ![6, 8, 12, 24].includes(v.barcodeDensity)) fail('barcodeDensity');
  if (v.adapter === 'webusb' && v.device?.kind !== 'usb') fail('device');
  if (v.adapter === 'webserial') {
    if (v.device?.kind !== 'serial') fail('device');
    const s = v.serial;
    if (!s || !Number.isInteger(s.baudRate) || s.baudRate < 300 || s.baudRate > 4_000_000) fail('serial.baudRate');
  }
  return v;
}

export function upsertProfile(config: PrintConfig, profile: PrinterProfile): PrintConfig {
  validateProfile(profile);
  const now = Date.now();
  const existing = config.profiles.find((p) => p.id === profile.id);
  const next: PrinterProfile = { ...profile, createdAt: existing?.createdAt ?? now, updatedAt: now };
  let profiles = existing ? config.profiles.map((p) => (p.id === profile.id ? next : p)) : [...config.profiles, next];
  // Only one default per category, so "default" stays unambiguous.
  if (next.isDefault) {
    profiles = profiles.map((p) => (p.id !== next.id && p.category === next.category ? { ...p, isDefault: false } : p));
  }
  return { ...config, profiles };
}

export function deleteProfile(config: PrintConfig, id: string): PrintConfig {
  const used = Object.values(config.mappings).filter((m) => m.printerId === id).map((m) => m.documentType);
  if (used.length) {
    throw new PrintError('INVALID_REQUEST', 'Profile is still mapped to document types', { documentTypes: used });
  }
  return { ...config, profiles: config.profiles.filter((p) => p.id !== id) };
}

export function saveMapping(config: PrintConfig, params: SaveMappingParams): { config: PrintConfig; mapping: DocumentMapping } {
  const documentType = validateDocumentType(params.documentType);
  if (!config.profiles.some((p) => p.id === params.printerId)) {
    throw new PrintError('PROFILE_NOT_FOUND', 'Printer profile does not exist', { printerId: params.printerId });
  }
  if (params.copies !== undefined && (!Number.isInteger(params.copies) || params.copies < 1 || params.copies > 20)) {
    throw new PrintError('INVALID_REQUEST', 'copies must be an integer 1..20');
  }
  if (params.paperSize !== undefined && !parsePaperSize(params.paperSize)) {
    throw new PrintError('INVALID_REQUEST', 'Unknown paperSize');
  }
  if (params.orientation !== undefined && params.orientation !== 'portrait' && params.orientation !== 'landscape') {
    throw new PrintError('INVALID_REQUEST', 'Invalid orientation');
  }
  const mapping: DocumentMapping = {
    documentType,
    printerId: params.printerId,
    ...(params.paperSize !== undefined && { paperSize: params.paperSize }),
    ...(params.copies !== undefined && { copies: params.copies }),
    ...(params.orientation !== undefined && { orientation: params.orientation }),
    updatedAt: Date.now(),
  };
  return { config: { ...config, mappings: { ...config.mappings, [documentType]: mapping } }, mapping };
}

export function deleteMapping(config: PrintConfig, documentType: string): PrintConfig {
  const mappings = { ...config.mappings };
  delete mappings[documentType];
  return { ...config, mappings };
}
