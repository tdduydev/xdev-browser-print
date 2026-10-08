// End-to-end showcase: drives a built web app that uses @tdduydev/browser-print against the
// real extension (dist-e2e build), asserts every state on the way and writes 1280x800 screenshots.
//
// Usage:
//   pnpm showcase [path/to/app/dist]          (or SHOWCASE_APP_DIR=path/to/app/dist pnpm showcase)
// Without a path it uses examples/react-demo/dist (the demo built against the workspace SDK).
// The app must be built from examples/react-demo/src (it relies on the same data-testid hooks).
// Output: docs/images/showcase/*.png (override with SHOWCASE_OUT). Exits non-zero on any failed check.
//
// Only demo data is used: a fake clinic ("Phòng khám Demo") and a fake patient.
// Lives in scripts/, not tests/e2e/, so Playwright test discovery never picks it up.
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium, expect as baseExpect } from '@playwright/test';

const ROOT = join(import.meta.dirname, '..');
const EXTENSION_DIR = join(ROOT, 'apps/extension/dist-e2e');
const APP_DIR = resolve(process.argv[2] ?? process.env.SHOWCASE_APP_DIR ?? join(ROOT, 'examples/react-demo/dist'));
const OUT = resolve(process.env.SHOWCASE_OUT ?? join(ROOT, 'docs/images/showcase'));
const VIEWPORT = { width: 1280, height: 800 };
const TIMEOUT = 15_000;
const expect = baseExpect.configure({ timeout: TIMEOUT });

const PROFILES = [
  {
    id: 'printer-a5',
    name: 'Máy in đơn thuốc A5',
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
    name: 'Máy in hoá đơn K80',
    adapter: 'webusb',
    category: 'K80',
    paperSize: 'K80',
    orientation: 'portrait',
    copies: 1,
    marginsMm: { top: 0, right: 0, bottom: 0, left: 0 },
    encoding: 'utf-8',
    autoCut: true,
    // No such device is plugged in during the run: the receipt job is expected to fail.
    device: { kind: 'usb', vendorId: 0x0416, productId: 0x5011 },
  },
];

const MAPPINGS = [
  { documentType: 'PRESCRIPTION', printerId: 'printer-a5' },
  { documentType: 'RECEIPT', printerId: 'printer-k80' },
  { documentType: 'INVOICE', printerId: 'printer-k80' },
];

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.map': 'application/json' };

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

async function internal(page, type, req = {}) {
  const r = await page.evaluate(([t, body]) => chrome.runtime.sendMessage({ type: t, ...body }), [type, req]);
  if (!r?.ok) throw new Error(`${type}: ${r?.error?.code} ${r?.error?.message}`);
  return r.result;
}

/** Reads width/height from the PNG IHDR chunk, so the size check needs no image library. */
function pngSize(file) {
  const b = readFileSync(file);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

const shots = [];
async function shot(page, name, description) {
  const file = join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  const { width, height } = pngSize(file);
  if (width !== VIEWPORT.width || height !== VIEWPORT.height) throw new Error(`${name}.png is ${width}x${height}, expected 1280x800`);
  shots.push({ file, width, height, description });
}

/**
 * Windows smaller than the showcase frame (the 480x600 approval popup, the 340 px toolbar popup)
 * are captured at their real size and placed over a capture of the app, so the image shows them
 * the way a user sees them instead of stretched to 1280x800. Both layers are real renders.
 */
async function composite(context, name, description, background, foreground, { x, y, dim }) {
  const page = await context.newPage();
  const src = (b) => `data:image/png;base64,${b.toString('base64')}`;
  await page.setContent(`<body style="margin:0;overflow:hidden">
    <img src="${src(background)}" style="position:absolute;left:0;top:0;width:1280px;height:800px">
    ${dim ? '<div style="position:absolute;inset:0;background:rgba(15,23,42,.35)"></div>' : ''}
    <img id="fg" src="${src(foreground)}" style="position:absolute;left:${x}px;top:${y}px;border:1px solid #cbd5e1;border-radius:8px;box-shadow:0 12px 40px rgba(15,23,42,.35)">
  </body>`);
  await page.locator('#fg').evaluate((img) => img.decode());
  await shot(page, name, description);
  await page.close();
}

const checks = [];
async function check(label, fn) {
  await fn();
  checks.push(label);
  console.log(`  ok  ${label}`);
}

for (const [what, path] of [['extension build (pnpm --filter @xdev/browser-print-extension build:e2e)', join(EXTENSION_DIR, 'manifest.json')], ['app build', join(APP_DIR, 'index.html')]]) {
  if (!existsSync(path)) {
    console.error(`Missing ${what}: ${path}`);
    process.exit(1);
  }
}
mkdirSync(OUT, { recursive: true });
console.log(`app: ${APP_DIR}\nextension: ${EXTENSION_DIR}\nout: ${OUT}`);

const { server, port } = await serve(APP_DIR);
const origin = `http://localhost:${port}`;
const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: true,
  viewport: VIEWPORT,
  deviceScaleFactor: 1,
  locale: 'vi-VN',
  timezoneId: 'Asia/Ho_Chi_Minh',
  args: [`--disable-extensions-except=${EXTENSION_DIR}`, `--load-extension=${EXTENSION_DIR}`],
});


let failed = false;
try {
  const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const extensionId = new URL(sw.url()).host;
  // The extension opens its options page on install; close it so only our pages remain.
  await new Promise((r) => setTimeout(r, 500));
  for (const p of context.pages()) await p.close();

  // print.html closes itself 1.5 s after the dialog returns, which is too short for a stable
  // screenshot. Keep only the top-level print window open; the job result is reported before
  // close() would run, so this does not change what the app sees.
  await context.addInitScript(() => {
    if (location.pathname.endsWith('/print.html') && window.top === window) window.close = () => undefined;
  });

  const admin = await context.newPage();
  const optionsUrl = `chrome-extension://${extensionId}/options.html`;
  await admin.goto(optionsUrl);
  for (const p of PROFILES) await internal(admin, 'profile.upsert', { profile: { ...p, createdAt: Date.now(), updatedAt: Date.now() } });
  for (const m of MAPPINGS) await internal(admin, 'mapping.save', { params: m });
  // Only "read" is pre-granted, so Connect (which asks for read + print) shows the approval window.
  await internal(admin, 'sites.add', { origin, scopes: ['read'], confirmEachJob: false, label: 'Phòng khám Demo' });
  const { config } = await internal(admin, 'config.get');
  console.log(`extension ${extensionId}, language ${config.settings.language}, site ${origin}`);

  // 1. App before connecting.
  const app = await context.newPage();
  await app.goto(`${origin}/`);
  await check('app detects the extension (State: ready)', () => expect(app.getByTestId('state')).toHaveText('State: ready'));
  await shot(app, '01-app-connect', 'The app (built with @tdduydev/browser-print) detects the extension and offers Connect.');

  // 2. Connect asks for the print scope: the extension opens its approval window.
  const appBeforeConnect = await app.screenshot();
  const approvalOpened = context.waitForEvent('page', { predicate: (p) => p.url().includes('approve.html'), timeout: TIMEOUT });
  await app.getByTestId('connect').click();
  const approval = await approvalOpened;
  await check('approval window names the requesting origin', () => expect(approval.getByTestId('approve-origin')).toHaveText(origin));
  // Same size as the window the extension opens (background/approvals.ts).
  await approval.setViewportSize({ width: 480, height: 600 });
  await approval.waitForLoadState('networkidle');
  await composite(context, '02-approval', 'The extension approval window (real 480x600 render, over the app) asks to grant the print scope to this exact origin.', appBeforeConnect, await approval.screenshot(), { x: 400, y: 100, dim: true });
  await approval.getByTestId('approve-allow').click();

  // 3. Connected, printers listed.
  await app.bringToFront();
  await check('app is connected (State: connected)', () => expect(app.getByTestId('state')).toHaveText('State: connected'));
  await check('printer list shows both profiles', async () => {
    await expect(app.getByText('Máy in đơn thuốc A5')).toBeVisible();
    await expect(app.getByText(/Máy in hoá đơn K80/)).toBeVisible();
  });
  await check('session holds read + print', () => expect(app.getByText(/scopes: read, print|scopes: print, read/)).toBeVisible());
  await shot(app, '03-connected', 'Connected: the session shows the granted scopes and the printers configured in the extension.');

  // 4. Print the A5 prescription: the extension renders it in its print window.
  await app.getByTestId('tab-prescription').click();
  const printOpened = context.waitForEvent('page', { predicate: (p) => p.url().includes('print.html'), timeout: TIMEOUT });
  await app.getByTestId('print').click();
  const printWin = await printOpened;
  const frame = printWin.frameLocator('iframe.print-frame');
  await check('print window renders the prescription', () => expect(frame.locator('h1')).toHaveText('Đơn thuốc'));
  await check('print window reports the dialog closed', () => expect(printWin.locator('#status')).toHaveText('Hộp thoại in đã đóng.'));
  // The real window keeps the rendered document in a 1 px hidden stage because Chrome's native
  // print dialog (which headless Chromium cannot show) is what previews it. For the screenshot,
  // that same sanitized frame is made visible at A5 size (148x210 mm) with the profile margins.
  await printWin.addStyleTag({
    content: `body { background: #e5e7eb; }
      .runner { justify-items: start; text-align: left; padding: 64px 0 0 120px; width: 420px; }
      #stage { left: auto; right: 120px; top: 24px; width: 559px; height: 794px; opacity: 1; transform: scale(.94); transform-origin: top right; background: #fff; box-shadow: 0 8px 30px rgba(0,0,0,.25); }
      .print-frame { width: 559px; height: 794px; }`,
  });
  await printWin.locator('iframe.print-frame').evaluate((f) => f.contentDocument.head.insertAdjacentHTML('beforeend', '<style>body { margin: 8mm; }</style>'));
  await printWin.waitForTimeout(300);
  await shot(printWin, '04-print-preview', 'The extension print window with the A5 prescription it rendered (sanitized, sandboxed frame; made visible for the screenshot).');

  // 5. Job outcome back in the app.
  await app.bringToFront();
  await check('prescription job ends UNKNOWN / PRINT_DIALOG_CLOSED', async () => {
    await expect(app.getByTestId('job-state')).toHaveText('UNKNOWN');
    await expect(app.getByTestId('job-outcome')).toHaveText('PRINT_DIALOG_CLOSED');
  });
  await shot(app, '05-job-status', 'Back in the app: the job ends UNKNOWN / PRINT_DIALOG_CLOSED (Chrome does not report whether the user printed).');
  await printWin.close();

  // 6. Thermal receipt to a USB profile with no device attached.
  await app.getByTestId('tab-receipt').click();
  const receiptStart = Date.now();
  await app.getByTestId('print').click();
  await check('receipt job to the K80 USB profile fails without a device', async () => {
    await expect(app.getByTestId('job-state')).toHaveText('FAILED');
    await expect(app.getByTestId('job-error')).toHaveText(process.env.SHOWCASE_THERMAL_ERROR ?? 'DEVICE_NOT_FOUND');
    await expect(app.getByTestId('print')).toBeEnabled();
  });
  const thermal = await app.getByTestId('job').textContent();
  const thermalError = await app.getByRole('alert').textContent().catch(() => '');
  console.log(`  receipt job after ${Date.now() - receiptStart} ms: ${thermal} | ${thermalError}`);
  await shot(app, '06-thermal-error', 'A K80 receipt to a USB profile with no printer plugged in fails with a clear error code.');

  // 7. Options page: mappings and job history.
  for (const [screen, name, description] of [
    ['mappings', '07-admin-mappings', 'Options page: document types mapped to printer profiles.'],
    ['history', '08-admin-jobs', 'Options page: the job history (metadata only) shows both jobs from this run.'],
  ]) {
    await admin.bringToFront();
    await admin.goto(`${optionsUrl}#${screen}`);
    await admin.reload();
    await admin.locator(`[data-testid="nav-${screen}"].active`).waitFor();
    await admin.waitForLoadState('networkidle');
    if (screen === 'mappings') {
      await check('mappings screen lists PRESCRIPTION', () => expect(admin.getByText('PRESCRIPTION').first()).toBeVisible());
    } else {
      const table = admin.getByTestId('history-table');
      await check('history lists the prescription and receipt jobs', async () => {
        await expect(table.getByText('PRESCRIPTION')).toBeVisible();
        await expect(table.getByText('RECEIPT')).toBeVisible();
      });
      const jobs = await internal(admin, 'jobs.list', { limit: 10 });
      await check('worker job records match the app (receipt failed after 3 attempts)', () => {
        const byType = Object.fromEntries(jobs.map((j) => [j.documentType, j]));
        expect(byType.PRESCRIPTION).toMatchObject({ state: 'UNKNOWN', outcome: 'PRINT_DIALOG_CLOSED', adapter: 'browser', profileId: 'printer-a5', origin });
        // DEVICE_NOT_FOUND is retryable: the job manager tries 3 times (1 s, 3 s apart) before failing.
        expect(byType.RECEIPT).toMatchObject({ state: 'FAILED', outcome: 'DEVICE_NOT_FOUND', errorCode: 'DEVICE_NOT_FOUND', attempts: 3, adapter: 'webusb', profileId: 'printer-k80', origin });
      });
    }
    await admin.waitForTimeout(300);
    await shot(admin, name, description);
  }

  // 8. Toolbar popup for the app's origin. Playwright cannot open the real action popup, so the
  // popup page is loaded in a tab with chrome.tabs.query pointed at the app (as the e2e test does).
  await app.bringToFront();
  const appNow = await app.screenshot();
  const popup = await context.newPage();
  await popup.addInitScript((url) => {
    chrome.tabs.query = async () => [{ url }];
  }, `${origin}/`);
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await check('popup shows the site as allowed with read, print', () => expect(popup.getByText(/read, print|print, read/)).toBeVisible());
  await popup.waitForLoadState('networkidle');
  await composite(context, '09-popup', 'The toolbar popup (real render, over the app): this origin is allowed with read, print and can be revoked.', appNow, await popup.locator('.popup').screenshot(), { x: 1280 - 340 - 24, y: 8, dim: false });
} catch (e) {
  failed = true;
  console.error(`\nFAILED after ${checks.length} checks: ${e?.message ?? e}`);
} finally {
  await context.close();
  server.close();
}

console.log(`\n${checks.length} checks passed${failed ? ', then one failed' : ''}.`);
for (const s of shots) console.log(`${s.file.startsWith(ROOT) ? s.file.slice(ROOT.length + 1) : s.file}  ${s.width}x${s.height}  ${s.description}`);
process.exit(failed ? 1 : 0);
