import type { PrinterCapabilities, PrinterProfile, PrinterStatus, SerialPortSelector } from '@xdev/shared-types';
import { buildRawBytes } from './raw-payload';
import { TimeoutError, withTimeout, type PrintAdapter, type PrintRequest, type PrintResult } from './types';
import { fail } from './webusb-adapter';

export interface SerialPortLike {
  getInfo(): { usbVendorId?: number; usbProductId?: number };
  open(options: { baudRate: number; dataBits?: number; stopBits?: number; parity?: string; flowControl?: string }): Promise<void>;
  close(): Promise<void>;
  readonly writable: WritableStream<Uint8Array> | null;
}
export interface SerialLike {
  getPorts(): Promise<SerialPortLike[]>;
}

export function matchSerialPort(ports: SerialPortLike[], sel: SerialPortSelector): SerialPortLike | undefined {
  const matches = ports.filter((p) => {
    const info = p.getInfo();
    return (sel.usbVendorId === undefined || info.usbVendorId === sel.usbVendorId) && (sel.usbProductId === undefined || info.usbProductId === sel.usbProductId);
  });
  return matches[sel.index ?? 0];
}

export class WebSerialPrintAdapter implements PrintAdapter {
  readonly id = 'webserial' as const;

  constructor(
    private readonly serial: () => SerialLike | undefined,
    private readonly opts = { timeoutMs: 30_000 },
  ) {}

  async isSupported() {
    return !!this.serial();
  }

  async getCapabilities(): Promise<PrinterCapabilities> {
    return { formats: ['ESCPOS', 'ZPL', 'TSPL', 'RAW'], silent: true, selectPrinter: true };
  }

  async getStatus(profile?: PrinterProfile): Promise<PrinterStatus> {
    const serial = this.serial();
    if (!serial) return { ready: false, reason: 'WEBSERIAL_UNAVAILABLE' };
    if (profile?.device?.kind !== 'serial') return { ready: false, reason: 'NO_DEVICE_CONFIGURED' };
    return matchSerialPort(await serial.getPorts(), profile.device) ? { ready: true } : { ready: false, reason: 'PORT_NOT_CONNECTED_OR_NOT_GRANTED' };
  }

  async print(req: PrintRequest): Promise<PrintResult> {
    const serial = this.serial();
    if (!serial) return fail('UNSUPPORTED_CAPABILITY', 'Web Serial is not available in this context', false);
    const sel = req.profile.device;
    if (sel?.kind !== 'serial' || !req.profile.serial) return fail('DEVICE_NOT_FOUND', 'Profile has no serial port', false);
    const port = matchSerialPort(await serial.getPorts(), sel);
    if (!port) return fail('DEVICE_NOT_FOUND', 'Serial port not connected or permission not granted', true);

    const bytes = buildRawBytes(req.payload, req.format, req.profile, req.copies);
    const s = req.profile.serial;
    try {
      await withTimeout(port.open({ baudRate: s.baudRate, dataBits: s.dataBits, stopBits: s.stopBits, parity: s.parity, flowControl: s.flowControl }), 5_000, 'open');
    } catch (e) {
      const name = e instanceof Error ? e.name : 'Error';
      // InvalidStateError = already open (another job/tab); NetworkError = OS could not open it.
      return fail(name === 'InvalidStateError' ? 'DEVICE_BUSY' : 'DEVICE_DISCONNECTED', `Cannot open serial port (${name})`, true);
    }
    let started = false;
    try {
      const writable = port.writable;
      if (!writable) return fail('DEVICE_DISCONNECTED', 'Serial port is not writable', true);
      const writer = writable.getWriter();
      try {
        started = true;
        await withTimeout(writer.write(bytes), this.opts.timeoutMs, 'serial write');
        // ready resolves once the queue drained to the OS driver.
        await withTimeout(writer.ready, this.opts.timeoutMs, 'serial drain');
      } finally {
        writer.releaseLock();
      }
      return { state: 'SUBMITTED', outcome: 'BYTES_WRITTEN_TO_PORT', bytesWritten: bytes.length };
    } catch (e) {
      const name = e instanceof Error ? e.name : 'Error';
      // Web Serial gives no byte count on failure, so once writing started the outcome is unknown.
      if (started) {
        return {
          state: 'FAILED',
          outcome: 'PARTIAL_TRANSFER',
          error: { code: e instanceof TimeoutError ? 'TIMEOUT' : 'TRANSFER_FAILED', message: `Serial write failed (${name})` },
          retryable: false,
        };
      }
      return fail('TRANSFER_FAILED', `Serial error (${name})`, true);
    } finally {
      await port.close().catch(() => undefined);
    }
  }
}
