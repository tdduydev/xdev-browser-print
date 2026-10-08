import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { A5_PROFILE, EXTENSION_DIR, configure, expect, internal, openSite, startSite, test } from './fixtures';

type Win = Window & { XDevBrowserPrint: new (o?: object) => any };

test.describe('extension package', () => {
  test('MV3 manifest loads and the service worker starts', async ({ sw, extensionId }) => {
    const manifest = JSON.parse(readFileSync(join(EXTENSION_DIR, 'manifest.json'), 'utf8'));
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.background).toEqual({ service_worker: 'background.js', type: 'module' });
    expect(manifest.content_scripts).toBeUndefined(); // no page gets the bridge by default
    expect(sw.url()).toBe(`chrome-extension://${extensionId}/background.js`);
  });

  test('admin UI renders all screens in Vietnamese by default', async ({ admin }) => {
    await expect(admin.getByRole('heading', { name: 'Tổng quan' })).toBeVisible();
    for (const screen of ['profiles', 'mappings', 'devices', 'test', 'history', 'sites', 'settings']) {
      await admin.getByTestId(`nav-${screen}`).click();
      await expect(admin.locator('h1').first()).toBeVisible();
    }
    await admin.getByTestId('nav-dashboard').click();
    await expect(admin.getByText('Giới hạn của Chrome')).toBeVisible();
  });

  test('profile and mapping can be created through the admin UI', async ({ admin }) => {
    await admin.getByTestId('nav-profiles').click();
    await admin.getByTestId('profile-add').click();
    await admin.getByTestId('profile-id').fill('printer-a5');
    await admin.getByTestId('profile-name').fill('Máy in đơn thuốc');
    await admin.getByTestId('profile-category').selectOption('A5');
    await admin.getByTestId('profile-save').click();
    await expect(admin.getByRole('cell', { name: 'printer-a5' })).toBeVisible();
    await admin.getByTestId('nav-mappings').click();
    await admin.getByTestId('mapping-doctype').fill('PRESCRIPTION');
    await admin.getByTestId('mapping-save').click();
    await expect(admin.getByRole('cell', { name: 'PRESCRIPTION' })).toBeVisible();
    const { config } = await internal<{ config: { mappings: Record<string, { printerId: string }> } }>(admin, 'config.get');
    expect(config.mappings.PRESCRIPTION?.printerId).toBe('printer-a5');
  });
});

test.describe('website security', () => {
  test('an origin that was never allowed gets no bridge', async ({ context, admin, site }) => {
    await internal(admin, 'profile.upsert', { profile: A5_PROFILE });
    const page = await openSite(context, `${site.origin}/`);
    expect(await page.evaluate(() => new (window as unknown as Win).XDevBrowserPrint({ detectTimeoutMs: 800 }).isInstalled())).toBe(false);
  });

  test('another port on an allowed host is rejected by the service worker', async ({ context, admin, site }) => {
    await configure(admin, site.origin);
    const other = await startSite();
    try {
      const page = await openSite(context, `http://localhost:${other.port}/`);
      const r = await page.evaluate(async () => {
        const c = new (window as unknown as Win).XDevBrowserPrint({ timeoutMs: 3000 });
        const installed = await c.isInstalled();
        const err = await c.getPrinters().catch((e: { code: string }) => e.code);
        return { installed, err };
      });
      // The content script runs (host-level pattern) but the exact origin is not paired.
      expect(r).toEqual({ installed: true, err: 'ORIGIN_NOT_ALLOWED' });
    } finally {
      other.server.close();
    }
  });

  test('scopes are enforced and the configure scope is not granted silently', async ({ context, admin, site }) => {
    await configure(admin, site.origin, ['read']);
    const page = await openSite(context, `${site.origin}/`);
    const r = await page.evaluate(async () => {
      const c = new (window as unknown as Win).XDevBrowserPrint({ scopes: ['read'] });
      await c.connect();
      const printers = await c.getPrinters();
      const print = await c.print({ documentType: 'PRESCRIPTION', format: 'HTML', data: '<p>x</p>' }).catch((e: { code: string }) => e.code);
      const map = await c.saveMapping({ documentType: 'X', printerId: 'printer-a5' }).catch((e: { code: string }) => e.code);
      return { printers: printers.map((p: { id: string }) => p.id), print, map };
    });
    expect(r).toEqual({ printers: ['printer-a5'], print: 'PERMISSION_DENIED', map: 'PERMISSION_DENIED' });
  });

  test('connect() asking for extra scopes opens the approval window; deny keeps the old scopes', async ({ context, admin, site }) => {
    await configure(admin, site.origin, ['read']);
    const page = await openSite(context, `${site.origin}/`);
    const approval = context.waitForEvent('page', (p) => p.url().includes('approve.html'));
    const result = page.evaluate(() => new (window as unknown as Win).XDevBrowserPrint({ scopes: ['read', 'print'] }).connect().then((s: { scopes: string[] }) => s.scopes));
    const win = await approval;
    await expect(win.getByTestId('approve-origin')).toHaveText(site.origin);
    await win.getByTestId('approve-deny').click();
    expect(await result).toEqual(['read']);
  });

  test('approving the request grants the scope', async ({ context, admin, site }) => {
    await configure(admin, site.origin, ['read']);
    const page = await openSite(context, `${site.origin}/`);
    const approval = context.waitForEvent('page', (p) => p.url().includes('approve.html'));
    const result = page.evaluate(() => new (window as unknown as Win).XDevBrowserPrint({ scopes: ['read', 'print'] }).connect().then((s: { scopes: string[] }) => s.scopes));
    await (await approval).getByTestId('approve-allow').click();
    expect((await result).sort()).toEqual(['print', 'read']);
    const { sites } = await internal<{ sites: { origin: string; scopes: string[] }[] }>(admin, 'config.get');
    expect(sites.find((s) => s.origin === site.origin)?.scopes.sort()).toEqual(['print', 'read']);
  });

  test('revoking a site cuts the bridge', async ({ context, admin, site }) => {
    await configure(admin, site.origin);
    const page = await openSite(context, `${site.origin}/`);
    await page.evaluate(() => new (window as unknown as Win).XDevBrowserPrint().connect());
    await internal(admin, 'sites.remove', { origin: site.origin });
    const code = await page.evaluate(() => new (window as unknown as Win).XDevBrowserPrint().getPrinters().catch((e: { code: string }) => e.code));
    expect(code).toBe('ORIGIN_NOT_ALLOWED');
  });
});

test.describe('printing', () => {
  test('HTML job opens the print window and ends UNKNOWN/PRINT_DIALOG_CLOSED', async ({ context, admin, site }) => {
    await configure(admin, site.origin);
    const page = await openSite(context, `${site.origin}/`);
    const runner = context.waitForEvent('page', (p) => p.url().includes('print.html'));
    const job = page.evaluate(async () => {
      const c = new (window as unknown as Win).XDevBrowserPrint();
      await c.connect();
      return c.print({ documentType: 'PRESCRIPTION', format: 'HTML', data: '<h1>Đơn thuốc</h1><script>window.pwned=1</script>' });
    });
    const win = await runner;
    // Site HTML is rendered sanitized in a sandboxed frame.
    const frame = win.frameLocator('iframe.print-frame');
    await expect(frame.locator('h1')).toHaveText('Đơn thuốc');
    expect(await win.evaluate(() => document.querySelector('iframe')?.getAttribute('sandbox'))).toBe('allow-same-origin allow-modals');
    expect(await win.evaluate(() => (document.querySelector('iframe')!.contentDocument!.querySelector('script')))).toBeNull();
    expect(await job).toMatchObject({ state: 'UNKNOWN', outcome: 'PRINT_DIALOG_CLOSED', adapter: 'browser', profileId: 'printer-a5' });
  });

  test('PDF job is accepted and reaches a terminal state', async ({ context, admin, site }) => {
    await configure(admin, site.origin);
    const page = await openSite(context, `${site.origin}/`);
    const status = await page.evaluate(async () => {
      const pdf = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF';
      const c = new (window as unknown as Win).XDevBrowserPrint();
      await c.connect();
      return c.printPdf('PRESCRIPTION', new Blob([pdf], { type: 'application/pdf' }));
    });
    expect(['UNKNOWN', 'SUBMITTED']).toContain(status.state);
    expect(status.format).toBe('PDF');
  });

  test('same idempotency key never prints twice', async ({ context, admin, site }) => {
    await configure(admin, site.origin);
    const page = await openSite(context, `${site.origin}/`);
    const r = await page.evaluate(async () => {
      const c = new (window as unknown as Win).XDevBrowserPrint();
      await c.connect();
      const opts = { documentType: 'PRESCRIPTION', format: 'HTML', data: '<p>x</p>', idempotencyKey: 'order-42:rx' };
      const a = await c.print(opts);
      const b = await c.print(opts);
      return [a.jobId, b.jobId];
    });
    expect(r[0]).toBe(r[1]);
    const jobs = await internal<unknown[]>(admin, 'jobs.list', { limit: 50 });
    expect(jobs).toHaveLength(1);
  });

  test('invalid documents are rejected with clear codes', async ({ context, admin, site }) => {
    await configure(admin, site.origin);
    const page = await openSite(context, `${site.origin}/`);
    const codes = await page.evaluate(async () => {
      const c = new (window as unknown as Win).XDevBrowserPrint();
      await c.connect();
      const err = (p: Promise<unknown>) => p.then(() => 'ok', (e: { code: string }) => e.code);
      return {
        notPdf: await err(c.printPdf('PRESCRIPTION', new Blob(['hello']))),
        unmapped: await err(c.print({ documentType: 'UNKNOWN_DOC', format: 'HTML', data: '<p>' })),
        rawToBrowser: await err(c.printRaw('PRESCRIPTION', 'ZPL', '^XA^XZ')),
        badType: await err(c.print({ documentType: 'lower', format: 'HTML', data: '<p>' })),
      };
    });
    expect(codes).toEqual({ notPdf: 'INVALID_REQUEST', unmapped: 'MAPPING_NOT_FOUND', rawToBrowser: 'UNSUPPORTED_FORMAT', badType: 'INVALID_REQUEST' });
  });

  test('history keeps metadata only, never document content', async ({ context, admin, site }) => {
    await configure(admin, site.origin);
    const page = await openSite(context, `${site.origin}/`);
    await page.evaluate(async () => {
      const c = new (window as unknown as Win).XDevBrowserPrint();
      await c.connect();
      await c.print({ documentType: 'PRESCRIPTION', format: 'HTML', data: '<p>BENH NHAN NGUYEN VAN A</p>' });
    });
    const jobs = await internal(admin, 'jobs.list', { limit: 10 });
    expect(JSON.stringify(jobs)).not.toContain('NGUYEN VAN A');
    await admin.getByTestId('nav-history').click();
    await expect(admin.getByTestId('history-table')).toContainText('PRESCRIPTION');
    await expect(admin.getByTestId('history-table')).not.toContainText('NGUYEN VAN A');
  });
});

test.describe('resilience', () => {
  test('requests keep working after the service worker is stopped', async ({ context, admin, site, sw }) => {
    await configure(admin, site.origin);
    // Marker that only lives in the worker's memory: if it survives, the worker never restarted.
    await sw.evaluate(() => ((globalThis as { __marker?: number }).__marker = 1));
    const page = await openSite(context, `${site.origin}/`);
    await page.evaluate(async () => {
      (window as any).client = new (window as unknown as Win).XDevBrowserPrint();
      await (window as any).client.connect();
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send('ServiceWorker.enable');
    await cdp.send('ServiceWorker.stopAllWorkers');
    // First call may race the port teardown; the SDK surfaces it and the next call reconnects.
    const results = await page.evaluate(async () => {
      const out: string[] = [];
      for (let i = 0; i < 3; i++) {
        out.push(await (window as any).client.getPrinters().then((p: unknown[]) => `ok:${p.length}`, (e: { code: string }) => e.code));
        await new Promise((r) => setTimeout(r, 300));
      }
      return out;
    });
    expect(results.at(-1)).toBe('ok:1');
    const fresh = context.serviceWorkers().at(-1)!;
    expect(await fresh.evaluate(() => (globalThis as { __marker?: number }).__marker)).toBeUndefined();
  });

  test('rate limit stops print spam from one site', async ({ context, admin, site }) => {
    await configure(admin, site.origin);
    await internal(admin, 'settings.update', { patch: { rateLimitJobs: 3, rateLimitWindowMs: 60_000 } });
    const page = await openSite(context, `${site.origin}/`);
    const codes = await page.evaluate(async () => {
      const c = new (window as unknown as Win).XDevBrowserPrint();
      await c.connect();
      const out: string[] = [];
      for (let i = 0; i < 5; i++) {
        out.push(await c.print({ documentType: 'PRESCRIPTION', format: 'HTML', data: '<p>x</p>', wait: 'accepted' }).then(() => 'ok', (e: { code: string }) => e.code));
      }
      return out;
    });
    expect(codes).toEqual(['ok', 'ok', 'ok', 'RATE_LIMITED', 'RATE_LIMITED']);
  });
});
