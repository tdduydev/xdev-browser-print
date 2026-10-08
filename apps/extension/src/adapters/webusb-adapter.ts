import type { PrinterCapabilities, PrinterProfile, PrinterStatus, UsbDeviceSelector } from '@xdev/shared-types';
import { PrintError, toSerializedError } from '@xdev/core';
import { buildRawBytes } from './raw-payload';
import { TimeoutError, withTimeout, type PrintAdapter, type PrintRequest, type PrintResult } from './types';

/** Structural subset of the WebUSB API, so the adapter is testable without hardware. */
export interface UsbEndpointLike {
  endpointNumber: number;
  direction: 'in' | 'out';
  type: 'bulk' | 'interrupt' | 'isochronous';
}
export interface UsbAlternateLike {
  alternateSetting: number;
  interfaceClass: number;
  endpoints: UsbEndpointLike[];
}
export interface UsbInterfaceLike {
  interfaceNumber: number;
  alternates: UsbAlternateLike[];
}
export interface UsbDeviceLike {
  vendorId: number;
  productId: number;
  serialNumber?: string | null;
  productName?: string | null;
  opened: boolean;
  configuration: { interfaces: UsbInterfaceLike[] } | null;
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(n: number): Promise<void>;
  claimInterface(n: number): Promise<void>;
  releaseInterface(n: number): Promise<void>;
  selectAlternateInterface?(n: number, alt: number): Promise<void>;
  transferOut(endpoint: number, data: Uint8Array): Promise<{ bytesWritten: number; status: 'ok' | 'stall' | 'babble' }>;
}
export interface UsbLike {
  getDevices(): Promise<UsbDeviceLike[]>;
}

const PRINTER_CLASS = 7;
const CHUNK = 16 * 1024;

export function matchUsbDevice(devices: UsbDeviceLike[], sel: UsbDeviceSelector): UsbDeviceLike | undefined {
  return devices.find(
    (d) => d.vendorId === sel.vendorId && d.productId === sel.productId && (!sel.serialNumber || d.serialNumber === sel.serialNumber),
  );
}

/** Prefer the USB printer-class interface; fall back to any interface with a bulk OUT endpoint. */
export function findBulkOut(device: UsbDeviceLike): { iface: number; alt: number; endpoint: number } | null {
  const ifaces = device.configuration?.interfaces ?? [];
  const candidates: { iface: number; alt: number; endpoint: number; printer: boolean }[] = [];
  for (const i of ifaces) {
    for (const a of i.alternates) {
      const ep = a.endpoints.find((e) => e.direction === 'out' && e.type === 'bulk');
      if (ep) candidates.push({ iface: i.interfaceNumber, alt: a.alternateSetting, endpoint: ep.endpointNumber, printer: a.interfaceClass === PRINTER_CLASS });
    }
  }
  const pick = candidates.find((c) => c.printer) ?? candidates[0];
  return pick ? { iface: pick.iface, alt: pick.alt, endpoint: pick.endpoint } : null;
}

export class WebUsbPrintAdapter implements PrintAdapter {
  readonly id = 'webusb' as const;

  constructor(
    private readonly usb: () => UsbLike | undefined,
    private readonly opts = { timeoutMs: 30_000 },
  ) {}

  async isSupported() {
    return !!this.usb();
  }

  async getCapabilities(): Promise<PrinterCapabilities> {
    return { formats: ['ESCPOS', 'ZPL', 'TSPL', 'RAW'], silent: true, selectPrinter: true };
  }

  async getStatus(profile?: PrinterProfile): Promise<PrinterStatus> {
    const usb = this.usb();
    if (!usb) return { ready: false, reason: 'WEBUSB_UNAVAILABLE' };
    if (profile?.device?.kind !== 'usb') return { ready: false, reason: 'NO_DEVICE_CONFIGURED' };
    const dev = matchUsbDevice(await usb.getDevices(), profile.device);
    return dev ? { ready: true } : { ready: false, reason: 'DEVICE_NOT_CONNECTED_OR_NOT_GRANTED' };
  }

  async print(req: PrintRequest): Promise<PrintResult> {
    const usb = this.usb();
    if (!usb) return fail('UNSUPPORTED_CAPABILITY', 'WebUSB is not available in this context', false);
    const sel = req.profile.device;
    if (sel?.kind !== 'usb') return fail('DEVICE_NOT_FOUND', 'Profile has no USB device', false);

    const device = matchUsbDevice(await usb.getDevices(), sel);
    // getDevices() only lists devices that are both granted and plugged in.
    if (!device) return fail('DEVICE_NOT_FOUND', 'USB printer not connected or permission not granted', true);

    const bytes = buildRawBytes(req.payload, req.format, req.profile, req.copies);
    let claimed: number | null = null;
    let written = 0;
    try {
      try {
        if (!device.opened) await withTimeout(device.open(), 5_000, 'open');
        if (!device.configuration) await device.selectConfiguration(1);
      } catch (e) {
        return fail('DEVICE_BUSY', `Cannot open USB device (${errName(e)}). Another driver or tab may hold it.`, true);
      }
      const target = findBulkOut(device);
      if (!target) return fail('UNSUPPORTED_CAPABILITY', 'Device exposes no bulk OUT endpoint', false);
      try {
        await device.claimInterface(target.iface);
        claimed = target.iface;
        if (target.alt !== 0 && device.selectAlternateInterface) await device.selectAlternateInterface(target.iface, target.alt);
      } catch (e) {
        // Typical on Windows (usbprint.sys owns the interface) or Linux (usblp bound).
        return fail('DEVICE_BUSY', `Cannot claim USB interface (${errName(e)}). The OS printer driver may own it.`, true);
      }
      for (let off = 0; off < bytes.length; off += CHUNK) {
        const chunk = bytes.subarray(off, off + CHUNK);
        const r = await withTimeout(device.transferOut(target.endpoint, chunk), this.opts.timeoutMs, 'transferOut');
        written += r.bytesWritten;
        if (r.status !== 'ok' || r.bytesWritten !== chunk.length) {
          return partial(written, `USB transfer status ${r.status}`);
        }
      }
      return { state: 'SUBMITTED', outcome: 'BYTES_WRITTEN_TO_DEVICE', bytesWritten: written };
    } catch (e) {
      if (written > 0) return partial(written, errName(e));
      if (e instanceof TimeoutError) return fail('TIMEOUT', e.message, true);
      const code = errName(e) === 'NotFoundError' ? 'DEVICE_DISCONNECTED' : 'TRANSFER_FAILED';
      return fail(code, `USB error: ${errName(e)}`, true);
    } finally {
      if (claimed !== null) await device.releaseInterface(claimed).catch(() => undefined);
      await device.close().catch(() => undefined);
    }
  }
}

function errName(e: unknown): string {
  return e instanceof Error ? e.name : 'Error';
}

export function fail(code: PrintError['code'], message: string, retryable: boolean): PrintResult {
  return { state: 'FAILED', outcome: code, error: toSerializedError(new PrintError(code, message)), retryable };
}

/** Some bytes reached the device: printing again could duplicate output, so never retry. */
function partial(written: number, reason: string): PrintResult {
  return {
    state: 'FAILED',
    outcome: 'PARTIAL_TRANSFER',
    error: { code: 'TRANSFER_FAILED', message: `Transfer interrupted after ${written} bytes: ${reason}`, details: { bytesWritten: written } },
    retryable: false,
    bytesWritten: written,
  };
}
