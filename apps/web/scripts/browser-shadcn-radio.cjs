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
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error' && /hydrat|react error/i.test(message.text())) errors.push(message.text()); });
      await page.goto(`http://127.0.0.1:${server.address().port}/editor.html`);
      await page.waitForSelector('#kefeDisplayGroup [data-shadcn-radio-mounted]', { state: 'attached' });
      await page.locator('[data-workspace-tab="design"]').evaluate(node => node.click());
      await page.locator('#kefe-subtab-lyric-effects').evaluate(node => node.click());
      const group = page.getByRole('radiogroup', { name: 'Lyric display mode' });
      assert.equal(await group.getAttribute('data-slot'), 'radio-group');
      const line = group.getByRole('radio', { name: 'Line' });
      const word = group.getByRole('radio', { name: 'Word' });
      const chunk = group.getByRole('radio', { name: 'Chunk' });
      assert.equal(await line.getAttribute('aria-checked'), 'true');
      assert.equal(await line.getAttribute('data-slot'), 'radio-group-item');
      const radioBox = await line.boundingBox();
      assert.ok(radioBox.width >= 15 && radioBox.width <= 17 && radioBox.height >= 15 && radioBox.height <= 17, 'shadcn radio retains its circular dimensions');
      const box = await group.boundingBox();
      assert.ok(box && box.x >= 0 && box.x + box.width <= width + 1, 'radio group fits viewport');
      await group.locator('label').filter({ hasText: 'Chunk' }).click();
      await page.waitForFunction(() => window.kefeLyricStudio.settings().mode === 'chunk');
      assert.equal(await chunk.getAttribute('aria-checked'), 'true');
      assert.equal(await page.getByText('Words per chunk', { exact: true }).isVisible(), true);
      await chunk.focus(); await page.keyboard.press('ArrowLeft');
      await page.waitForFunction(() => window.kefeLyricStudio.settings().mode === 'word');
      assert.equal(await word.getAttribute('aria-checked'), 'true');
      assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Word');
      await page.evaluate(() => { document.querySelector('#kefeDisplayGroup [data-mode="line"]').disabled = true; });
      await page.waitForFunction(() => document.querySelector('.shad-lyric-display-options [aria-label="Line"]')?.disabled);
      await page.evaluate(() => { document.querySelector('#kefeDisplayGroup [data-mode="line"]').disabled = false; });
      await page.waitForFunction(() => !document.querySelector('.shad-lyric-display-options [aria-label="Line"]')?.disabled);
      await page.evaluate(() => document.querySelector('#kefeDisplayGroup [data-mode="line"]').click());
      await page.waitForFunction(() => document.querySelector('.shad-lyric-display-options [aria-label="Line"]')?.getAttribute('aria-checked') === 'true');
      await page.evaluate(() => window.kefeLyricStudio.applySettings({ mode: 'chunk', chunk: 5, caseMode: 'upper' }));
      await page.waitForFunction(() => document.querySelector('.shad-lyric-display-options [aria-label="Chunk"]')?.getAttribute('aria-checked') === 'true');
      assert.equal(await page.locator('#kefeDisplayGroup output').first().textContent(), '5');
      assert.equal(await page.locator('#lyricCase').inputValue(), 'upper', 'programmatic settings update their native select');
      await page.reload();
      await page.locator('[data-workspace-tab="design"]').evaluate(node => node.click());
      await page.locator('#kefe-subtab-lyric-effects').evaluate(node => node.click());
      await page.waitForFunction(() => document.querySelector('.shad-lyric-display-options [aria-label="Chunk"]')?.getAttribute('aria-checked') === 'true');
      assert.equal(await page.evaluate(() => window.kefeLyricStudio.settings().chunk), 5);
      assert.deepEqual(errors, [], `no page or hydration errors at ${width}px`);
      await context.close();
    }
    console.log('PASS: shadcn lyric display radio group, keyboard, backing controls, API and persistence on desktop and mobile');
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
