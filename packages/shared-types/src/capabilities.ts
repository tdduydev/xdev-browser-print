import type { AdapterType, PrintFormat } from './config';

export type SupportLevel = 'supported' | 'requires-user-action' | 'unsupported';

export interface AdapterCapability {
  adapter: AdapterType;
  available: boolean;
  formats: PrintFormat[];
  /** Whether a job can reach the printer without any dialog. */
  silent: boolean;
  /** Can a specific OS printer be targeted? */
  selectPrinter: boolean;
  notes: string[];
}

export interface Capabilities {
  extensionVersion: string;
  protocolVersion: number;
  platform: string;
  adapters: AdapterCapability[];
  /** chrome.printing only exists on ChromeOS. */
  chromePrintingApi: boolean;
  /** Chrome cannot enumerate OS printers outside ChromeOS: getPrinters() returns profiles. */
  osPrinterEnumeration: boolean;
}

export interface PrinterCapabilities {
  formats: PrintFormat[];
  silent: boolean;
  selectPrinter: boolean;
}

export interface PrinterStatus {
  ready: boolean;
  reason?: string;
}
