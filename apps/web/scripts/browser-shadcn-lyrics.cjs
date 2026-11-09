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
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block' });
      const page = await context.newPage(), errors = [];
      await page.addInitScript(() => {
        const observer = new MutationObserver(() => {
          if (document.getElementById('lyricsInput')) { window.__originalLyricsInput = document.getElementById('lyricsInput'); observer.disconnect(); }
        });
        observer.observe(document, { childList: true, subtree: true });
      });
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error' && /hydrat|react error/i.test(message.text())) errors.push(message.text()); });
      await page.goto(`http://127.0.0.1:${server.address().port}/editor.html`);
      await page.waitForSelector('#lyricsInput[data-shadcn-hydrated="true"]', { state: 'attached' });
      assert.equal(await page.evaluate(() => document.getElementById('lyricsInput') === window.__originalLyricsInput), true, 'textarea hydration retains the editor input');
      // Version 1 projects saved before this migration remain readable.
      await page.evaluate(async () => {
        const speed = document.querySelector('[data-fluid-key="speed"]');
        speed.value = '1.4'; speed.dispatchEvent(new Event('input', { bubbles: true }));
        await window.kefeProjectAutosave.saveNow();
        const key = 'kefe.project.autosave.v1', saved = JSON.parse(localStorage.getItem(key));
        saved.version = 1; localStorage.setItem(key, JSON.stringify(saved));
      });
      await page.reload();
      await page.waitForFunction(() => window.kefeProjectAutosave && document.getElementById('lyricsInput')?.dataset.shadcnHydrated === 'true');
      await page.evaluate(() => window.kefeProjectAutosave.ready);
      assert.equal(await page.locator('[data-fluid-key="speed"]').inputValue(), '1.4', 'version 1 autosaves still restore');
      await page.locator('[data-workspace-tab="content"]').evaluate(node => node.click());
      await page.locator('#kefe-subtab-lyric-sync').evaluate(node => node.click());
      const lyrics = page.getByRole('textbox', { name: 'Lyrics', exact: true });
      assert.equal(await lyrics.getAttribute('data-slot'), 'textarea');
      assert.equal(await page.locator('label[for="lyricsInput"]').count(), 1);
      const bounds = await lyrics.boundingBox();
      assert.ok(bounds && bounds.width > 0 && bounds.x >= 0 && bounds.x + bounds.width <= width + 1, 'textarea fits viewport');
      await page.getByRole('radio', { name: 'Left align fetched lyrics' }).click();
      assert.equal(await lyrics.evaluate(node => node.style.textAlign), 'left', 'alignment controls still update original input');
      const alignment = page.getByRole('radiogroup', { name: 'Fetched lyrics alignment' });
      assert.equal(await alignment.getAttribute('data-slot'), 'radio-group');
      await alignment.getByRole('radio', { name: 'Left align fetched lyrics' }).focus();
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() => window.kefeLyricStudio.alignment() === 'center');
      assert.equal(await lyrics.evaluate(node => node.style.textAlign), 'center');
      await page.keyboard.press('ArrowLeft');
      await page.waitForFunction(() => window.kefeLyricStudio.alignment() === 'left');
      await page.evaluate(() => {
        const input = document.getElementById('lyricsInput');
        window.__lyricsEvents = 0;
        input.addEventListener('input', () => window.__lyricsEvents++);
        input.value = '[00:03.00] Programmatic line';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.waitForFunction(() => window.kefeLyrics?.lines()?.[0]?.text === 'Programmatic line');
      await lyrics.fill('[00:01.00] First line\n[00:02.00] Second line');
      assert.ok(await page.evaluate(() => window.__lyricsEvents >= 2), 'native input listeners still fire');
      await page.waitForFunction(() => window.kefeLyrics?.lines()?.length === 2);
      await lyrics.focus();
      await page.keyboard.press('End');
      await page.keyboard.insertText('!');
      await page.waitForFunction(() => document.getElementById('lyricsInput').value.endsWith('line!'));
      await page.evaluate(() => {
        const speed = document.querySelector('[data-fluid-key="speed"]');
        speed.value = '1.7'; speed.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.evaluate(() => window.kefeProjectAutosave.saveNow());
      await page.reload();
      await page.waitForFunction(() => window.kefeProjectAutosave && document.getElementById('lyricsInput')?.dataset.shadcnHydrated === 'true');
      await page.evaluate(() => window.kefeProjectAutosave.ready);
      assert.equal(await page.locator('#lyricsInput').inputValue(), '[00:01.00] First line\n[00:02.00] Second line!');
      assert.equal(await page.locator('[data-fluid-key="speed"]').inputValue(), '1.7', 'other control values remain stable when lyric rows exist');
      assert.equal(await page.locator('#lyricsInput').evaluate(node => node.style.textAlign), 'left', 'alignment persists after reload');
      assert.deepEqual(errors, [], `no page or hydration errors at ${width}px`);
      await context.close();
    }
    console.log('PASS: shadcn lyrics textarea retains its node, label, keyboard, editor parsing and autosave in desktop and mobile Chromium');
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
