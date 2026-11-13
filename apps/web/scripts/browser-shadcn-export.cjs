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
function audioFixture() {
  const sampleRate = 8000, samples = sampleRate;
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(36 + samples * 2, 4);
  buffer.write('WAVEfmt ', 8); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24); buffer.writeUInt32LE(sampleRate * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36); buffer.writeUInt32LE(samples * 2, 40);
  return buffer;
}
(async () => {
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}) });
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block', acceptDownloads: true });
      const page = await context.newPage(), errors = [];
      await page.addInitScript(() => {
        const observer = new MutationObserver(() => {
          const button = document.getElementById('exportButton');
          if (button) { window.__originalExportButton = button; observer.disconnect(); }
        });
        observer.observe(document, { childList: true, subtree: true });
      });
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error' && /hydrat|react error/i.test(message.text())) errors.push(message.text()); });
      await page.goto(`http://127.0.0.1:${server.address().port}/editor.html`);
      await page.waitForFunction(() => window.kefeExportDialog);
      await page.locator('#mediaInput').setInputFiles({ name: 'export-test.wav', mimeType: 'audio/wav', buffer: audioFixture() });
      await page.waitForFunction(() => document.getElementById('kefeAudio')?.duration >= 1);
      await page.locator('[data-workspace-tab="audio-visuals"]').evaluate(node => node.click());
      await page.locator('#kefe-subtab-background').evaluate(node => node.click());
      await page.locator('.kv-tab[data-visualiser="gradient"]').click();
      await page.locator('[data-workspace-tab="export"]').evaluate(node => node.click());
      await page.locator('#kefe-subtab-export').evaluate(node => node.click());
      await page.evaluate(() => { const select = document.getElementById('exportResolution'); select.value = '720'; select.dispatchEvent(new Event('change', { bubbles: true })); });
      const exportButton = page.locator('#exportButton');
      await page.waitForSelector('#exportButton[data-shadcn-hydrated="true"]');
      assert.equal(await page.evaluate(() => document.getElementById('exportButton') === window.__originalExportButton), true, 'export button identity retained');
      assert.equal(await exportButton.getAttribute('data-slot'), 'button');
      const exportBounds = await exportButton.boundingBox();
      assert.ok(exportBounds && exportBounds.x >= 0 && exportBounds.x + exportBounds.width <= width + 1, 'export button fits viewport');
      await exportButton.focus();
      await page.evaluate(() => window.kefeExportDialog.open({ title: 'Track', artist: 'Artist', format: 'webm', resolution: '1280 × 720', aspect: '16:9', duration: '0:01' }));
      const dialog = page.getByRole('dialog', { name: 'Rendering your video' });
      await dialog.waitFor();
      assert.equal(await dialog.getAttribute('data-slot'), 'dialog-content');
      const rect = await dialog.boundingBox();
      assert.ok(rect.x >= 0 && rect.x + rect.width <= width + 1, 'dialog fits viewport');
      await page.keyboard.press('Escape');
      assert.equal(await dialog.isVisible(), true, 'active render cannot be dismissed');
      await page.evaluate(() => window.kefeExportDialog.progress(42, 'Rendering test'));
      await page.waitForFunction(() => document.querySelector('[data-slot="progress"]')?.getAttribute('aria-valuenow') === '42');
      await page.evaluate(() => window.kefeExportDialog.finish(false, 'Test failure'));
      await page.getByRole('dialog', { name: 'Export failed' }).getByRole('button', { name: 'Close' }).click();
      await page.waitForFunction(() => document.activeElement?.id === 'exportButton');
      await page.evaluate(() => {
        window.__originalRecorder = window.MediaRecorder;
        window.MediaRecorder = class { static isTypeSupported() { return true; } constructor() { throw new Error('Forced recorder failure'); } };
      });
      await exportButton.click();
      const failed = page.getByRole('dialog', { name: 'Export failed' });
      await failed.waitFor({ timeout: 15000 });
      assert.match(await failed.locator('#kefeExportFootnote').textContent(), /Forced recorder failure/);
      await failed.getByRole('button', { name: 'Close' }).click();
      await page.evaluate(() => { window.MediaRecorder = window.__originalRecorder; });
      const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
      await exportButton.click();
      const complete = page.getByRole('dialog', { name: 'Export complete' });
      await complete.waitFor({ timeout: 30000 });
      assert.equal(await complete.getByRole('progressbar').getAttribute('aria-valuenow'), '100');
      assert.match(await page.locator('#exportStatus').textContent(), /Export complete/);
      const download = await downloadPromise;
      assert.match(download.suggestedFilename(), /\.webm$/);
      assert.ok(fs.statSync(await download.path()).size > 0, 'the recorded video is downloaded');
      await complete.getByRole('button', { name: 'Close' }).click();
      await page.waitForFunction(() => document.activeElement?.id === 'exportButton');
      assert.deepEqual(errors, [], `no page errors at ${width}px`);
      await context.close();
    }
    console.log('PASS: shadcn export dialog and progress, error and real video export in desktop and mobile Chromium');
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
