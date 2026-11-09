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
      for (const file of ['privacy', 'terms']) {
        const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block' });
        const page = await context.newPage(), errors = [];
        await page.addInitScript(() => {
          const observer = new MutationObserver(() => {
            const card = document.querySelector('.kefe-legal-card');
            const draft = document.querySelector('.draft');
            if (card && draft && (location.pathname.includes('terms') || document.querySelector('table'))) {
              window.__legalNodes = [card, draft, document.querySelector('table')].filter(Boolean);
              observer.disconnect();
            }
          });
          observer.observe(document, { childList: true, subtree: true });
        });
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error' && /hydrat|react error/i.test(message.text())) errors.push(message.text()); });
        await page.goto(`http://127.0.0.1:${server.address().port}/legal/${file}.html`);
        await page.waitForSelector('.kefe-legal-card[data-hydrated="true"]');
        assert.equal(await page.evaluate(() => window.__legalNodes.every(node => node.isConnected)), true, 'legal document nodes are preserved');
        assert.equal(await page.locator('main [data-slot="card"]').count(), 1);
        assert.equal(await page.locator('main [data-slot="alert"][role="note"]').count(), 1);
        assert.match(await page.locator('.draft').innerText(), /Draft.*Not yet reviewed by a lawyer/s);
        assert.equal(await page.locator('h1').innerText(), file === 'privacy' ? 'KEFE Privacy Policy' : 'KEFE Terms of Use');
        assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `no page overflow at ${width}px`);
        if (file === 'privacy') {
          assert.equal(await page.locator('[data-slot="table"]').count(), 1);
          assert.equal(await page.locator('[data-slot="table-head"][scope="col"]').count(), 3);
          assert.equal(await page.locator('[data-slot="table-body"] [data-slot="table-row"]').count(), 6);
          assert.equal(await page.locator('[data-slot="table-cell"]').count(), 18);
          if (width <= 390) {
            const region = page.locator('.kefe-legal-table-mount');
            assert.equal(await region.getAttribute('tabindex'), '0');
            await region.focus();
            assert.equal(await page.evaluate(() => document.activeElement.className), 'kefe-legal-table-mount');
            assert.ok(await region.evaluate(el => el.scrollWidth > el.clientWidth), 'table scrolls locally on small screens');
            await page.keyboard.press('ArrowRight');
            await page.waitForFunction(() => document.querySelector('.kefe-legal-table-mount').scrollLeft > 0);
          }
        }
        assert.deepEqual(errors, [], `no page errors for ${file} at ${width}px`);
        await context.close();
      }
    }
    // Policy text and all existing placeholders must remain available without JS.
    const { JSDOM } = require('jsdom');
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 844 } });
    const page = await context.newPage();
    for (const file of ['privacy', 'terms']) {
      const source = fs.readFileSync(path.resolve(__dirname, `../legal-src/${file}.html`), 'utf8');
      const sourceText = new JSDOM(source).window.document.querySelector('main').textContent.replace(/\s+/g, ' ').trim();
      await page.goto(`http://127.0.0.1:${server.address().port}/legal/${file}.html`);
      const text = await page.locator('main').evaluate(node => node.textContent.replace(/\s+/g, ' ').trim());
      assert.equal(text, sourceText, `${file} built policy text must match the source`);
      assert.equal(await page.locator('.draft').isVisible(), true, 'draft warning is visible without JS');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'no horizontal page overflow without JS');
    }
    await context.close();
    console.log('PASS: shadcn legal Card, Alert and Table; unchanged text, no-JS fallback and responsive layout');
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
