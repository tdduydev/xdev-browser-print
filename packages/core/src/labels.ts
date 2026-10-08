/** Test labels for ZPL (Zebra-compatible) and TSPL (TSC-compatible) printers. */
export function testZpl(opts: { widthMm: number; heightMm: number; dpmm: number; text: string }): string {
  const w = Math.round(opts.widthMm * opts.dpmm);
  const h = Math.round(opts.heightMm * opts.dpmm);
  return [
    '^XA',
    '^CI28',
    `^PW${w}`,
    `^LL${h}`,
    '^FO20,20^A0N,28,28^FDxDev Browser Print^FS',
    `^FO20,60^A0N,24,24^FD${sanitizeZpl(opts.text)}^FS`,
    '^FO20,100^BY2^BCN,60,Y,N,N^FDXDEV-TEST-001^FS',
    '^XZ',
  ].join('\n');
}

export function testTspl(opts: { widthMm: number; heightMm: number; text: string }): string {
  return [
    `SIZE ${opts.widthMm} mm, ${opts.heightMm} mm`,
    'GAP 2 mm, 0 mm',
    'DIRECTION 1',
    'CLS',
    'TEXT 20,20,"3",0,1,1,"xDev Browser Print"',
    `TEXT 20,60,"2",0,1,1,"${opts.text.replace(/"/g, "'")}"`,
    'BARCODE 20,100,"128",60,1,0,2,2,"XDEV-TEST-001"',
    'PRINT 1,1',
    '',
  ].join('\r\n');
}

function sanitizeZpl(s: string): string {
  // ^ and ~ would start a new ZPL command inside a field.
  return s.replace(/[\^~]/g, ' ');
}
