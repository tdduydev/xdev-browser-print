import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { test as base, chromium, type BrowserContext, type Page, type Worker } from '@playwright/test';

const ROOT = join(import.meta.dirname, '..', '..');
export const EXTENSION_DIR = join(ROOT, 'apps/extension/dist-e2e');
const SDK_DIR = join(ROOT, 'packages/browser-print-sdk/dist');
const SITE_DIR = join(import.meta.dirname, 'site');

const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.map': 'application/json' };

/** Static server for the test site and the built SDK. */
export function startSite(): Promise<{ server: Server; port: number }> {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const [dir, rel] = url.pathname.startsWith('/sdk/') ? [SDK_DIR, url.pathname.slice(5)] : [SITE_DIR, url.pathname === '/' ? 'index.html' : url.pathname.slice(1)];
    const file = normalize(join(dir, rel));
    if (!file.startsWith(dir)) return res.writeHead(403).end();
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: (server.address() as { port: number }).port })));
}

interface Fixtures {
  context: BrowserContext;
  sw: Worker;
  extensionId: string;
  site: { port: number; origin: string };
  admin: Page;
}

export const test = base.extend<Fixtures>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: true,
      args: [`--disable-extensions-except=${EXTENSION_DIR}`, `--load-extension=${EXTENSION_DIR}`],
    });
    await use(context);
    await context.close();
  },
  sw: async ({ context }, use) => {
    const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    await use(sw);
  },
  extensionId: async ({ sw }, use) => {
    await use(new URL(sw.url()).host);
  },
  site: async ({}, use) => {
    const { server, port } = await startSite();
    await use({ port, origin: `http://localhost:${port}` });
    server.close();
  },
  admin: async ({ context, extensionId }, use) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await use(page);
  },
});

export const expect = test.expect;

/** Calls the service worker's internal API the way an extension page does. */
export async function internal<T = unknown>(admin: Page, type: string, req: Record<string, unknown> = {}): Promise<T> {
  const reply = await admin.evaluate(([t, r]) => chrome.runtime.sendMessage({ type: t, ...r }), [type, req] as const);
  const r = reply as { ok: boolean; result?: T; error?: { code: string; message: string } };
  if (!r.ok) throw new Error(`${r.error?.code}: ${r.error?.message}`);
  return r.result as T;
}

export const A5_PROFILE = {
  id: 'printer-a5',
  name: 'Máy in đơn thuốc',
  adapter: 'browser',
  category: 'A5',
  paperSize: 'A5',
  orientation: 'portrait',
  copies: 1,
  marginsMm: { top: 8, right: 8, bottom: 8, left: 8 },
  encoding: 'utf-8',
  autoCut: false,
  createdAt: 0,
  updatedAt: 0,
};

export async function configure(admin: Page, origin: string, scopes = ['read', 'print']) {
  await internal(admin, 'profile.upsert', { profile: A5_PROFILE });
  await internal(admin, 'mapping.save', { params: { documentType: 'PRESCRIPTION', printerId: 'printer-a5' } });
  await internal(admin, 'sites.add', { origin, scopes, confirmEachJob: false });
}

export async function openSite(context: BrowserContext, url: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(url);
  await page.waitForFunction(() => (window as unknown as { sdkReady?: boolean }).sdkReady === true);
  return page;
}
