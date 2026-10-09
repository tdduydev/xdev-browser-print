import type { TextEncoding } from '@xdev/shared-types';
import { concatBytes, encodeText } from './encoding';

const ESC = 0x1b;
const GS = 0x1d;

/** Error correction levels of `GS ( k` function 169 (L 7%, M 15%, Q 25%, H 30%). */
const QR_ECC = { L: 48, M: 49, Q: 50, H: 51 } as const;
/** Largest QR model 2 payload (version 40, level L) in bytes. */
const QR_MAX_BYTES = 7089;

export interface QrOptions {
  /** Module size in dots, 1-16. */
  size?: number;
  ecc?: keyof typeof QR_ECC;
}

/** Minimal ESC/POS builder: enough for test receipts and simple layouts. */
export class EscPosBuilder {
  private parts: Uint8Array[] = [];

  constructor(private readonly encoding: TextEncoding = 'ascii', codePage?: number) {
    this.raw([ESC, 0x40]); // initialize
    if (codePage !== undefined) this.codePage(codePage);
  }

  /** ESC t n: selects the printer's character table; n depends on the vendor. */
  codePage(n: number): this {
    return this.raw([ESC, 0x74, n & 0xff]);
  }

  raw(bytes: number[] | Uint8Array): this {
    this.parts.push(bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes));
    return this;
  }

  text(s: string): this {
    return this.raw(encodeText(s, this.encoding));
  }

  line(s = ''): this {
    return this.text(s).raw([0x0a]);
  }

  align(a: 'left' | 'center' | 'right'): this {
    return this.raw([ESC, 0x61, a === 'left' ? 0 : a === 'center' ? 1 : 2]);
  }

  bold(on: boolean): this {
    return this.raw([ESC, 0x45, on ? 1 : 0]);
  }

  size(width: 1 | 2, height: 1 | 2): this {
    return this.raw([GS, 0x21, ((width - 1) << 4) | (height - 1)]);
  }

  feed(lines: number): this {
    return this.raw([ESC, 0x64, Math.max(0, Math.min(255, lines))]);
  }

  /** CODE128 barcode (GS k m=73). */
  barcode128(data: string): this {
    const bytes = encodeText(`{B${data}`, 'ascii');
    return this.raw([GS, 0x68, 80, GS, 0x77, 2, GS, 0x48, 2, GS, 0x6b, 73, bytes.length]).raw(bytes).raw([0x0a]);
  }

  /** QR code, model 2, via `GS ( k` (Epson; most ESC/POS clones accept it). Data is sent as UTF-8. */
  qr(data: string, opts: QrOptions = {}): this {
    const bytes = new TextEncoder().encode(data);
    if (bytes.length === 0 || bytes.length > QR_MAX_BYTES) throw new RangeError(`QR data must be 1-${QR_MAX_BYTES} bytes`);
    const size = Math.max(1, Math.min(16, Math.round(opts.size ?? 6)));
    const store = bytes.length + 3;
    return this.raw([GS, 0x28, 0x6b, 4, 0, 49, 65, 50, 0]) // model 2
      .raw([GS, 0x28, 0x6b, 3, 0, 49, 67, size])
      .raw([GS, 0x28, 0x6b, 3, 0, 49, 69, QR_ECC[opts.ecc ?? 'M']])
      .raw([GS, 0x28, 0x6b, store & 0xff, store >> 8, 49, 80, 48])
      .raw(bytes)
      .raw([GS, 0x28, 0x6b, 3, 0, 49, 81, 48]) // print the stored symbol
      .raw([0x0a]);
  }

  cut(partial = false): this {
    return this.raw([GS, 0x56, partial ? 66 : 65, 3]);
  }

  build(): Uint8Array {
    return concatBytes(this.parts);
  }
}

export function testReceipt(opts: { encoding: TextEncoding; codePage?: number; widthChars: number; autoCut: boolean; title: string; now?: Date }): Uint8Array {
  const sep = '-'.repeat(opts.widthChars);
  const b = new EscPosBuilder(opts.encoding, opts.codePage)
    .align('center')
    .bold(true)
    .size(2, 2)
    .line('xDev')
    .size(1, 1)
    .line(opts.title)
    .bold(false)
    .line((opts.now ?? new Date()).toISOString().replace('T', ' ').slice(0, 19))
    .align('left')
    .line(sep)
    .line('Tieng Viet: Đơn thuốc - Hóa đơn')
    .line(`Width: ${opts.widthChars} chars`)
    .line(sep)
    .align('center')
    .barcode128('XDEV-TEST-001')
    .qr('XDEV-QR-0001')
    .feed(3);
  if (opts.autoCut) b.cut();
  return b.build();
}
