import type { DeviceSelector, PrinterCategory, PrinterProfile } from '@xdev/shared-types';

/** Page-side WebUSB / Web Serial helpers (permission prompts need a user gesture in a page). */
interface DeviceEvents {
  addEventListener(type: 'connect' | 'disconnect', fn: () => void): void;
  removeEventListener(type: 'connect' | 'disconnect', fn: () => void): void;
}
type UsbNav = Navigator & {
  usb?: DeviceEvents & { getDevices(): Promise<USBDeviceInfo[]>; requestDevice(o: { filters: object[] }): Promise<USBDeviceInfo> };
  serial?: DeviceEvents & { getPorts(): Promise<SerialPortInfo[]>; requestPort(o?: object): Promise<SerialPortInfo> };
};
interface USBDeviceInfo {
  vendorId: number;
  productId: number;
  serialNumber?: string | null;
  productName?: string | null;
  manufacturerName?: string | null;
  forget?: () => Promise<void>;
}
interface SerialPortInfo {
  getInfo(): { usbVendorId?: number; usbProductId?: number };
  forget?: () => Promise<void>;
}

export interface GrantedDevice {
  key: string;
  label: string;
  selector: DeviceSelector;
  /** Best guess from the USB ids and product name; the user can change it on the profile. */
  category: PrinterCategory;
  forget?: () => Promise<void>;
}

const nav = () => navigator as UsbNav;
export const hasUsb = () => !!nav().usb;
export const hasSerial = () => !!nav().serial;

const hex = (n?: number) => (n === undefined ? '????' : n.toString(16).padStart(4, '0'));

export async function listUsb(): Promise<GrantedDevice[]> {
  if (!nav().usb) return [];
  return (await nav().usb!.getDevices()).map((d) => ({
    key: `usb:${hex(d.vendorId)}:${hex(d.productId)}:${d.serialNumber ?? ''}`,
    label: `${d.manufacturerName ?? ''} ${d.productName ?? 'USB device'} (${hex(d.vendorId)}:${hex(d.productId)}${d.serialNumber ? ` #${d.serialNumber}` : ''})`.trim(),
    selector: { kind: 'usb', vendorId: d.vendorId, productId: d.productId, ...(d.serialNumber && { serialNumber: d.serialNumber }) },
    category: guessCategory(d.vendorId, d.productName),
    ...(d.forget && { forget: () => d.forget!() }),
  }));
}

export async function listSerial(): Promise<GrantedDevice[]> {
  if (!nav().serial) return [];
  const ports = await nav().serial!.getPorts();
  const seen = new Map<string, number>();
  return ports.map((p) => {
    const info = p.getInfo();
    const id = `${hex(info.usbVendorId)}:${hex(info.usbProductId)}`;
    const index = seen.get(id) ?? 0;
    seen.set(id, index + 1);
    return {
      key: `serial:${id}:${index}`,
      label: info.usbVendorId !== undefined ? `Serial ${id}${index ? ` (#${index + 1})` : ''}` : `Serial port #${index + 1}`,
      selector: {
        kind: 'serial',
        ...(info.usbVendorId !== undefined && { usbVendorId: info.usbVendorId }),
        ...(info.usbProductId !== undefined && { usbProductId: info.usbProductId }),
        index,
      },
      category: guessCategory(info.usbVendorId),
      ...(p.forget && { forget: () => p.forget!() }),
    };
  });
}

// Chrome cannot list devices the user has not picked, so "detecting" a printer means narrowing the chooser to
// devices that look like one: the USB printer class plus vendors whose receipt/label printers use a vendor class.
const LABEL_VENDORS = [0x0a5f /* Zebra */, 0x1203 /* TSC */, 0x195f /* Godex */];
const RECEIPT_VENDORS = [
  0x04b8 /* Epson */, 0x0519 /* Star */, 0x1504 /* Bixolon */, 0x154f /* SNBC */, 0x0dd4 /* Custom */,
  0x0fe6 /* Xprinter, Rongta */, 0x0416 /* Winbond-based POS */, 0x0483 /* STM-based POS */, 0x28e9 /* GD32-based POS */,
];
const USB_PRINTER_CLASS = 7;
export const PRINTER_FILTERS = [{ classCode: USB_PRINTER_CLASS }, ...[...RECEIPT_VENDORS, ...LABEL_VENDORS].map((vendorId) => ({ vendorId }))];

export function guessCategory(vendorId?: number, productName?: string | null): PrinterCategory {
  if ((vendorId !== undefined && LABEL_VENDORS.includes(vendorId)) || /label|barcode|zpl|tspl/i.test(productName ?? '')) return 'BARCODE';
  return 'K80';
}

/** printersOnly narrows the chooser; the full list stays one click away for printers we do not know. */
export async function requestUsb(printersOnly = false): Promise<void> {
  await nav().usb?.requestDevice({ filters: printersOnly ? PRINTER_FILTERS : [] });
}

export async function requestSerial(): Promise<void> {
  await nav().serial?.requestPort({});
}

export function selectorKey(s?: DeviceSelector): string {
  if (!s) return '';
  if (s.kind === 'usb') return `usb:${hex(s.vendorId)}:${hex(s.productId)}:${s.serialNumber ?? ''}`;
  return `serial:${hex(s.usbVendorId)}:${hex(s.usbProductId)}:${s.index ?? 0}`;
}

/** Calls fn when a granted device or port is plugged in or out, so lists and statuses stay current. */
export function watchDevices(fn: () => void): () => void {
  const targets = [nav().usb, nav().serial].filter((x): x is NonNullable<typeof x> => !!x);
  for (const x of targets) {
    x.addEventListener('connect', fn);
    x.addEventListener('disconnect', fn);
  }
  return () => {
    for (const x of targets) {
      x.removeEventListener('connect', fn);
      x.removeEventListener('disconnect', fn);
    }
  };
}

const RAW_DEFAULTS: Record<PrinterCategory, Pick<PrinterProfile, 'paperSize' | 'autoCut'> & Partial<PrinterProfile>> = {
  A4: { paperSize: 'A4', autoCut: false },
  A5: { paperSize: 'A5', autoCut: false },
  K80: { paperSize: 'K80', autoCut: true },
  K58: { paperSize: 'K58', autoCut: true },
  BARCODE: { paperSize: '50x30', autoCut: false, barcodeDensity: 8 },
};

/** A ready-to-test profile for a granted device; the serial settings are the common 9600 8N1 default. */
export function profileForDevice(d: GrantedDevice, existingIds: string[], now = Date.now()): PrinterProfile {
  const base = d.key.replace(/[^a-z0-9]+/gi, '-').replace(/-+$/, '').toLowerCase().slice(0, 56);
  let id = base;
  for (let n = 2; existingIds.includes(id); n++) id = `${base}-${n}`;
  return {
    id,
    name: d.label.slice(0, 100),
    adapter: d.selector.kind === 'usb' ? 'webusb' : 'webserial',
    category: d.category,
    orientation: 'portrait',
    copies: 1,
    marginsMm: { top: 0, right: 0, bottom: 0, left: 0 },
    encoding: 'ascii',
    ...RAW_DEFAULTS[d.category],
    device: d.selector,
    ...(d.selector.kind === 'serial' && { serial: { baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' } }),
    createdAt: now,
    updatedAt: now,
  };
}
