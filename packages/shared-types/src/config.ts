export const PRINTER_CATEGORIES = ['A4', 'A5', 'K80', 'K58', 'BARCODE'] as const;
export type PrinterCategory = (typeof PRINTER_CATEGORIES)[number];

export const ADAPTER_TYPES = ['browser', 'webusb', 'webserial'] as const;
export type AdapterType = (typeof ADAPTER_TYPES)[number];

/** Raw formats are sent byte-for-byte to the device; PDF/HTML go through Chrome's print flow. */
export const PRINT_FORMATS = ['PDF', 'HTML', 'ESCPOS', 'ZPL', 'TSPL', 'RAW'] as const;
export type PrintFormat = (typeof PRINT_FORMATS)[number];
export const DOCUMENT_FORMATS: readonly PrintFormat[] = ['PDF', 'HTML'];
export const RAW_FORMATS: readonly PrintFormat[] = ['ESCPOS', 'ZPL', 'TSPL', 'RAW'];

export const TEXT_ENCODINGS = ['utf-8', 'ascii', 'latin1'] as const;
export type TextEncoding = (typeof TEXT_ENCODINGS)[number];

export type Orientation = 'portrait' | 'landscape';

export interface Margins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Identifies a WebUSB device the user already granted to the extension. */
export interface UsbDeviceSelector {
  kind: 'usb';
  vendorId: number;
  productId: number;
  serialNumber?: string;
}

/** Identifies a WebSerial port the user already granted to the extension. */
export interface SerialPortSelector {
  kind: 'serial';
  usbVendorId?: number;
  usbProductId?: number;
  /** Disambiguates several granted ports with identical USB ids (order of getPorts()). */
  index?: number;
}

export type DeviceSelector = UsbDeviceSelector | SerialPortSelector;

export interface SerialOptions {
  baudRate: number;
  dataBits: 7 | 8;
  stopBits: 1 | 2;
  parity: 'none' | 'even' | 'odd';
  flowControl: 'none' | 'hardware';
}

export interface PrinterProfile {
  id: string;
  name: string;
  adapter: AdapterType;
  category: PrinterCategory;
  /** A4, A5, K80, K58 or a label size such as "50x30" (mm). */
  paperSize: string;
  paperWidthMm?: number;
  paperHeightMm?: number;
  orientation: Orientation;
  copies: number;
  marginsMm: Margins;
  encoding: TextEncoding;
  autoCut: boolean;
  /** Dots per mm for label printers (8 = 203dpi, 12 = 300dpi, 24 = 600dpi). */
  barcodeDensity?: 6 | 8 | 12 | 24;
  device?: DeviceSelector;
  serial?: SerialOptions;
  isDefault?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface DocumentMapping {
  documentType: string;
  printerId: string;
  /** Overrides on top of the profile. */
  paperSize?: string;
  copies?: number;
  orientation?: Orientation;
  updatedAt: number;
}

export type Language = 'vi' | 'en';

export interface ExtensionSettings {
  language: Language;
  /** Max decoded payload size per job, bytes. */
  maxJobBytes: number;
  /** Token bucket: max jobs per window per origin. */
  rateLimitJobs: number;
  rateLimitWindowMs: number;
  /** Keep this many history entries (metadata only). */
  historyLimit: number;
  /** If false, sites may never change mappings even with the configure scope. */
  allowSiteConfigure: boolean;
  /** Allow http://localhost / 127.0.0.1 sites (development). */
  allowLocalhost: boolean;
}

export interface PrintConfig {
  schemaVersion: 1;
  profiles: PrinterProfile[];
  mappings: Record<string, DocumentMapping>;
  settings: ExtensionSettings;
}

export const SCOPES = ['read', 'print', 'configure'] as const;
export type Scope = (typeof SCOPES)[number];

export interface SiteGrant {
  /** Exact origin, e.g. https://his.example.vn. Wildcards are rejected. */
  origin: string;
  scopes: Scope[];
  grantedAt: number;
  label?: string;
  /** Show an approval window for every print job from this site. */
  confirmEachJob?: boolean;
}

export const WELL_KNOWN_DOCUMENT_TYPES = [
  'PRESCRIPTION',
  'INVOICE',
  'RECEIPT',
  'PATIENT_BARCODE',
  'SPECIMEN_LABEL',
  'REPORT',
] as const;
