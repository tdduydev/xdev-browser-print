export { XDevBrowserPrint, SDK_VERSION } from './client';
export type { PrintData, PrintOptions, StatusListener, XDevBrowserPrintOptions } from './client';
export {
  BrowserPrintError,
  BrowserPrintTimeoutError,
  NotInstalledError,
  PermissionError,
  PrintJobError,
  UnsupportedCapabilityError,
} from './errors';
// Lets apps build ESC/POS bytes (text, barcode, QR, code page) and send them as base64.
export { EscPosBuilder } from '@xdev/core';
export type { QrOptions } from '@xdev/core';
export type {
  AdapterType,
  Capabilities,
  ConnectResult,
  DocumentMapping,
  ErrorCode,
  ExtensionStatus,
  JobState,
  PrintFormat,
  PrinterCategory,
  PublicJobStatus,
  PublicPrinter,
  SaveMappingParams,
  Scope,
  TextEncoding,
} from '@xdev/shared-types';
