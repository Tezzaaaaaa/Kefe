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
          const group = document.getElementById('lyricEffectOptions');
          const bg = document.getElementById('kefeBackgroundEffectOptions');
          const nav = document.querySelector('.kefe-lyric-effect-preview-nav');
          if (group?.children.length > 10 && !window.__effectNodes) window.__effectNodes = [...group.children].map(button => [button, button.querySelector('canvas')]);
          if (bg?.children.length && !window.__backgroundNodes) window.__backgroundNodes = [...bg.children];
          if (nav?.children.length === 3 && !window.__effectNavNodes) window.__effectNavNodes = [...nav.children];
          if (window.__effectNodes && window.__backgroundNodes && window.__effectNavNodes) observer.disconnect();
        });
        observer.observe(document, { childList: true, subtree: true });
      });
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error' && /hydrat|react error/i.test(message.text())) errors.push(message.text()); });
      await page.goto(`http://127.0.0.1:${server.address().port}/editor.html`);
      await page.waitForSelector('#lyricEffectOptions[data-shadcn-hydrated="true"]', { state: 'attached' });
      await page.waitForSelector('#kefeBackgroundEffectOptions[data-shadcn-hydrated="true"]', { state: 'attached' });
      assert.equal(await page.evaluate(() => window.__effectNodes.every(([button, canvas]) => button.isConnected && button.querySelector('canvas') === canvas)), true, 'original lyric buttons and canvases remain connected');
      assert.equal(await page.evaluate(() => window.__backgroundNodes.every(button => button.isConnected)), true, 'background native buttons retained');
      await page.waitForSelector('.kefe-lyric-effect-preview-nav[data-shadcn-hydrated="true"]', { state: 'attached' });
      assert.equal(await page.evaluate(() => window.__effectNavNodes.every(node => node.isConnected)), true, 'effect navigation nodes retained');
      assert.equal(await page.locator('.kefe-lyric-effect-preview-nav > button[data-slot="button"]').count(), 2);
      await page.locator('[data-workspace-tab="design"]').evaluate(node => node.click());
      await page.locator('#kefe-subtab-lyric-effects').evaluate(node => node.click());
      const nav = page.locator('.kefe-lyric-effect-preview-nav').first();
      const prevEffect = nav.locator('button').first(), nextEffect = nav.locator('button').last();
      const initialCount = await nav.locator('.kefe-lyric-effect-preview-count').textContent();
      await nextEffect.click();
      assert.notEqual(await nav.locator('.kefe-lyric-effect-preview-count').textContent(), initialCount, 'next effect updates the live count');
      await prevEffect.focus(); await page.keyboard.press('Enter');
      assert.equal(await nav.locator('.kefe-lyric-effect-preview-count').textContent(), initialCount, 'previous effect returns to initial selection');
      const gallery = page.locator('#lyricEffectOptions');
      const choices = gallery.locator(':scope > button');
      assert.ok(await choices.count() > 50, 'all lyric effects remain present');
      assert.equal(await choices.count(), await gallery.locator(':scope > button[data-slot="button"]').count());
      const first = choices.first();
      const firstBox = await first.boundingBox();
      assert.ok(firstBox && firstBox.width > 0 && firstBox.height > 0, 'effect choice has a visible layout');
      await page.evaluate(() => { window.__effectChanges = 0; window.addEventListener('kefe-effect-change', () => window.__effectChanges++); });
      await first.click();
      await page.waitForFunction(() => document.querySelector('#lyricEffectOptions > button')?.getAttribute('aria-pressed') === 'true');
      assert.equal(await page.evaluate(() => window.__effectChanges), 1, 'one click selects exactly once');
      await first.focus(); await page.keyboard.press('ArrowRight');
      const second = choices.nth(1);
      await page.waitForFunction(() => document.activeElement === document.querySelectorAll('#lyricEffectOptions > button')[1]);
      await page.keyboard.press('Space');
      await page.waitForFunction(() => document.querySelectorAll('#lyricEffectOptions > button')[1]?.getAttribute('aria-pressed') === 'true');
      assert.equal(await page.evaluate(() => window.__effectChanges), 2, 'keyboard selection selects exactly once');
      const selected = await second.getAttribute('data-effect');
      await page.evaluate(() => window.kefeProjectAutosave.saveNow());
      await page.reload();
      await page.waitForFunction(() => window.kefeProjectAutosave && document.querySelector('#lyricEffectOptions[data-shadcn-hydrated]'));
      await page.evaluate(() => window.kefeProjectAutosave.ready);
      await page.waitForFunction(id => document.querySelector('#lyricEffectOptions > button.active')?.dataset.effect === id, selected);
      await page.locator('[data-workspace-tab="design"]').evaluate(node => node.click());
      await page.locator('#kefe-subtab-background').evaluate(node => node.click());
      const bg = page.locator('#kefeBackgroundEffectOptions');
      assert.equal(await bg.locator('button[data-slot="button"]').count(), 3);
      const video = bg.locator('[data-background-mode="video"]');
      assert.equal(await video.isDisabled(), true);
      const gradient = bg.locator('[data-background-mode="gradient"]');
      await gradient.click();
      await page.waitForFunction(() => window.kefeBackground.mode() === 'gradient');
      assert.equal(await gradient.getAttribute('aria-pressed'), 'true');
      await page.locator('#kefe-subtab-lyric-effects').evaluate(node => node.click());
      await page.locator('#lyricEffectOptions > button').first().click();
      assert.equal(await page.locator('#kefeBackgroundEffectOptions [data-background-mode="gradient"]').getAttribute('aria-pressed'), 'true', 'lyric selection does not clear the background selection');
      assert.equal(await page.evaluate(() => window.kefeBackground.mode()), 'gradient');
      await page.locator('#kefe-subtab-background').evaluate(node => node.click());
      await page.evaluate(() => window.kefeBackground.setMode('apple'));
      await page.waitForFunction(() => document.querySelector('#kefeBackgroundEffectOptions [data-background-mode="apple"]')?.getAttribute('aria-pressed') === 'true');
      assert.deepEqual(errors, [], `no page or hydration errors at ${width}px`);
      await context.close();
    }
    console.log('PASS: shadcn effect choices retain buttons, preview canvases, selection, keyboard, persistence and disabled states');
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
