import type { PrinterProfile, PrintConfig } from '@xdev/shared-types';
import { defaultConfig } from '../src';

export function profile(over: Partial<PrinterProfile> = {}): PrinterProfile {
  return {
    id: 'printer-a5',
    name: 'Máy in đơn thuốc',
    adapter: 'browser',
    category: 'A5',
    paperSize: 'A5',
    orientation: 'portrait',
    copies: 1,
    marginsMm: { top: 8, right: 8, bottom: 8, left: 8 },
    encoding: 'utf-8',
    autoCut: false,
    createdAt: 1,
    updatedAt: 1,
    ...over,
  };
}

export const k80 = (over: Partial<PrinterProfile> = {}) =>
  profile({ id: 'printer-k80', name: 'Máy in hoá đơn', adapter: 'webusb', category: 'K80', paperSize: 'K80', encoding: 'ascii', autoCut: true, device: { kind: 'usb', vendorId: 0x0416, productId: 0x5011 }, ...over });

export const label = (over: Partial<PrinterProfile> = {}) =>
  profile({
    id: 'printer-barcode',
    name: 'Máy in tem',
    adapter: 'webserial',
    category: 'BARCODE',
    paperSize: '50x30',
    barcodeDensity: 8,
    device: { kind: 'serial', usbVendorId: 0x0a5f, usbProductId: 0x0001 },
    serial: { baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' },
    ...over,
  });

export function sampleConfig(): PrintConfig {
  const c = defaultConfig();
  c.profiles = [profile(), k80(), label()];
  c.mappings = {
    PRESCRIPTION: { documentType: 'PRESCRIPTION', printerId: 'printer-a5', updatedAt: 1 },
    INVOICE: { documentType: 'INVOICE', printerId: 'printer-k80', copies: 2, updatedAt: 1 },
    PATIENT_BARCODE: { documentType: 'PATIENT_BARCODE', printerId: 'printer-barcode', updatedAt: 1 },
  };
  return c;
}
