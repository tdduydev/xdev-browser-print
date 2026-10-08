// Captures the Chrome Web Store screenshots (1280x800, the size the store asks for) of the
// options page, in Vietnamese and English, with demo data only.
// Usage: pnpm cws:screenshots   (builds the extension first, writes docs/images/cws/*.png)
//
// It loads the production build, not dist-e2e, so the screenshots show what is shipped.
// The copy it loads gets host_permissions for the demo origins only because Playwright
// cannot click Chrome's permission prompt; the real dist/ folder is never modified.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = join(import.meta.dirname, '..');
const DIST = join(ROOT, 'apps/extension/dist');
const OUT = join(ROOT, 'docs/images/cws');
const VIEWPORT = { width: 1280, height: 800 };
const SCREENS = ['dashboard', 'profiles', 'mappings', 'devices', 'test', 'history', 'sites', 'settings'];
const DEMO_SITES = ['https://clinic.example.com', 'https://pharmacy.example.com'];

// Fixed clock so re-running produces the same history timestamps.
const BASE_TIME = Date.UTC(2026, 9, 8, 1, 30); // 08:30 in Asia/Ho_Chi_Minh

const PROFILES = [
  {
    id: 'printer-a5',
    name: { vi: 'Máy in đơn thuốc A5', en: 'A5 prescription printer' },
    adapter: 'browser',
    category: 'A5',
    paperSize: 'A5',
    orientation: 'portrait',
    copies: 1,
    marginsMm: { top: 8, right: 8, bottom: 8, left: 8 },
    encoding: 'utf-8',
    autoCut: false,
    isDefault: true,
  },
  {
    id: 'printer-k80',
    name: { vi: 'Máy in hoá đơn K80', en: 'K80 receipt printer' },
    adapter: 'webusb',
    category: 'K80',
    paperSize: 'K80',
    orientation: 'portrait',
    copies: 1,
    marginsMm: { top: 0, right: 0, bottom: 0, left: 0 },
    encoding: 'utf-8',
    autoCut: true,
    device: { kind: 'usb', vendorId: 0x0416, productId: 0x5011 },
  },
  {
    id: 'printer-label',
    name: { vi: 'Máy in tem 50x30', en: '50x30 label printer' },
    adapter: 'webserial',
    category: 'BARCODE',
    paperSize: '50x30',
    orientation: 'portrait',
    copies: 1,
    marginsMm: { top: 0, right: 0, bottom: 0, left: 0 },
    encoding: 'utf-8',
    autoCut: false,
    barcodeDensity: 8,
    device: { kind: 'serial', usbVendorId: 0x0483, usbProductId: 0x5740, index: 0 },
    serial: { baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' },
  },
];

const MAPPINGS = [
  { documentType: 'PRESCRIPTION', printerId: 'printer-a5' },
  { documentType: 'INVOICE', printerId: 'printer-k80' },
  { documentType: 'RECEIPT', printerId: 'printer-k80', copies: 2 },
  { documentType: 'SPECIMEN_LABEL', printerId: 'printer-label' },
];

/** Metadata-only records, the same shape the job manager stores (no document content). */
function demoJobs() {
  const rows = [
    ['PRESCRIPTION', 'PDF', 48_213, 'printer-a5', 'browser', 'UNKNOWN', 'PRINT_DIALOG_CLOSED', 0],
    ['RECEIPT', 'ESCPOS', 1_874, 'printer-k80', 'webusb', 'SUBMITTED', 'BYTES_WRITTEN_TO_DEVICE', 1],
    ['SPECIMEN_LABEL', 'ZPL', 612, 'printer-label', 'webserial', 'SUBMITTED', 'BYTES_WRITTEN_TO_PORT', 1],
    ['INVOICE', 'ESCPOS', 2_390, 'printer-k80', 'webusb', 'FAILED', 'DEVICE_DISCONNECTED', 1],
    ['PRESCRIPTION', 'HTML', 9_456, 'printer-a5', 'browser', 'UNKNOWN', 'PRINT_DIALOG_CLOSED', 0],
    ['RECEIPT', 'ESCPOS', 1_902, 'printer-k80', 'webusb', 'SUBMITTED', 'BYTES_WRITTEN_TO_DEVICE', 1],
  ];
  return rows.map(([documentType, format, sizeBytes, profileId, adapter, state, outcome, site], i) => {
    const createdAt = BASE_TIME - i * 7 * 60_000;
    const failed = state === 'FAILED';
    return {
      jobId: `job-demo-${i + 1}`,
      idempotencyKey: `demo-${i + 1}`,
      origin: DEMO_SITES[site],
      documentType,
      format,
      sizeBytes,
      profileId,
      adapter,
      state,
      outcome,
      ...(failed && { errorCode: 'DEVICE_DISCONNECTED', errorMessage: 'USB device was disconnected' }),
      attempts: failed ? 3 : 1,
      createdAt,
      updatedAt: createdAt + 4_000,
      history: [
        { state: 'CREATED', at: createdAt },
        { state: 'QUEUED', at: createdAt + 50 },
        { state: 'DISPATCHING', at: createdAt + 120 },
        { state, at: createdAt + 4_000 },
      ],
    };
  });
}

function prepareExtension() {
  const dir = mkdtempSync(join(tmpdir(), 'xdbp-cws-'));
  cpSync(DIST, dir, { recursive: true });
  const manifestPath = join(dir, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifest.host_permissions = DEMO_SITES.map((o) => `${o}/*`);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return dir;
}

async function internal(page, type, req = {}) {
  const r = await page.evaluate(([t, body]) => chrome.runtime.sendMessage({ type: t, ...body }), [type, req]);
  if (!r?.ok) throw new Error(`${type}: ${r?.error?.code} ${r?.error?.message}`);
  return r.result;
}

async function seed(page, language) {
  for (const p of PROFILES) await internal(page, 'profile.upsert', { profile: { ...p, name: p.name[language], createdAt: BASE_TIME, updatedAt: BASE_TIME } });
  for (const m of MAPPINGS) await internal(page, 'mapping.save', { params: m });
  await internal(page, 'sites.add', { origin: DEMO_SITES[0], scopes: ['read', 'print'], confirmEachJob: false, label: language === 'vi' ? 'Phòng khám' : 'Clinic' });
  await internal(page, 'sites.add', { origin: DEMO_SITES[1], scopes: ['read', 'print'], confirmEachJob: true, label: language === 'vi' ? 'Nhà thuốc' : 'Pharmacy' });
  // Opens the job database in the service worker first, so the page never has to create it.
  await internal(page, 'jobs.list', { limit: 1 });
  await page.evaluate(
    (jobs) =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('xdev-browser-print', 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction('jobs', 'readwrite');
          for (const j of jobs) tx.objectStore('jobs').put(j);
          tx.oncomplete = () => resolve(undefined);
          tx.onerror = () => reject(tx.error);
        };
      }),
    demoJobs(),
  );
}

async function capture(language, locale, extensionDir) {
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    locale,
    timezoneId: 'Asia/Ho_Chi_Minh',
    args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
  });
  try {
    const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    const extensionId = new URL(sw.url()).host;
    // The extension opens its options page on install; close it so only our page remains.
    await new Promise((r) => setTimeout(r, 500));
    for (const p of context.pages()) await p.close();
    const page = await context.newPage();
    const base = `chrome-extension://${extensionId}/options.html`;
    await page.goto(base);
    const { config } = await internal(page, 'config.get');
    await internal(page, 'settings.update', { patch: { ...config.settings, language } });
    await seed(page, language);

    const files = [];
    for (const [i, screen] of SCREENS.entries()) {
      await page.goto(`${base}#${screen}`);
      await page.reload();
      await page.locator(`[data-testid="nav-${screen}"].active`).waitFor();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(300); // lets async lists (devices, history) render
      const file = join(OUT, `${language}-${String(i + 1).padStart(2, '0')}-${screen}.png`);
      await page.screenshot({ path: file, fullPage: false });
      files.push(file);
    }
    return files;
  } finally {
    await context.close();
  }
}

/** Reads width/height from the PNG IHDR chunk, so the size check needs no image library. */
function pngSize(file) {
  const b = readFileSync(file);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

const extensionDir = prepareExtension();
try {
  mkdirSync(OUT, { recursive: true });
  const files = [...(await capture('vi', 'vi-VN', extensionDir)), ...(await capture('en', 'en-US', extensionDir))];
  for (const f of files) {
    const { width, height } = pngSize(f);
    if (width !== VIEWPORT.width || height !== VIEWPORT.height) throw new Error(`${f} is ${width}x${height}`);
    console.log(`${f.slice(ROOT.length + 1)}  ${width}x${height}`);
  }
} finally {
  rmSync(extensionDir, { recursive: true, force: true });
}
