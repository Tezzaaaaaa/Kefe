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
      const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block' });
      const page = await context.newPage(), errors = [];
      await page.addInitScript(() => {
        const observer = new MutationObserver(() => {
          const button = document.getElementById('kefeMuteToggle');
          const popover = document.getElementById('kefeVolumePopover');
          const slider = document.getElementById('kefeVolume');
          if (button && popover && slider) { window.__volumeElements = [button, popover, slider]; observer.disconnect(); }
        });
        observer.observe(document, { childList: true, subtree: true });
      });
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error' && /hydrat|react error/i.test(message.text())) errors.push(message.text()); });
      await page.goto(`http://127.0.0.1:${server.address().port}/editor.html`);
      await page.waitForSelector('.kefe-volume-control[data-shadcn-hydrated="true"]');
      assert.equal(await page.evaluate(() => window.__volumeElements.every(element => document.getElementById(element.id) === element)), true, 'volume nodes retained');
      const trigger = page.locator('#kefeMuteToggle'), popover = page.locator('#kefeVolumePopover');
      assert.equal(await trigger.getAttribute('data-slot'), 'button');
      assert.equal(await trigger.getAttribute('data-variant'), 'ghost');
      const box = await trigger.boundingBox();
      assert.ok(box && box.x >= 0 && box.x + box.width <= width + 1, 'volume button fits viewport');
      await trigger.click();
      assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
      await popover.waitFor({ state: 'visible' });
      assert.equal(await popover.isVisible(), true);
      assert.equal(await popover.evaluate(el => Boolean(el.closest('.kefe-volume-control'))), false, 'volume popover must escape the clipping control container');
      const popoverBox = await popover.boundingBox();
      assert.ok(popoverBox && popoverBox.x >= 0 && popoverBox.y >= 0 && popoverBox.x + popoverBox.width <= width + 1 && popoverBox.y + popoverBox.height <= 844 + 1, 'volume popover must remain fully visible in the viewport');
      const slider = popover.getByRole('slider', { name: 'Audio volume' });
      assert.equal(await slider.getAttribute('data-slot'), 'slider-thumb');
      await slider.focus(); await page.keyboard.press('Home');
      await page.waitForFunction(() => document.getElementById('kefeVolumeValue').textContent === '0%');
      assert.equal(await page.evaluate(() => document.getElementById('kefeAudio').volume), 0);
      await page.keyboard.press('End');
      await page.waitForFunction(() => document.getElementById('kefeVolumeValue').textContent === '100%');
      assert.equal(await page.evaluate(() => document.getElementById('kefeAudio').volume), 1);
      await page.keyboard.press('Escape');
      assert.equal(await popover.isHidden(), true);
      assert.equal(await page.evaluate(() => document.activeElement.id), 'kefeMuteToggle');
      await trigger.focus(); await page.keyboard.press('Enter');
      assert.equal(await popover.isVisible(), true);
      await page.keyboard.press('Escape');
      assert.deepEqual(errors, [], `no page or hydration errors at ${width}px`);
      await context.close();
    }
    console.log('PASS: shadcn volume trigger retains native nodes, slider, keyboard and focus behavior');
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
