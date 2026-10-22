// Virtual printer lab: try the real extension end to end without a printer.
// Starts Chromium with the extension (dist-e2e build) and the React demo, then sets up three printers:
//   PRESCRIPTION -> A5 "browser" profile: the real Chrome print dialog (pick "Save as PDF" / "Microsoft Print to PDF").
//   RECEIPT      -> K80 "webserial" profile: a virtual serial port that records every byte the extension writes.
//   LABEL        -> 50x30 label "webserial" profile: same, for ZPL.
// Recorded jobs go to test-results/lab: <n>-<port>.bin (exact bytes), .txt (decoded receipt or ZPL fields), .zpl.
//
// Usage (after pnpm build of SDK, demo and build:e2e; `pnpm lab` does all of it):
//   node scripts/virtual-printer-lab.mjs            headed; print from the demo yourself, close the browser to stop
//   node scripts/virtual-printer-lab.mjs --auto     headed; prints the receipt and the label first, then stays open
//   node scripts/virtual-printer-lab.mjs --check    headless; prints both, checks SUBMITTED + bytes, exits non-zero on failure
//
// What it does not cover: the OS serial driver, WebUSB and paper output (BP-13, docs/MANUAL-TEST.md).
// The virtual port is injected only into chrome-extension:// pages, so the demo site sees no change.
// Lives in scripts/, not tests/e2e/, so Playwright test discovery never picks it up.
import { createServer } from 'node:http';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = join(import.meta.dirname, '..');
const EXTENSION_DIR = join(ROOT, 'apps/extension/dist-e2e');
const APP_DIR = join(ROOT, 'examples/react-demo/dist');
const OUT = join(ROOT, 'test-results/lab');
const CHECK = process.argv.includes('--check');
const AUTO = CHECK || process.argv.includes('--auto');
const TIMEOUT = 20_000;

// Two ports told apart by USB product id, like two USB-serial adapters of the same model on one PC.
const VENDOR = 0x1a86;
const PORTS = { 0x7523: 'K80', 0x7524: 'LABEL' };
const SERIAL = { baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' };
const NO_MARGINS = { top: 0, right: 0, bottom: 0, left: 0 };
const now = Date.now();
const common = { orientation: 'portrait', copies: 1, encoding: 'ascii', createdAt: now, updatedAt: now };
const PROFILES = [
  { ...common, id: 'lab-a5', name: 'Lab A5 (print dialog)', adapter: 'browser', category: 'A5', paperSize: 'A5', marginsMm: { top: 8, right: 8, bottom: 8, left: 8 }, autoCut: false, isDefault: true },
  { ...common, id: 'lab-k80', name: 'Lab K80 (virtual serial)', adapter: 'webserial', category: 'K80', paperSize: 'K80', marginsMm: NO_MARGINS, autoCut: true, device: { kind: 'serial', usbVendorId: VENDOR, usbProductId: 0x7523 }, serial: SERIAL },
  { ...common, id: 'lab-label', name: 'Lab label 50x30 (virtual serial)', adapter: 'webserial', category: 'BARCODE', paperSize: '50x30', marginsMm: NO_MARGINS, autoCut: false, barcodeDensity: 8, device: { kind: 'serial', usbVendorId: VENDOR, usbProductId: 0x7524 }, serial: SERIAL },
];
const MAPPINGS = [
  { documentType: 'PRESCRIPTION', printerId: 'lab-a5' },
  { documentType: 'RECEIPT', printerId: 'lab-k80' },
  { documentType: 'LABEL', printerId: 'lab-label' },
];

const ESC = 0x1b;
const GS = 0x1d;
const K80_CHARS = 48;

/** Reads back what a K80 would put on paper. Covers the commands the SDK docs and the built-in test receipt use. */
function decodeEscpos(b) {
  const paper = [];
  const ops = [];
  let line = '';
  let align = 0;
  let bold = false;
  const text = (from, to) => Buffer.from(b.subarray(from, to)).toString('latin1');
  const flush = () => {
    const t = bold ? `**${line}**` : line;
    paper.push(align === 1 ? t.padStart(Math.floor((K80_CHARS + t.length) / 2)) : align === 2 ? t.padStart(K80_CHARS) : t);
    line = '';
  };
  for (let i = 0; i < b.length; i++) {
    const c = b[i];
    const n = b[i + 1];
    if (c === ESC) {
      if (n === 0x40) {
        ops.push('ESC @ init');
        align = 0;
        bold = false;
        i += 1;
      } else if (n === 0x61) {
        align = b[i + 2];
        ops.push(`ESC a ${align} align`);
        i += 2;
      } else if (n === 0x45) {
        bold = b[i + 2] === 1;
        ops.push(`ESC E ${b[i + 2]} bold`);
        i += 2;
      } else if (n === 0x21 || n === 0x74) {
        ops.push(`ESC ${n === 0x21 ? '! mode' : 't code page'} ${b[i + 2]}`);
        i += 2;
      } else if (n === 0x64) {
        if (line) flush();
        for (let k = 0; k < b[i + 2]; k++) paper.push('');
        ops.push(`ESC d ${b[i + 2]} feed`);
        i += 2;
      } else {
        ops.push(`ESC 0x${n?.toString(16)} (not decoded)`);
        i += 1;
      }
    } else if (c === GS) {
      if (n === 0x56) {
        const m = b[i + 2];
        if (line) flush();
        paper.push('✂'.repeat(K80_CHARS));
        ops.push(`GS V ${m} cut`);
        // Function B (65/66) carries a feed amount byte.
        i += m === 65 || m === 66 ? 3 : 2;
      } else if (n === 0x6b) {
        const m = b[i + 2];
        if (m >= 65) {
          const len = b[i + 3];
          paper.push(`[barcode ${m}: ${text(i + 4, i + 4 + len).replace(/^\{[ABC]/, '')}]`);
          i += 3 + len;
        } else {
          let j = i + 3;
          while (j < b.length && b[j] !== 0) j++;
          paper.push(`[barcode ${m}: ${text(i + 3, j)}]`);
          i = j;
        }
        ops.push(`GS k ${m} barcode`);
      } else if (n === 0x28 && b[i + 2] === 0x6b) {
        const len = b[i + 3] + b[i + 4] * 256;
        // cn 49 fn 80 stores the QR data; the other functions set size and print it.
        if (b[i + 5] === 49 && b[i + 6] === 80) paper.push(`[QR: ${text(i + 8, i + 5 + len)}]`);
        ops.push(`GS ( k fn ${b[i + 6]}`);
        i += 4 + len;
      } else if (n === 0x21 || n === 0x48 || n === 0x68 || n === 0x77 || n === 0x66) {
        ops.push(`GS 0x${n.toString(16)} ${b[i + 2]}`);
        i += 2;
      } else {
        ops.push(`GS 0x${n?.toString(16)} (not decoded)`);
        i += 1;
      }
    } else if (c === 0x0a) flush();
    else if (c >= 0x20) line += String.fromCharCode(c);
  }
  if (line) flush();
  return { paper: paper.join('\n'), ops };
}

function decodeZpl(zpl) {
  const labels = (zpl.match(/\^XA/g) ?? []).length;
  const fields = [...zpl.matchAll(/\^FO(\d+),(\d+)(.*?)\^FD(.*?)\^FS/g)].map(
    ([, x, y, cmds, data]) => `(${x},${y}) ${/\^B[C3QE]/.test(cmds) ? 'barcode' : 'text'}: ${data}`,
  );
  return `labels: ${labels}\n${fields.join('\n')}`;
}

const jobs = [];
function record(port, base64) {
  const bytes = Buffer.from(base64, 'base64');
  const file = join(OUT, `${String(jobs.length + 1).padStart(2, '0')}-${port}`);
  writeFileSync(`${file}.bin`, bytes);
  const raw = bytes.toString('latin1');
  let decoded;
  if (raw.includes('^XA')) {
    writeFileSync(`${file}.zpl`, raw);
    decoded = decodeZpl(raw);
  } else {
    const { paper, ops } = decodeEscpos(bytes);
    decoded = `${paper}\n\n--- commands ---\n${ops.join('\n')}`;
  }
  writeFileSync(`${file}.txt`, `${decoded}\n`);
  jobs.push({ port, bytes: bytes.length, decoded });
  console.log(`\n[${port}] ${bytes.length} bytes -> ${file}.*\n${decoded}`);
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
function serve(dir) {
  const server = createServer(async (req, res) => {
    const path = new URL(req.url ?? '/', 'http://x').pathname;
    const file = normalize(join(dir, path === '/' ? 'index.html' : path.slice(1)));
    if (!file.startsWith(dir)) return res.writeHead(403).end();
    let body;
    try {
      body = await readFile(file);
    } catch {
      return res.writeHead(404).end();
    }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r({ server, port: server.address().port })));
}

/** Runs in every page before its scripts; only extension pages (print.html runs RAW jobs) get the virtual ports. */
function installVirtualSerial({ vendor, ports }) {
  if (location.protocol !== 'chrome-extension:') return;
  const port = (productId) => {
    let opened = false;
    let bytes = [];
    let writable = null;
    return {
      getInfo: () => ({ usbVendorId: vendor, usbProductId: productId }),
      async open() {
        // Same error a real port gives when another tab or job holds it (adapter maps it to DEVICE_BUSY).
        if (opened) throw new DOMException('The port is already open.', 'InvalidStateError');
        opened = true;
        bytes = [];
        writable = new WritableStream({ write: (chunk) => void bytes.push(...chunk) });
      },
      async close() {
        opened = false;
        writable = null;
        let s = '';
        for (const b of bytes) s += String.fromCharCode(b);
        await window.__labRecord(ports[productId], btoa(s));
      },
      get writable() {
        return writable;
      },
      get readable() {
        return null;
      },
    };
  };
  const list = Object.keys(ports).map((id) => port(Number(id)));
  const serial = { getPorts: async () => list, requestPort: async () => list[0], addEventListener() {}, removeEventListener() {} };
  Object.defineProperty(navigator, 'serial', { configurable: true, value: serial });
}

for (const [what, path] of [['extension build (pnpm --filter @xdev/browser-print-extension build:e2e)', join(EXTENSION_DIR, 'manifest.json')], ['demo build (pnpm --filter @xdev/react-demo build)', join(APP_DIR, 'index.html')]]) {
  if (!existsSync(path)) {
    console.error(`Missing ${what}: ${path}`);
    process.exit(1);
  }
}
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const { server, port } = await serve(APP_DIR);
const origin = `http://localhost:${port}`;
const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: CHECK,
  viewport: CHECK ? { width: 1280, height: 800 } : null,
  locale: 'vi-VN',
  args: [`--disable-extensions-except=${EXTENSION_DIR}`, `--load-extension=${EXTENSION_DIR}`],
});
await context.exposeBinding('__labRecord', (_source, name, base64) => record(name, base64));
await context.addInitScript(installVirtualSerial, { vendor: VENDOR, ports: PORTS });

let failed = false;
try {
  const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const extensionId = new URL(sw.url()).host;
  // The extension opens its options page on install; reuse it for setup.
  await new Promise((r) => setTimeout(r, 500));
  const admin = context.pages().find((p) => p.url().includes('options.html')) ?? (await context.newPage());
  await admin.goto(`chrome-extension://${extensionId}/options.html`);
  const internal = async (type, body) => {
    const r = await admin.evaluate(([t, b]) => chrome.runtime.sendMessage({ type: t, ...b }), [type, body]);
    if (!r?.ok) throw new Error(`${type}: ${r?.error?.code} ${r?.error?.message}`);
    return r.result;
  };
  for (const profile of PROFILES) await internal('profile.upsert', { profile });
  for (const params of MAPPINGS) await internal('mapping.save', { params });
  await internal('sites.add', { origin, scopes: ['read', 'print'], confirmEachJob: false, label: 'Virtual printer lab' });

  const app = await context.newPage();
  await app.goto(`${origin}/`);
  await app.getByTestId('connect').click();
  await app.getByTestId('state').filter({ hasText: 'State: connected' }).waitFor({ timeout: TIMEOUT });
  console.log(`lab ready: demo ${origin}, extension ${extensionId}, output ${OUT}`);

  if (AUTO) {
    for (const [tab, type, port] of [['receipt', 'RECEIPT', 'K80'], ['label', 'LABEL', 'LABEL']]) {
      const before = jobs.length;
      await app.getByTestId(`tab-${tab}`).click();
      await app.getByTestId('print').click();
      const job = app.getByTestId('job').filter({ hasText: new RegExp(`${type} — (SUBMITTED|FAILED|UNKNOWN|CANCELLED)`) });
      await job.waitFor({ timeout: TIMEOUT });
      const result = (await job.textContent()) ?? '';
      const got = jobs.slice(before).find((j) => j.port === port);
      const ok = result.includes('SUBMITTED') && result.includes('BYTES_WRITTEN_TO_PORT') && !!got?.bytes;
      console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${type}: ${result.trim()}${got ? `, ${got.bytes} bytes on ${port}` : ', nothing reached the port'}`);
      failed ||= !ok;
      await app.getByTestId('print').and(app.locator(':enabled')).waitFor({ timeout: TIMEOUT });
    }
  }
  if (!CHECK) {
    console.log('\nBrowser is open: print from the demo (Prescription opens the Chrome print dialog). Close the browser to stop.');
    await new Promise((r) => context.on('close', r));
  }
} catch (e) {
  failed = true;
  console.error(e);
} finally {
  await context.close().catch(() => undefined);
  server.close();
}
process.exit(failed ? 1 : 0);
