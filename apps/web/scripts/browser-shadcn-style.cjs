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
          const group = document.querySelector('#kefeStyleGroup');
          if (group?.querySelectorAll('.kefe-style-color-row').length === 5) {
            window.__styleNodes = [...group.querySelectorAll('.kefe-style-color-row input, .kefe-style-color-row button')];
            observer.disconnect();
          }
        });
        observer.observe(document, { childList: true, subtree: true });
      });
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error' && /hydrat|react error/i.test(message.text())) errors.push(message.text()); });
      await page.goto(`http://127.0.0.1:${server.address().port}/editor.html`);
      await page.waitForFunction(() => document.querySelectorAll('#kefeStyleGroup .kefe-style-color-row[data-shadcn-hydrated="true"]').length === 5);
      assert.equal(await page.evaluate(() => window.__styleNodes.length), 48);
      assert.equal(await page.evaluate(() => window.__styleNodes.every(node => node.isConnected)), true, 'original controls remain connected');
      assert.equal(await page.locator('#kefeStyleGroup input[type="color"].shad-input[data-slot="input"]').count(), 5);
      assert.equal(await page.locator('#kefeStyleGroup .kefe-style-color-row button.shad-btn[data-slot="button"]').count(), 43);
      await page.locator('[data-workspace-tab="design"]').evaluate(node => node.click());
      await page.locator('#kefe-subtab-lyric-effects').evaluate(node => node.click());
      await page.locator('#kefeStyleGroup [data-slot="collapsible-trigger"][data-state="closed"]').evaluateAll(triggers => triggers.forEach(trigger => trigger.click()));
      const rows = page.locator('#kefeStyleGroup .kefe-style-color-row');
      const first = rows.nth(0), palette = first.locator('.kefe-style-color-swatches');
      const red = palette.locator('button[title="#f16a67"]');
      await red.click();
      assert.equal(await red.getAttribute('aria-pressed'), 'true');
      assert.equal(await page.evaluate(() => window.kefeStyle.state().textColor), '#f16a67');
      assert.equal(await page.evaluate(() => window.kefeStyle.style({fontSize:80}).textColor), '#f16a67');
      assert.equal(await first.locator('input[type="color"]').inputValue(), '#f16a67');
      const blue = palette.locator('button[title="#69a8f4"]');
      await blue.focus(); await page.keyboard.press('Space');
      assert.equal(await page.evaluate(() => window.kefeStyle.state().textColor), '#69a8f4');
      assert.equal(await blue.getAttribute('aria-pressed'), 'true');
      const auto = first.locator('button.kefe-style-mini');
      assert.equal(await auto.isVisible(), true);
      await auto.focus(); await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(() => window.kefeStyle.state().textColor), '');
      assert.equal(await auto.isHidden(), true);
      await first.locator('input[type="color"]').fill('#123456');
      assert.equal(await page.evaluate(() => window.kefeStyle.state().textColor), '#123456');
      const outline = rows.nth(3);
      await outline.locator('button[title="#f0a35e"]').click();
      assert.equal(await page.evaluate(() => window.kefeStyle.state().outline.color), '#f0a35e');
      await page.evaluate(() => window.kefeStyle.applyState({...window.kefeStyle.state(), accentColor:'#77c7a5', glow:{color:'#a88be8'}}));
      assert.equal(await rows.nth(1).locator('button[title="#77c7a5"]').getAttribute('aria-pressed'), 'true');
      assert.equal(await rows.nth(4).locator('input').inputValue(), '#a88be8');
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('kefe.style.v1')).textColor), '#123456');
      const layout = await palette.evaluate(el => ({ width: el.getBoundingClientRect().width, scroll: el.scrollWidth, buttons: [...el.children].map(n => [n.getBoundingClientRect().width, n.getBoundingClientRect().height]) }));
      assert.ok(layout.width > 0 && layout.scroll <= layout.width + 1, `palette fits at ${width}px`);
      assert.ok(layout.buttons.every(([w, h]) => w >= 20 && h >= 20), 'colour swatches remain usable');
      await page.evaluate(() => window.kefeProjectAutosave.setToolbarContext('lyric'));
      await page.locator('#kefeFloatingToolbar button[aria-label="Lyric effect and text style"]').click();
      const hex = page.locator('.kft-panel input[aria-label="Hex colour"]');
      await hex.fill('#234567');
      assert.equal(await page.evaluate(() => window.kefeStyle.state().textColor), '#234567', 'toolbar forwards colour to the original Input');
      assert.equal(await first.locator('input[type="color"]').inputValue(), '#234567');
      await page.evaluate(() => window.kefeStyle.activateEffect('bounce'));
      assert.equal(await page.evaluate(() => window.kefeStyle.state().textColor), '', 'a new effect starts with its own default style');
      await page.evaluate(() => window.kefeStyle.applyState({...window.kefeStyle.state(), textColor:'#abcdef'}));
      await page.evaluate(() => window.kefeStyle.activateEffect('apple'));
      assert.equal(await page.evaluate(() => window.kefeStyle.state().textColor), '#234567', 'switching back restores the first effect style');
      await page.evaluate(() => window.kefeStyle.activateEffect('bounce'));
      assert.equal(await page.evaluate(() => window.kefeStyle.state().textColor), '#abcdef', 'the second effect retains its own style');
      await page.evaluate(() => window.kefeStyle.activateEffect('apple'));
      await page.locator('#fontOverride').selectOption('Arial');
      await page.locator('#lyricEffectOptions [data-effect="bounce"]').click();
      assert.equal(await page.locator('#fontOverride').inputValue(), '', 'a different effect does not inherit the first effect font');
      await page.locator('#fontOverride').selectOption('Georgia');
      await page.locator('#lyricEffectOptions [data-effect="apple"]').click();
      assert.equal(await page.locator('#fontOverride').inputValue(), 'Arial', 'the first effect restores its own font');
      await page.locator('#lyricEffectOptions [data-effect="bounce"]').click();
      assert.equal(await page.locator('#fontOverride').inputValue(), 'Georgia', 'the second effect restores its own font');
      await page.locator('#lyricEffectOptions [data-effect="apple"]').click();
      await page.keyboard.press('Escape');
      await page.evaluate(() => window.kefeProjectAutosave.saveNow());
      await page.reload();
      await page.waitForFunction(() => window.kefeStyle && document.querySelectorAll('#kefeStyleGroup .kefe-style-color-row[data-shadcn-hydrated="true"]').length === 5);
      await page.evaluate(() => window.kefeProjectAutosave.ready);
      assert.equal(await page.evaluate(() => window.kefeStyle.state().textColor), '#234567', 'toolbar colour persisted');
      assert.equal(await page.evaluate(() => window.kefeStyle.state().outline.color), '#f0a35e', 'outline persisted');
      assert.equal(await rows.nth(4).locator('input').inputValue(), '#a88be8', 'API state persisted');
      assert.deepEqual(errors, [], `no page or hydration errors at ${width}px`);
      await context.close();
    }
    console.log('PASS: shadcn colour inputs and buttons retain nodes, accessibility, style state, keyboard and persistence');
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
