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
      const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block', acceptDownloads: true });
      const page = await context.newPage(), errors = [];
      await page.addInitScript(() => {
        window.__originalActions = [];
        window.__timingCard = null;
        const selector = '#kefeAutoSync .kefe-download-row > button, #kefeTimingEditor .kefe-timing-editor-actions > button, #kefeTimingEditor > .kefe-download-row > button, #kefeExportExtras .kefe-download-row > button, #kefeExportExtras .kefe-review > button';
        const observer = new MutationObserver(() => {
          if (!window.__timingCard) window.__timingCard = document.getElementById('kefeTimingEditor');
          document.querySelectorAll(selector).forEach(button => {
            if (!window.__originalActions.includes(button)) window.__originalActions.push(button);
          });
        });
        observer.observe(document, { childList: true, subtree: true });
      });
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error' && /hydrat|react error/i.test(message.text())) errors.push(message.text()); });
      await page.goto(`http://127.0.0.1:${server.address().port}/editor.html`);
      await page.waitForFunction(() => document.querySelectorAll('.shad-lyric-action-host > [data-shadcn-hydrated="true"]').length === 10);
      assert.equal(await page.evaluate(() => document.getElementById('kefeTimingEditor') === window.__timingCard), true, 'timing card retains its native node');
      assert.equal(await page.locator('#kefeTimingEditor').getAttribute('data-slot'), 'card');
      assert.equal(await page.evaluate(() => [...document.querySelectorAll('.shad-lyric-action-host > button')].every(button => window.__originalActions.includes(button))), true, 'all native buttons are retained');
      await page.locator('[data-workspace-tab="content"]').evaluate(node => node.click());
      await page.locator('#kefe-subtab-lyric-sync').evaluate(node => node.click());
      const auto = page.getByRole('button', { name: 'Auto-time lyrics' });
      assert.equal(await auto.getAttribute('data-slot'), 'button');
      assert.equal(await auto.getAttribute('data-variant'), 'default');
      assert.equal(await page.getByRole('button', { name: 'Undo auto-time' }).isDisabled(), true);
      await auto.click();
      assert.match(await page.locator('#kefeAutoSync [role="status"]').textContent(), /Paste the lyrics/);
      await page.locator('#lyricsInput').fill('[00:01.00] Original line\n[00:05.00] Another line');
      await page.waitForSelector('[aria-label="Line 1 text"][data-shadcn-hydrated]');
      const line = page.getByRole('textbox', { name: 'Line 1 text' });
      await line.fill('Edited line'); await line.press('Enter');
      await page.waitForFunction(() => window.kefeLyrics.lines()[0]?.text === 'Edited line');
      const undo = page.getByRole('button', { name: 'Undo the last timing edit' });
      await undo.waitFor();
      assert.equal(await undo.getAttribute('data-variant'), 'outline');
      assert.equal(await undo.isEnabled(), true);
      await undo.focus(); await page.keyboard.press('Enter');
      await page.waitForFunction(() => window.kefeLyrics.lines()[0]?.text === 'Original line');
      assert.equal(await undo.isDisabled(), true);
      const lyricsDownload = page.locator('#kefeTimingEditor').getByRole('button', { name: 'Download Lyrics (.lrc)' });
      const downloadPromise = page.waitForEvent('download');
      await lyricsDownload.click();
      const download = await downloadPromise;
      assert.match(download.suggestedFilename(), /\.lrc$/);
      assert.match(fs.readFileSync(await download.path(), 'utf8'), /Original line/);
      await page.locator('[data-workspace-tab="export"]').evaluate(node => node.click());
      await page.locator('#kefe-subtab-export').evaluate(node => node.click());
      const phone = page.getByRole('button', { name: 'Shrink the preview to roughly phone size' });
      const bounds = await phone.boundingBox();
      assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width + 1, 'phone preview action fits viewport');
      await phone.click();
      assert.equal(await phone.getAttribute('aria-pressed'), 'true');
      assert.equal(await phone.textContent(), 'Back to full size');
      await phone.focus(); await page.keyboard.press('Space');
      assert.equal(await phone.getAttribute('aria-pressed'), 'false');
      assert.equal(await phone.textContent(), 'Phone-size preview');
      const subtitlesDownload = page.locator('#kefeExportExtras').getByRole('button', { name: 'Download Subtitles (.srt)' });
      const subtitlePromise = page.waitForEvent('download');
      await subtitlesDownload.click();
      const subtitle = await subtitlePromise;
      assert.match(subtitle.suggestedFilename(), /\.srt$/);
      assert.match(fs.readFileSync(await subtitle.path(), 'utf8'), /Original line/);
      assert.deepEqual(errors, [], `no page or hydration errors at ${width}px`);
      await context.close();
    }
    console.log('PASS: shadcn lyric actions preserve identity, validation, undo, downloads, keyboard and preview behavior');
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
