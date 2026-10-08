import type { PrintOptions } from '@tdduydev/browser-print/react';

export interface DemoDocument {
  id: string;
  title: string;
  description: string;
  // documentType must match a mapping configured in the extension (Mappings screen).
  options: PrintOptions;
}

const ESC = '\x1b';
const GS = '\x1d';

const prescriptionHtml = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  @page { size: A5; margin: 8mm; }
  body { font-family: sans-serif; font-size: 12pt; }
  h1 { text-align: center; } table { width: 100%; border-collapse: collapse; }
  td, th { border: 1px solid #000; padding: 4px; text-align: left; }
</style></head><body>
  <h1>Đơn thuốc</h1>
  <p>Bệnh nhân: Nguyễn Văn A — Mã BN: 000123</p>
  <table>
    <tr><th>Thuốc</th><th>Liều dùng</th><th>SL</th></tr>
    <tr><td>Paracetamol 500mg</td><td>1 viên x 3 lần/ngày</td><td>15</td></tr>
    <tr><td>Vitamin C 500mg</td><td>1 viên/ngày</td><td>5</td></tr>
  </table>
</body></html>`;

// Plain ASCII on purpose: a default ESC/POS code page cannot print Vietnamese diacritics.
const receipt =
  ESC + '@' + ESC + 'a\x01' + 'DEMO PHARMACY\n' + ESC + 'a\x00' +
  '--------------------------------\n' +
  'Paracetamol 500mg   x15   45,000\n' +
  'Vitamin C 500mg     x5    25,000\n' +
  '--------------------------------\n' +
  'TOTAL                     70,000\n\n\n' +
  GS + 'V\x42\x00';

const label =
  '^XA^PW400^LL240^FO20,20^A0N,36,36^FDParacetamol 500mg^FS' +
  '^FO20,80^BCN,70,Y^FD000123^FS^FO20,190^A0N,24,24^FD1 vien x 3 lan/ngay^FS^XZ';

export const DOCUMENTS: DemoDocument[] = [
  {
    id: 'prescription',
    title: 'Prescription (A5, HTML)',
    description: 'Opens Chrome’s print dialog. The job ends UNKNOWN / PRINT_DIALOG_CLOSED: Chrome does not say whether the user printed.',
    options: { documentType: 'PRESCRIPTION', format: 'HTML', data: prescriptionHtml },
  },
  {
    id: 'receipt',
    title: 'Receipt (K80, ESC/POS)',
    description: 'Raw bytes to a thermal printer over WebUSB/Serial. SUBMITTED means every byte was written.',
    options: { documentType: 'RECEIPT', format: 'ESCPOS', data: receipt },
  },
  {
    id: 'label',
    title: 'Label (50×30 mm, ZPL)',
    description: 'Raw ZPL to a label printer. Map LABEL to a device profile first.',
    options: { documentType: 'LABEL', format: 'ZPL', data: label },
  },
];
