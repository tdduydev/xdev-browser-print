import { stripDiacritics } from './encoding';

/**
 * Builds a tiny, valid single-page PDF with Helvetica text. Used for the "test print"
 * screen so testing needs no network and no PDF library.
 */
export function buildTextPdf(opts: { widthMm: number; heightMm: number; lines: string[] }): Uint8Array {
  const pt = (mm: number) => Math.round((mm * 72) / 25.4);
  const w = pt(opts.widthMm);
  const h = pt(opts.heightMm);
  const esc = (s: string) => stripDiacritics(s).replace(/[^\x20-\x7e]/g, '?').replace(/([\\()])/g, '\\$1');
  const content = [
    'BT',
    '/F1 14 Tf',
    `40 ${h - 50} Td`,
    '18 TL',
    ...opts.lines.map((l) => `(${esc(l)}) Tj T*`),
    'ET',
    `0.5 w 30 30 ${w - 60} ${h - 60} re S`,
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>`,
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}
