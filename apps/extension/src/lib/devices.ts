import type { DeviceSelector } from '@xdev/shared-types';

/** Page-side WebUSB / Web Serial helpers (permission prompts need a user gesture in a page). */
type UsbNav = Navigator & {
  usb?: { getDevices(): Promise<USBDeviceInfo[]>; requestDevice(o: { filters: object[] }): Promise<USBDeviceInfo> };
  serial?: { getPorts(): Promise<SerialPortInfo[]>; requestPort(o?: object): Promise<SerialPortInfo> };
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
      ...(p.forget && { forget: () => p.forget!() }),
    };
  });
}

export async function requestUsb(): Promise<void> {
  await nav().usb?.requestDevice({ filters: [] });
}

export async function requestSerial(): Promise<void> {
  await nav().serial?.requestPort({});
}

export function selectorKey(s?: DeviceSelector): string {
  if (!s) return '';
  if (s.kind === 'usb') return `usb:${hex(s.vendorId)}:${hex(s.productId)}:${s.serialNumber ?? ''}`;
  return `serial:${hex(s.usbVendorId)}:${hex(s.usbProductId)}:${s.index ?? 0}`;
}
