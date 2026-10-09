import type { TextEncoding } from '@xdev/shared-types';

/** Vietnamese letters that NFD does not decompose. */
const SPECIAL: Record<string, string> = { đ: 'd', Đ: 'D' };

export function stripDiacritics(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, (c) => SPECIAL[c] ?? c);
}

/** Typographic punctuation an app or our own labels may use, folded so it does not print as '?'. */
const PUNCT: Record<string, string> = {
  '·': '-', '•': '*', '–': '-', '—': '-', '‘': "'", '’': "'", '“': '"', '”': '"', '…': '...', '\u00a0': ' ', '×': 'x',
};

/**
 * Most ESC/POS and label printers do not understand UTF-8. "ascii" folds Vietnamese
 * diacritics so text stays readable; device code pages are a per-model concern.
 */
export function encodeText(text: string, encoding: TextEncoding): Uint8Array {
  if (encoding === 'utf-8') return new TextEncoder().encode(text);
  const source = encoding === 'ascii' ? stripDiacritics(text) : text;
  const max = encoding === 'ascii' ? 0x7f : 0xff;
  const out: number[] = [];
  for (const ch of source) {
    const c = ch.charCodeAt(0);
    if (c <= max) out.push(c);
    else for (const f of PUNCT[ch] ?? '?') out.push(f.charCodeAt(0));
  }
  return Uint8Array.from(out);
}

export function concatBytes(parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
