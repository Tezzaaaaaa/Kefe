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
          const buttons = ['kefeResetButton', 'kefeSaveButton', 'kefeThemeToggle'].map(id => document.getElementById(id));
          if (buttons.every(Boolean)) { window.__headerButtons = buttons; observer.disconnect(); }
        });
        observer.observe(document, { childList: true, subtree: true });
      });
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error' && /hydrat|react error/i.test(message.text())) errors.push(message.text()); });
      await page.goto(`http://127.0.0.1:${server.address().port}/editor.html`);
      await page.waitForSelector('.kefe-sidebar-bottom[data-shadcn-hydrated="true"]');
      await page.waitForFunction(() => window.kefeProjectAutosave);
      await page.waitForFunction(() => ['.kefe-header-settings', '#previewFullscreen'].every(selector => document.querySelector(selector)?.dataset.shadcnHydrated === 'true'));
      await page.waitForSelector('.kefe-sidebar-group-editor [data-editor-tab][data-slot="button"]');
      await page.waitForSelector('.kefe-workspace-dock[data-shadcn-hydrated="true"]');
      const navigation = page.locator('.kefe-sidebar-editor-link');
      assert.equal(await navigation.getAttribute('data-slot'), 'button', 'Editor navigation uses shadcn Button');
      assert.equal(await navigation.getAttribute('data-variant'), 'ghost');
      await page.waitForFunction(() => window.kefeSettingsPanelAdapter && [...document.querySelectorAll('#kefeTimingEditor, #kefeMediaTrack, .kefe-upload-card')].every(card => card.dataset.shadcnHydrated === 'true'));
      assert.equal(await page.locator('.kefe-panels > .shad-panel-card-host > .kefe-panel[data-panel-view]').count(), 6, 'all six editor panels are shadcn Cards');
      assert.equal(await page.locator('.kefe-panels .kefe-panel[data-panel-view]').evaluateAll(nodes => nodes.every(node => node.dataset.slot === 'card' && node.dataset.shadcnHydrated === 'true')), true, 'panel Card roots preserve their native sections');
      assert.equal(await page.locator('#kefeUploadZone .kefe-upload-card').getAttribute('data-slot'), 'card', 'media upload surface uses shadcn Card');
      assert.equal(await page.locator('#kefeMediaTrack').getAttribute('data-slot'), 'card', 'identified media card uses shadcn Card');
      const dockButtons = page.locator('.kefe-workspace-dock > button');
      assert.equal(await dockButtons.count(), 6, 'all five section shortcuts and export shortcut remain present');
      for (let index = 0; index < await dockButtons.count(); index += 1) {
        assert.equal(await dockButtons.nth(index).getAttribute('data-slot'), 'button', `workspace dock shortcut ${index + 1} is a shadcn Button`);
        assert.equal(await dockButtons.nth(index).getAttribute('data-variant'), 'ghost');
      }
      for (const selector of ['.kefe-header-settings', '#previewFullscreen']) {
        const control = page.locator(selector);
        assert.equal(await control.getAttribute('data-slot'), 'button', `${selector} is a shadcn Button`);
        assert.equal(await control.getAttribute('data-variant'), 'ghost');
      }
      const settings = page.locator('.kefe-header-settings');
      await settings.click();
      await page.waitForSelector('.beui-settings-root[data-state="open"]');
      await page.locator('.beui-settings-root .shad-dialog-close').click();
      await page.waitForFunction(() => document.querySelector('.beui-settings-root')?.dataset.state === 'closed');

      assert.equal(await page.evaluate(() => window.__headerButtons.every(button => document.getElementById(button.id) === button)), true, 'native button identities retained');
      for (const id of ['kefeResetButton', 'kefeSaveButton', 'kefeThemeToggle']) {
        const button = page.locator('#' + id);
        assert.equal(await button.getAttribute('data-slot'), 'button');
        assert.equal(await button.getAttribute('data-variant'), 'ghost');
        const box = await button.boundingBox();
        assert.ok(box && box.x >= 0 && box.x + box.width <= width + 1 && box.height >= 30, `${id} fits ${width}px layout`);
      }
      const theme = page.locator('#kefeThemeToggle');
      const beforeTheme = await page.locator('html').getAttribute('data-theme');
      await theme.click();
      await page.waitForFunction(oldTheme => document.documentElement.getAttribute('data-theme') !== oldTheme, beforeTheme);
      await theme.focus(); await page.keyboard.press('Space');
      await page.waitForFunction(oldTheme => document.documentElement.getAttribute('data-theme') === oldTheme, beforeTheme);
      await page.evaluate(() => {
        const input = document.getElementById('lyricsInput');
        input.value = 'Header save test'; input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.locator('#kefeSaveButton').focus(); await page.keyboard.press('Enter');
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('kefe.project.autosave.v1') || '{}').values?.['#lyricsInput']?.value === 'Header save test');
      let confirmed = false;
      page.once('dialog', async dialog => { confirmed = /Reset KEFE/.test(dialog.message()); await dialog.dismiss(); });
      await page.locator('#kefeResetButton').click();
      assert.equal(confirmed, true, 'reset confirmation still opens');
      assert.ok(await page.evaluate(() => !!localStorage.getItem('kefe.project.autosave.v1')), 'cancelled reset retains project');
      assert.deepEqual(errors, [], `no page or hydration errors at ${width}px`);
      await context.close();
    }
    console.log('PASS: shadcn header actions preserve identity, theme, keyboard save and reset confirmation on desktop and mobile');
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
