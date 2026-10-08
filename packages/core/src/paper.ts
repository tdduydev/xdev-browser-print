import type { Orientation, PrinterProfile } from '@xdev/shared-types';

export interface PaperDimensions {
  widthMm: number;
  /** undefined = continuous roll (receipt printers). */
  heightMm?: number;
}

const KNOWN: Record<string, PaperDimensions> = {
  A4: { widthMm: 210, heightMm: 297 },
  A5: { widthMm: 148, heightMm: 210 },
  K80: { widthMm: 80 },
  K58: { widthMm: 58 },
};

const LABEL_RE = /^(\d{1,3}(?:\.\d)?)x(\d{1,3}(?:\.\d)?)$/i;

export function parsePaperSize(paperSize: string): PaperDimensions | null {
  const known = KNOWN[paperSize.toUpperCase()];
  if (known) return known;
  const m = LABEL_RE.exec(paperSize.trim());
  if (m && m[1] && m[2]) return { widthMm: Number(m[1]), heightMm: Number(m[2]) };
  return null;
}

export function resolvePaper(
  profile: Pick<PrinterProfile, 'paperSize' | 'paperWidthMm' | 'paperHeightMm'>,
  overridePaperSize?: string,
): PaperDimensions | null {
  if (!overridePaperSize && profile.paperWidthMm) {
    return { widthMm: profile.paperWidthMm, heightMm: profile.paperHeightMm };
  }
  return parsePaperSize(overridePaperSize ?? profile.paperSize);
}

/** CSS @page rule for HTML jobs; the print dialog still lets the user override it. */
export function pageCss(paper: PaperDimensions | null, orientation: Orientation, margins: { top: number; right: number; bottom: number; left: number }): string {
  const margin = `${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm`;
  if (!paper) return `@page { margin: ${margin}; }`;
  let w = paper.widthMm;
  let h = paper.heightMm;
  if (h !== undefined && orientation === 'landscape') [w, h] = [h, w];
  const size = h === undefined ? `${w}mm auto` : `${w}mm ${h}mm`;
  return `@page { size: ${size}; margin: ${margin}; }`;
}
