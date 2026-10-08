// Generates the extension icons (PNG) without image dependencies: a printer glyph on a
// rounded square, rasterized with 4x4 supersampling. Run: node scripts/generate-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const OUT = new URL('../apps/extension/public/icons/', import.meta.url);
const BG = [11, 99, 206];
const FG = [255, 255, 255];
const ACCENT = [255, 196, 0];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const inRoundRect = (x, y, x0, y0, x1, y1, r) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};

// Shapes in unit coordinates (0..1), painted in order.
function colorAt(x, y) {
  if (!inRoundRect(x, y, 0.02, 0.02, 0.98, 0.98, 0.2)) return null;
  let c = BG;
  if (inRoundRect(x, y, 0.3, 0.16, 0.7, 0.42, 0.03)) c = FG; // paper in
  if (inRoundRect(x, y, 0.14, 0.36, 0.86, 0.7, 0.08)) c = FG; // body
  if (inRoundRect(x, y, 0.7, 0.44, 0.78, 0.5, 0.02)) c = ACCENT; // status led
  if (inRoundRect(x, y, 0.26, 0.58, 0.74, 0.62, 0.0)) c = BG; // slot
  if (inRoundRect(x, y, 0.3, 0.6, 0.7, 0.86, 0.03)) c = FG; // paper out
  if (y > 0.68 && y < 0.71 && x > 0.36 && x < 0.64) c = BG; // text line
  if (y > 0.75 && y < 0.78 && x > 0.36 && x < 0.58) c = BG; // text line
  return c;
}

mkdirSync(OUT, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  const S = 4;
  const buf = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const c = colorAt((px + (sx + 0.5) / S) / size, (py + (sy + 0.5) / S) / size);
          if (c) { r += c[0]; g += c[1]; b += c[2]; a += 1; }
        }
      }
      const i = (py * size + px) * 4;
      if (a) { buf[i] = r / a; buf[i + 1] = g / a; buf[i + 2] = b / a; buf[i + 3] = (a / (S * S)) * 255; }
    }
  }
  writeFileSync(new URL(`icon-${size}.png`, OUT), png(size, buf));
}
console.log('icons written to', OUT.pathname);
