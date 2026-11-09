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
  const sampleRate = 8000, samples = sampleRate * 10;
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
    for (const width of [1440, 390, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: width < 500, serviceWorkers: 'block' });
      const page = await context.newPage(), errors = [];
      await page.addInitScript(() => {
        const observer = new MutationObserver(() => {
          if (document.getElementById('playButton') && document.getElementById('restartButton')) {
            window.__originalTransportButtons = [document.getElementById('playButton'), document.getElementById('restartButton')];
            observer.disconnect();
          }
        });
        observer.observe(document, { childList: true, subtree: true });
      });
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error' && /hydrat|react error/i.test(message.text())) errors.push(message.text()); });
      await page.goto(`http://127.0.0.1:${server.address().port}/editor.html`);
      const slider = page.getByRole('slider', { name: 'Timeline' });
      await slider.waitFor();
      assert.equal(await slider.getAttribute('aria-valuetext'), '0:00 of 0:30');
      await page.waitForSelector('.kefe-transport[data-shadcn-hydrated="true"]');
      assert.equal(await page.locator('.kefe-transport [data-slot="button"]').count(), 2);
      assert.equal(await page.evaluate(() => window.__originalTransportButtons?.every(node => document.getElementById(node.id) === node)), true, 'hydration preserves the editor’s button nodes and their existing listeners');
      await page.locator('#mediaInput').setInputFiles({ name: 'seek-test.wav', mimeType: 'audio/wav', buffer: audioFixture() });
      await page.waitForFunction(() => document.getElementById('kefeAudio')?.duration >= 10);
      await page.waitForFunction(() => document.querySelector('[role="slider"][aria-label="Timeline"]')?.getAttribute('aria-valuemax') === '10');
      const bar = page.locator('#waveform');
      let box = await bar.boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForFunction(() => Math.abs(document.getElementById('kefeAudio').currentTime - 5) < 0.1);
      assert.equal(await slider.getAttribute('aria-valuetext'), '0:05 of 0:10');
      await slider.focus(); await page.keyboard.press('End');
      await page.waitForFunction(() => Number(document.getElementById('kefeTime').value) === 10);
      await page.keyboard.press('Home');
      await page.waitForFunction(() => Number(document.getElementById('kefeTime').value) === 0);
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() => Number(document.getElementById('kefeTime').value) === 0.01);
      await bar.evaluate(node => node.scrollIntoView({ block: 'center' }));
      box = await bar.boundingBox();
      await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2);
      await page.mouse.down();
      assert.ok((await bar.getAttribute('class')).includes('is-scrubbing'));
      await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2, { steps: 8 });
      await page.mouse.up();
      await page.waitForFunction(() => Math.abs(Number(document.getElementById('kefeTime').value) - 8) < 0.2);
      assert.ok(!(await bar.getAttribute('class')).includes('is-scrubbing'));
      if (width < 500) {
        box = await bar.boundingBox();
        await page.touchscreen.tap(box.x + box.width * 0.3, box.y + box.height / 2);
        await page.waitForFunction(() => Math.abs(Number(document.getElementById('kefeTime').value) - 3) < 0.2);
        await page.touchscreen.tap(box.x + box.width * 0.8, box.y + box.height / 2);
        await page.waitForFunction(() => Math.abs(Number(document.getElementById('kefeTime').value) - 8) < 0.2);
      }
      await page.locator('#playButton').click();
      await page.waitForFunction(() => !document.getElementById('kefeAudio').paused && document.getElementById('kefeAudio').currentTime > 8.15);
      assert.equal(await page.locator('#playButton').getAttribute('aria-label'), 'Pause');
      await page.locator('#playButton').click();
      await page.waitForFunction(() => document.getElementById('kefeAudio').paused);
      await page.waitForFunction(() => Math.abs(Number(document.querySelector('[role="slider"][aria-label="Timeline"]').getAttribute('aria-valuenow')) - Number(document.getElementById('kefeTime').value)) < 0.1);
      await page.waitForFunction(() => document.getElementById('playButton').getAttribute('aria-label') === 'Play');
      await page.locator('#restartButton').focus(); await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.getElementById('kefeAudio').currentTime === 0);
      assert.deepEqual(errors, [], `no page or hydration errors at ${width}px`);
      await context.close();
    }
    console.log('PASS: shadcn timeline and transport buttons, click, drag, touch, keyboard, spoken time and playback in desktop and mobile Chromium');
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
