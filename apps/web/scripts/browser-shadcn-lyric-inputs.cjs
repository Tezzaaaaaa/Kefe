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
        window.__lyricRows = [];
        window.__lyricButtons = [];
        const observer = new MutationObserver(() => {
          const input = document.querySelector('#kefeTimingEditor .kefe-line-text:not([data-shadcn-hydrated])');
          if (input && !window.__lyricRows.includes(input)) window.__lyricRows.push(input);
          document.querySelectorAll('#kefeTimingEditor .kefe-line button:not([data-shadcn-hydrated])').forEach(button => {
            if (!window.__lyricButtons.includes(button)) window.__lyricButtons.push(button);
          });
        });
        observer.observe(document, { childList: true, subtree: true });
      });
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error' && /hydrat|react error/i.test(message.text())) errors.push(message.text()); });
      await page.goto(`http://127.0.0.1:${server.address().port}/editor.html`);
      await page.locator('[data-workspace-tab="content"]').evaluate(node => node.click());
      await page.locator('#kefe-subtab-media').evaluate(node => node.click());
      await page.waitForSelector('#songTitle[data-slot="input"][data-shadcn-hydrated="true"]');
      assert.equal(await page.locator('#songTitle').getAttribute('data-slot'), 'input', 'metadata field is a shadcn Input');
      await page.locator('#kefe-subtab-lyric-sync').evaluate(node => node.click());
      await page.waitForSelector('#lyricsInput[data-slot="textarea"][data-shadcn-hydrated="true"]');
      assert.equal(await page.locator('#lyricsInput').getAttribute('data-slot'), 'textarea', 'lyrics editor is a shadcn Textarea');
      await page.locator('#kefe-subtab-lyric-sync').evaluate(node => node.click());
      await page.locator('#lyricsInput').fill('[00:01.00] First line\n[00:05.00] Second line');
      await page.waitForSelector('[aria-label="Line 1 text"][data-shadcn-hydrated="true"]');
      assert.equal(await page.evaluate(() => window.__lyricRows.includes(document.querySelector('[aria-label="Line 1 text"]'))), true, 'original input node hydrated');
      assert.equal(await page.evaluate(() => [...document.querySelectorAll('#kefeTimingEditor .kefe-line button')].every(button => window.__lyricButtons.includes(button))), true, 'original timing action nodes hydrated');
      assert.equal(await page.locator('#kefeTimingEditor .kefe-line button').count(), await page.locator('#kefeTimingEditor .kefe-line button[data-slot="button"]').count());
      const firstText = page.getByRole('textbox', { name: 'Line 1 text', exact: true });
      assert.equal(await firstText.getAttribute('data-slot'), 'input');
      await firstText.fill('New first line'); await firstText.press('Enter');
      await page.waitForFunction(() => window.kefeLyrics.lines()[0]?.text === 'New first line');
      await page.waitForSelector('[aria-label="Line 1 text"][data-shadcn-hydrated="true"]');
      const start = page.getByRole('textbox', { name: 'Line 1 start', exact: true });
      assert.equal(await start.getAttribute('data-slot'), 'input');
      assert.equal(await start.getAttribute('inputmode'), 'decimal');
      await start.fill('00:02.00'); await start.press('Enter');
      await page.waitForFunction(() => Math.abs(window.kefeLyrics.lines()[0]?.time - 2) < .01);
      const sync = page.locator('.kefe-line').first().getByRole('button', { name: 'This line is being sung now: move it to the playhead and move every later line with it' });
      assert.equal(await sync.getAttribute('data-slot'), 'button');
      await sync.click();
      assert.match(await page.locator('.kefe-timing-editor-actions .kefe-meta').textContent(), /Load a song/);
      await page.locator('.kefe-line').first().locator('summary').click();
      const end = page.getByRole('textbox', { name: 'Line 1 end', exact: true });
      assert.equal(await end.getAttribute('data-slot'), 'input');
      await end.fill('00:04.00'); await end.press('Enter');
      await page.waitForFunction(() => Math.abs(window.kefeLyrics.lines()[0]?.endTime - 4) < .01);
      await page.locator('.kefe-line').first().locator('summary').click();
      await page.locator('.kefe-line').first().locator('button', { hasText: 'Words' }).click();
      await page.waitForSelector('.kefe-word input[data-shadcn-hydrated="true"]');
      const word = page.locator('.kefe-word input').first();
      assert.equal(await word.getAttribute('data-slot'), 'input');
      assert.equal(await page.locator('.kefe-word button').first().getAttribute('data-slot'), 'button');
      await word.fill('00:02.25'); await word.press('Enter');
      await page.waitForFunction(() => window.kefeLyrics.lines()[0]?.words?.some(word => Math.abs(word.time - 2.25) < .01));
      const split = page.locator('.kefe-line').first().getByRole('button', { name: 'Start a new line at this word' }).first();
      assert.equal(await split.getAttribute('data-slot'), 'button');
      await split.click();
      await page.waitForFunction(() => window.kefeLyrics.lines().length === 3);
      await page.getByRole('button', { name: 'Undo the last timing edit' }).click();
      await page.waitForFunction(() => window.kefeLyrics.lines().length === 2);
      await page.locator('.kefe-line').first().locator('summary').click();
      const add = page.locator('.kefe-line').first().getByRole('button', { name: 'Insert a line after this one' });
      assert.equal(await add.getAttribute('data-variant'), 'outline');
      await add.focus(); await page.keyboard.press('Enter');
      await page.waitForFunction(() => window.kefeLyrics.lines().length === 3);
      const middle = page.locator('.kefe-line').nth(1);
      await middle.locator('summary').click();
      await middle.getByRole('button', { name: 'Delete this line' }).click();
      await page.waitForFunction(() => window.kefeLyrics.lines().length === 2);
      await page.locator('.kefe-line').last().locator('summary').click();
      assert.equal(await page.locator('.kefe-line').last().getByRole('button', { name: 'Merge with the next line' }).isDisabled(), true);
      const box = await page.getByRole('textbox', { name: 'Line 1 text', exact: true }).boundingBox();
      assert.ok(box && box.x >= 0 && box.x + box.width <= width + 1, 'line input fits viewport');
      // Rebuilding a larger list repeatedly must leave only live, hydrated inputs.
      await page.locator('#lyricsInput').fill(Array.from({ length: 50 }, (_, i) => `[00:${String(i).padStart(2, '0')}.00] Line ${i}`).join('\n'));
      await page.waitForFunction(() => document.querySelectorAll('#kefeTimingEditor .kefe-line-text[data-shadcn-hydrated]').length === 50);
      await page.locator('#lyricsInput').fill('[00:01.00] One line');
      await page.waitForFunction(() => document.querySelectorAll('#kefeTimingEditor .kefe-line-text[data-shadcn-hydrated]').length === 1);
      assert.deepEqual(errors, [], `no page or hydration errors at ${width}px`);
      await context.close();
    }
    console.log('PASS: shadcn lyric timing inputs and buttons preserve native editing, dynamic rebuilds and mobile layout');
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
