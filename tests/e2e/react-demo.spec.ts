import { DEMO_DIR, configure, expect, startSite, test } from './fixtures';

// Smoke test for examples/react-demo: the built app detects the extension, pairs and sends one HTML job.
test('React demo pairs and prints the A5 prescription', async ({ context, admin }) => {
  const demo = await startSite(DEMO_DIR);
  try {
    const origin = `http://localhost:${demo.port}`;
    await configure(admin, origin);
    const page = await context.newPage();
    await page.goto(`${origin}/`);
    await expect(page.getByTestId('state')).toHaveText('State: ready');
    await page.getByTestId('connect').click();
    await expect(page.getByTestId('state')).toHaveText('State: connected');
    await expect(page.getByText('Máy in đơn thuốc')).toBeVisible();

    const runner = context.waitForEvent('page', (p) => p.url().includes('print.html'));
    await page.getByTestId('tab-prescription').click();
    await page.getByTestId('print').click();
    const win = await runner;
    await expect(win.frameLocator('iframe.print-frame').locator('h1')).toHaveText('Đơn thuốc');
    await expect(page.getByTestId('job-state')).toHaveText('UNKNOWN');
    await expect(page.getByTestId('job-outcome')).toHaveText('PRINT_DIALOG_CLOSED');
    await expect(page.getByTestId('print')).toBeEnabled();
  } finally {
    demo.server.close();
  }
});
