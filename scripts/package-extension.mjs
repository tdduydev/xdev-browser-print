// Validates the built extension and writes release/xdev-browser-print-<version>.zip.
// Pure Node (zlib) so it runs the same on every CI runner.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { deflateRawSync } from 'node:zlib';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const DIST = join(ROOT, 'apps/extension/dist');
const OUT_DIR = join(ROOT, 'release');

function fail(msg) {
  console.error(`package: ${msg}`);
  process.exit(1);
}

if (!existsSync(join(DIST, 'manifest.json'))) fail('apps/extension/dist/manifest.json missing — run `pnpm build` first');
const manifest = JSON.parse(readFileSync(join(DIST, 'manifest.json'), 'utf8'));
const pkg = JSON.parse(readFileSync(join(ROOT, 'apps/extension/package.json'), 'utf8'));

// Release guards: these mistakes are easy to make and costly in Store review.
if (manifest.manifest_version !== 3) fail('manifest_version must be 3');
if (manifest.name !== 'xDev Browser Print') fail(`unexpected name "${manifest.name}"`);
if (manifest.version !== pkg.version) fail(`manifest version ${manifest.version} != package.json ${pkg.version}`);
if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) fail('version must be SemVer MAJOR.MINOR.PATCH');
if (manifest.host_permissions) fail('host_permissions present — this looks like the e2e build, never release it');
if (manifest.content_scripts) fail('static content_scripts must not be declared');
for (const size of ['16', '32', '48', '128']) {
  if (!existsSync(join(DIST, manifest.icons?.[size] ?? `missing-${size}`))) fail(`icon ${size}px missing`);
}
for (const f of ['background.js', 'content.js', 'popup.html', 'options.html', 'print.html', 'approve.html', '_locales/vi/messages.json', '_locales/en/messages.json']) {
  if (!existsSync(join(DIST, f))) fail(`${f} missing`);
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const files = walk(DIST)
  .filter((f) => !f.endsWith('.map'))
  .sort();

// Remote code is forbidden in MV3 and rejected by the Store.
for (const f of files.filter((x) => /\.(js|html)$/.test(x))) {
  const src = readFileSync(f, 'utf8');
  if (/<script[^>]+src=["']https?:/i.test(src) || /import\s*\(\s*["']https?:/.test(src)) fail(`remote code reference in ${relative(DIST, f)}`);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

// Fixed timestamp (1980-01-01) so the same build gives the same ZIP.
const DOS_TIME = 0;
const DOS_DATE = (0 << 9) | (1 << 5) | 1;
const locals = [];
const centrals = [];
let offset = 0;
for (const file of files) {
  const name = Buffer.from(relative(DIST, file).split(sep).join('/'));
  const data = readFileSync(file);
  const comp = deflateRawSync(data, { level: 9 });
  const crc = crc32(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6); // UTF-8 names
  local.writeUInt16LE(8, 8);
  local.writeUInt16LE(DOS_TIME, 10);
  local.writeUInt16LE(DOS_DATE, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(comp.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  locals.push(local, name, comp);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(8, 10);
  central.writeUInt16LE(DOS_TIME, 12);
  central.writeUInt16LE(DOS_DATE, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(comp.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(offset, 42);
  centrals.push(central, name);
  offset += local.length + name.length + comp.length;
}
const centralBuf = Buffer.concat(centrals);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralBuf.length, 12);
end.writeUInt32LE(offset, 16);
const zip = Buffer.concat([...locals, centralBuf, end]);

mkdirSync(OUT_DIR, { recursive: true });
const out = join(OUT_DIR, `xdev-browser-print-${manifest.version}.zip`);
writeFileSync(out, zip);
const sha = createHash('sha256').update(zip).digest('hex');
writeFileSync(`${out}.sha256`, `${sha}  xdev-browser-print-${manifest.version}.zip\n`);
console.log(`package: ${relative(ROOT, out)} (${files.length} files, ${(zip.length / 1024).toFixed(1)} KB, sha256 ${sha})`);
