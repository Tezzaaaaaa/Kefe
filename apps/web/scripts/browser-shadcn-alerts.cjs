const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../dist-beui');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
(async () => {
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}) });
    for (const width of [1440, 390, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error' && /hydrat|react error/i.test(message.text())) errors.push(message.text()); });
      await page.goto(`http://127.0.0.1:${server.address().port}/editor.html`);
      await page.waitForFunction(() => window.kefeAlert?.shadcn);
      await page.evaluate(() => {
        window.__alertA = window.kefeAlert('<b>Untrusted text</b>', { title: 'Information', variant: 'success', duration: 0 });
        window.__alertB = window.kefeAlert('Check this setting', { title: 'Attention', variant: 'warning', duration: 0 });
      });
      const info = page.getByRole('status').filter({ hasText: 'Untrusted text' });
      const warning = page.getByRole('alert').filter({ hasText: 'Check this setting' });
      assert.equal(await info.getAttribute('data-slot'), 'alert');
      assert.equal(await info.getAttribute('aria-live'), 'polite');
      assert.equal(await info.locator('[data-slot="alert-title"]').textContent(), 'Information');
      assert.equal(await info.locator('[data-slot="alert-description"]').textContent(), '<b>Untrusted text</b>');
      assert.equal(await info.locator('b').count(), 0, 'untrusted content is escaped');
      assert.equal(await warning.getAttribute('aria-live'), 'assertive');
      assert.equal(await warning.getByRole('button', { name: 'Dismiss notification' }).getAttribute('data-slot'), 'button');
      assert.equal(await page.evaluate(() => window.__alertA.element === document.querySelector('.kefe-alert-success')), true, 'API returns the actual alert element');
      for (const alert of [info, warning]) {
        const box = await alert.boundingBox();
        assert.ok(box && box.x >= 0 && box.x + box.width <= width + 1, 'alert fits viewport');
      }
      await warning.getByRole('button', { name: 'Dismiss notification' }).focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => !document.querySelector('.kefe-alert-warning'));
      assert.equal(await info.isVisible(), true, 'dismissing one alert leaves the other');
      await page.evaluate(() => { window.__alertA.dismiss(); window.__alertA.dismiss(); });
      await page.waitForFunction(() => !document.querySelector('.kefe-alert-success'));
      await page.evaluate(() => {
        const removed = window.kefeAlert('Removed externally', { duration: 0 });
        removed.element.remove(); removed.dismiss();
      });
      await page.waitForFunction(() => !document.querySelector('.shad-alert-mount'));
      await page.evaluate(() => { window.__alertC = window.kefeAlert('Timed alert', { variant: 'destructive', duration: 1 }); });
      const error = page.getByRole('alert').filter({ hasText: 'Timed alert' });
      assert.equal(await error.getAttribute('aria-live'), 'assertive');
      await error.waitFor({ state: 'detached', timeout: 5000 });
      assert.deepEqual(errors, [], `no page or React errors at ${width}px`);
      await context.close();
    }
    console.log('PASS: shadcn Alert API, accessible variants, escaping, keyboard dismissal, timers and responsive layout');
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
