import { describe, expect, it } from 'vitest';
import type { PrintJobRecord } from '@xdev/shared-types';
import { validateProfile } from '@xdev/core';
import { guessCategory, PRINTER_FILTERS, profileForDevice, selectorKey, type GrantedDevice } from '../src/lib/devices';
import { defaultTestKind, resultText } from '../src/ui/useTestPrint';

const usb: GrantedDevice = {
  key: 'usb:04b8:0202:',
  label: 'EPSON TM-T82 (04b8:0202)',
  selector: { kind: 'usb', vendorId: 0x04b8, productId: 0x0202 },
  category: 'K80',
};
const serial: GrantedDevice = {
  key: 'serial:1a86:7523:0',
  label: 'Serial 1a86:7523',
  selector: { kind: 'serial', usbVendorId: 0x1a86, usbProductId: 0x7523, index: 0 },
  category: 'K80',
};

describe('printer detection', () => {
  it('the chooser filter keeps the USB printer class and known receipt/label vendors', () => {
    expect(PRINTER_FILTERS[0]).toEqual({ classCode: 7 });
    expect(PRINTER_FILTERS).toContainEqual({ vendorId: 0x04b8 });
    expect(PRINTER_FILTERS).toContainEqual({ vendorId: 0x0a5f });
  });

  it('label printers are told apart by vendor or product name; anything else is a receipt printer', () => {
    expect(guessCategory(0x0a5f, 'ZT230')).toBe('BARCODE');
    expect(guessCategory(0x0483, 'XP-365B Label Printer')).toBe('BARCODE');
    expect(guessCategory(0x04b8, 'TM-T82')).toBe('K80');
    expect(guessCategory(undefined)).toBe('K80');
  });
});

describe('profileForDevice', () => {
  it('builds a valid WebUSB profile bound to the device', () => {
    const p = profileForDevice(usb, [], 1);
    expect(() => validateProfile(p)).not.toThrow();
    expect(p).toMatchObject({ id: 'usb-04b8-0202', adapter: 'webusb', category: 'K80', paperSize: 'K80', autoCut: true });
    expect(selectorKey(p.device)).toBe(usb.key);
  });

  it('builds a valid Web Serial profile with 9600 8N1 and keeps the port index', () => {
    const p = profileForDevice({ ...serial, category: 'BARCODE' }, [], 1);
    expect(() => validateProfile(p)).not.toThrow();
    expect(p).toMatchObject({ adapter: 'webserial', paperSize: '50x30', barcodeDensity: 8, serial: { baudRate: 9600 } });
    expect(selectorKey(p.device)).toBe(serial.key);
  });

  it('never reuses an existing id and stays within the id and name limits', () => {
    expect(profileForDevice(usb, ['usb-04b8-0202', 'usb-04b8-0202-2']).id).toBe('usb-04b8-0202-3');
    const long = { ...usb, key: `usb:04b8:0202:${'A'.repeat(80)}`, label: 'x'.repeat(150) };
    expect(() => validateProfile(profileForDevice(long, []))).not.toThrow();
  });
});

describe('test print result', () => {
  const job = (over: Partial<PrintJobRecord>) => ({ jobId: 'j', state: 'SUBMITTED', sizeBytes: 120, ...over }) as PrintJobRecord;

  it('sends the sample the printer type understands', () => {
    expect(defaultTestKind(profileForDevice(usb, []))).toBe('escpos');
    expect(defaultTestKind(profileForDevice({ ...usb, category: 'BARCODE' }, []))).toBe('zpl');
  });

  it('says what each final state means for the user', () => {
    expect(resultText(job({}))).toEqual({ ok: true, text: expect.stringContaining('120 byte') });
    expect(resultText(job({ state: 'UNKNOWN', outcome: 'PRINT_DIALOG_CLOSED' })).ok).toBe(true);
    const failed = resultText(job({ state: 'FAILED', errorCode: 'DEVICE_NOT_FOUND', errorMessage: 'USB printer not connected' }));
    expect(failed).toEqual({ ok: false, text: expect.stringContaining('DEVICE_NOT_FOUND: USB printer not connected') });
  });
});
