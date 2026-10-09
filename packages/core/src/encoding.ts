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

/** Windows-1258 bytes 0x80-0xFF (U+FFFD where the code page has no character). */
const CP1258_HIGH =
  '€�‚ƒ„…†‡ˆ‰�‹Œ����‘’“”•–—˜™�›œ��Ÿ ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂĂÄÅÆÇÈÉÊË̀ÍÎÏĐÑ̉ÓÔƠÖ×ØÙÚÛÜỮßàáâăäåæçèéêë́íîïđṇ̃óôơö÷øùúûüư₫ÿ';
const CP1258 = new Map<string, number>();
for (let i = 0; i < CP1258_HIGH.length; i++) if (CP1258_HIGH[i] !== '\ufffd') CP1258.set(CP1258_HIGH[i]!, 0x80 + i);

/** The five Vietnamese tone marks; CP1258 has them as separate combining bytes. */
const TONES = /[\u0300\u0301\u0303\u0309\u0323]/g;

/**
 * CP1258 has letters like "ê" or "ơ" but not "ế" or "ợ": those are written as the base letter
 * followed by a combining tone byte, which is how Windows itself encodes Vietnamese in 1258.
 */
function cp1258Bytes(ch: string): number[] | null {
  const direct = ch.charCodeAt(0) < 0x80 ? ch.charCodeAt(0) : CP1258.get(ch);
  if (direct !== undefined) return [direct];
  const nfd = ch.normalize('NFD');
  const tones = nfd.match(TONES) ?? [];
  const base = nfd.replace(TONES, '').normalize('NFC');
  if (tones.length === 0 || base.length !== 1) return null;
  const baseByte = base.charCodeAt(0) < 0x80 ? base.charCodeAt(0) : CP1258.get(base);
  if (baseByte === undefined) return null;
  return [baseByte, ...tones.map((t) => CP1258.get(t)!)];
}

/**
 * Most ESC/POS and label printers do not understand UTF-8. "ascii" folds Vietnamese
 * diacritics so text stays readable; "cp1258" keeps them on printers set to that code page.
 */
export function encodeText(text: string, encoding: TextEncoding): Uint8Array {
  if (encoding === 'utf-8') return new TextEncoder().encode(text);
  const source = encoding === 'ascii' ? stripDiacritics(text) : text.normalize('NFC');
  const max = encoding === 'ascii' ? 0x7f : 0xff;
  const out: number[] = [];
  for (const ch of source) {
    const c = ch.charCodeAt(0);
    const bytes = encoding === 'cp1258' ? cp1258Bytes(ch) : c <= max ? [c] : null;
    if (bytes) out.push(...bytes);
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
