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
      await page.goto(`http://127.0.0.1:${server.address().port}/editor.html`);
      await page.waitForFunction(() => window.kefeSettingsPanelAdapter && document.querySelector('[data-workspace-tablist][data-slot="tabs-list"]'));
      await page.waitForFunction(() => document.documentElement.classList.contains('kefe-ready'));
      const list = page.locator('[data-workspace-tablist]');
      const tabs = list.getByRole('tab');
      assert.equal(await tabs.count(), 4);
      assert.equal(await list.locator('[data-slot="tabs-trigger"]').count(), 4);
      for (const tab of await tabs.all()) {
        const relation = await tab.evaluate(node => {
          const panel = document.getElementById(node.getAttribute('aria-controls'));
          return [panel?.getAttribute('role'), panel?.getAttribute('aria-labelledby'), node.id];
        });
        assert.deepEqual(relation, ['tabpanel', relation[2], relation[2]], 'workspace tab and panel are correctly linked');
      }
      const listBox = await list.boundingBox();
      assert.ok(listBox.width <= width && listBox.x >= 0 && listBox.x + listBox.width <= width + 1, `tabs fit ${width}px`);
      await tabs.first().focus(); await page.keyboard.press('End');
      await page.waitForFunction(() => document.querySelector('[data-workspace-tab="export"]')?.getAttribute('aria-selected') === 'true');
      assert.equal(await page.evaluate(() => document.activeElement?.dataset.workspaceTab), 'export');
      assert.equal(await page.locator('#kefe-workspace-export-panel').isVisible(), true);
      await page.keyboard.press('Home');
      await page.waitForFunction(() => document.querySelector('[data-workspace-tab="content"]')?.getAttribute('aria-selected') === 'true');
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() => document.querySelector('[data-workspace-tab="design"]')?.getAttribute('aria-selected') === 'true');
      const designPanel = page.locator('#kefe-workspace-appearance-panel');
      assert.equal(await designPanel.locator('[data-slot="tabs-list"]').count(), 0, 'single-section Effects workspace does not render a redundant subtab strip');
      assert.equal(await page.locator('#kefe-subpanel-lyric-effects').isVisible(), true, 'Lyric Effects is the active Effects section');
      await page.locator('[data-workspace-tab="audio-visuals"]').evaluate(node => node.click());
      await page.waitForFunction(() => document.querySelector('#kefe-subtab-background')?.getAttribute('aria-selected') === 'true');
      const backgroundRelation = await page.locator('#kefe-subtab-background').evaluate(node => {
        const panel = document.getElementById(node.getAttribute('aria-controls'));
        return [panel?.getAttribute('role'), panel?.getAttribute('aria-labelledby'), panel?.hidden];
      });
      assert.deepEqual(backgroundRelation, ['tabpanel', 'kefe-subtab-background', false]);
      await page.evaluate(() => window.kefeSettingsPanelAdapter.activateSection('export'));
      await page.waitForFunction(() => document.querySelector('#kefe-subtab-export')?.getAttribute('aria-selected') === 'true' && document.querySelector('[data-workspace-tab="export"]')?.getAttribute('aria-selected') === 'true');
      assert.equal(await page.locator('#kefe-subpanel-export').isVisible(), true);
      // Programmatic clicks were part of the editor's public navigation contract.
      await page.locator('[data-workspace-tab="audio-visuals"]').evaluate(node => node.click());
      await page.locator('#kefe-subtab-background').evaluate(node => node.click());
      await page.reload();
      await page.waitForFunction(() => window.kefeSettingsPanelAdapter && document.querySelector('#kefe-subtab-background'));
      await page.locator('[data-workspace-tab="design"]').click();
      await page.waitForFunction(() => document.querySelector('#kefe-subtab-background')?.getAttribute('aria-selected') === 'true');
      assert.deepEqual(errors, [], `no page errors at ${width}px`);
      await context.close();
    }
    console.log('PASS: shadcn workspace and section tabs, keyboard, accessibility, navigation API and persistence in desktop and mobile Chromium');
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
