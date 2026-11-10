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
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/editor.html`);
      await page.locator('[data-workspace-tab="audio-visuals"]').evaluate(node => node.click());
      await page.locator('#kefe-subtab-visualisers').evaluate(node => node.click());
      const gallery = page.locator('.shad-vis-tabs-host');
      await gallery.locator('[data-slot="tabs-list"]').waitFor();
      assert.equal(await gallery.locator('[data-slot="card"]').count(), 7);
      assert.equal(await gallery.locator('[data-slot="tabs-trigger"]').count(), 7);
      assert.equal(await gallery.locator('[data-slot="switch"]').count(), 7);
      const tabs = gallery.locator('[data-slot="tabs-trigger"]');
      const first = tabs.first(), second = tabs.nth(1);
      const firstId = await first.getAttribute('data-visualiser');
      const secondId = await second.getAttribute('data-visualiser');
      await first.focus(); await page.keyboard.press('ArrowDown');
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-visualiser')), secondId);
      assert.equal(await gallery.locator('[role="tab"][aria-selected="true"]').count(), 0, 'arrows only move focus in manual tab mode');
      await page.keyboard.press('Enter');
      await page.waitForFunction(id => document.querySelector(`.shad-vis-tabs-host [data-visualiser="${id}"][role="tab"]`)?.getAttribute('aria-selected') === 'true', secondId);
      const secondPower = gallery.locator(`.kv-card[data-visualiser="${secondId}"] [data-slot="switch"]`);
      assert.equal(await secondPower.getAttribute('aria-checked'), 'true', 'activating a visualiser turns its engine on');
      await secondPower.click();
      await page.waitForFunction(id => document.querySelector(`.shad-vis-tabs-host .kv-card[data-visualiser="${id}"] [role="switch"]`)?.getAttribute('aria-checked') === 'false', secondId);
      await second.click();
      await page.waitForFunction(id => document.querySelector(`.shad-vis-tabs-host .kv-card[data-visualiser="${id}"] [role="switch"]`)?.getAttribute('aria-checked') === 'true', secondId);
      await first.evaluate(node => node.click());
      await page.waitForFunction(id => document.querySelector(`.shad-vis-tabs-host [data-visualiser="${id}"][role="tab"]`)?.getAttribute('aria-selected') === 'true', firstId);
      assert.equal(await gallery.locator('[role="tab"][aria-selected="true"]').count(), 1);
      const firstPower = gallery.locator(`.kv-card[data-visualiser="${firstId}"] [data-slot="switch"]`);
      assert.equal(await firstPower.getAttribute('aria-checked'), 'true');
      await firstPower.click();
      await page.waitForFunction(id => document.querySelector(`.shad-vis-tabs-host .kv-card[data-visualiser="${id}"] [role="switch"]`)?.getAttribute('aria-checked') === 'false', firstId);
      await page.evaluate(() => window.kefeProjectAutosave.saveNow());
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('kefe.project.autosave.v1')).selections);
      assert.equal(saved.visualiser, firstId); assert.equal(saved.visualiserPower, false);
      await page.reload();
      await page.waitForFunction(() => window.kefeProjectAutosave && window.kefeSettingsPanelAdapter);
      await page.evaluate(() => window.kefeProjectAutosave.ready);
      await page.locator('[data-workspace-tab="audio-visuals"]').evaluate(node => node.click());
      await page.locator('#kefe-subtab-visualisers').evaluate(node => node.click());
      await page.waitForFunction(id => document.querySelector(`.shad-vis-tabs-host [data-visualiser="${id}"][role="tab"]`)?.getAttribute('aria-selected') === 'true', firstId);
      assert.equal(await gallery.locator(`.kv-card[data-visualiser="${firstId}"] [data-slot="switch"]`).getAttribute('aria-checked'), 'false', 'saved engine power is restored');
      await page.evaluate(() => {
        const nav = document.querySelector('.kefe-vis-tabs');
        const option = document.createElement('div'); option.className = 'kefe-vis-option';
        const tab = document.createElement('button'); tab.setAttribute('role', 'tab'); tab.dataset.visualiser = 'late-test'; tab.textContent = 'Late test'; tab.setAttribute('aria-selected', 'false');
        const power = document.createElement('button'); power.className = 'kefe-switch kefe-vis-option-power'; power.setAttribute('role', 'switch'); power.setAttribute('aria-checked', 'false');
        tab.addEventListener('click', () => { nav.querySelectorAll('.kefe-vis-option [role="tab"]').forEach(node => node.setAttribute('aria-selected', String(node === tab))); });
        power.addEventListener('click', () => power.setAttribute('aria-checked', String(power.getAttribute('aria-checked') !== 'true')));
        option.append(tab, power); nav.append(option);
      });
      const late = gallery.locator('.kv-card[data-visualiser="late-test"]');
      await late.waitFor();
      await late.locator('[data-slot="switch"]').click();
      assert.equal(await late.locator('[data-slot="switch"]').getAttribute('aria-checked'), 'true');
      await page.waitForFunction(() => document.querySelector('.kv-card[data-visualiser="late-test"] [role="tab"]')?.getAttribute('aria-selected') === 'true');
      assert.equal(await page.locator('.shad-vis-backing-controls [data-visualiser="late-test"]').getAttribute('aria-selected'), 'true');
      await page.evaluate(() => { document.querySelector('.shad-vis-backing-controls [data-visualiser="late-test"]').nextElementSibling.disabled = true; });
      await page.waitForFunction(() => document.querySelector('.kv-card[data-visualiser="late-test"] [role="switch"]')?.disabled);
      await page.evaluate(() => { document.querySelector('.shad-vis-backing-controls [data-visualiser="late-test"]').hidden = true; });
      await page.waitForFunction(() => document.querySelector('.kv-card[data-visualiser="late-test"]')?.hidden);
      assert.equal(await late.isVisible(), false, 'hidden engine does not leave a visible card');
      assert.deepEqual(errors, [], `no page errors at ${width}px`);
      await context.close();
    }
    console.log('PASS: shadcn visualiser Tabs, Card and Switch selection, keyboard, power and late registration in desktop and mobile Chromium');
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
