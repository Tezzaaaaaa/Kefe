import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = 4174;
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
const paths = {
  lyric: ['intro', 'source', 'content', 'style', 'background', 'preview', 'export'],
  visualiser: ['intro', 'source', 'style', 'background', 'preview', 'export'],
  captioned: ['intro', 'source', 'captions', 'style', 'background', 'preview', 'export'],
  custom: ['intro', 'source', 'content', 'style', 'background', 'preview', 'export']
};
const sizes = [[1440, 1000], [1024, 900], [768, 1024], [390, 844]];

const server = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const relative = url === '/' ? 'index.html' : url.replace(/^\/+/, '');
    const body = await readFile(join(root, relative));
    res.writeHead(200, { 'content-type': mime[extname(relative)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
});

await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
const errors = [];

async function boot(page) {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.kefeRuntime?.ready === true, null, { timeout: 15000 });
  await page.waitForFunction(() => window.kefeCaptionGen && window.kefeAnalysis && window.kefeAutoCreate && window.kefeSmartRender, null, { timeout: 15000 });
}

async function assertGeometry(page, width, height) {
  const result = await page.evaluate(() => {
    const rect = el => el?.getBoundingClientRect();
    const main = rect(document.querySelector('main'));
    const sidebar = rect(document.querySelector('.sidebar'));
    const preview = rect(document.querySelector('.preview'));
    const nav = rect(document.querySelector('.wizard-nav'));
    return {
      wizard: document.body.classList.contains('wizard-mode'),
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
      main: Boolean(main && main.width > 0 && main.height > 0),
      sidebar: Boolean(sidebar && sidebar.width > 0 && sidebar.height > 0),
      preview: Boolean(preview && preview.width > 0 && preview.height > 0),
      nav: Boolean(nav && nav.width > 0 && nav.height > 0)
    };
  });
  if (!result.wizard || result.horizontalOverflow || !result.main || !result.sidebar || !result.preview || !result.nav) {
    throw new Error(`Layout invariant failed at ${width}x${height}: ${JSON.stringify(result)}`);
  }
}

async function runPath(choice, width, height) {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('pageerror', error => errors.push(`${choice} ${width}x${height} pageerror: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') errors.push(`${choice} ${width}x${height} console: ${message.text()}`); });
  try {
    await boot(page);
    await assertGeometry(page, width, height);
    const choiceLabel = { lyric: 'Lyric Video', visualiser: 'Visualiser', captioned: 'Captioned Video', custom: 'Custom' }[choice];
    await page.locator(`#wizardSection [data-choice="${choice}"]`).click();
    if (choice === 'captioned') {
      await page.locator('#wizardSection [data-source="uploaded"]').click();
      await page.evaluate(() => {
        window.state.audio = { ...(window.state.audio || {}), ready: true, file: { name: 'functional-test.wav' }, duration: 2 };
        window.state.captions = { ...(window.state.captions || {}), lines: [{ start: 0, end: 1, text: 'Caption test' }] };
      });
    } else {
      await page.locator('#wizardSection [data-source="none"]').click();
    }

    const expected = paths[choice];
    for (let i = 0; i < expected.length; i += 1) {
      const label = await page.locator('#wizardStepLabel').textContent();
      if (!label?.trim()) throw new Error(`${choice}: missing step label at ${expected[i]}`);
      if (i === expected.length - 1) break;
      if (expected[i] === 'source' && (choice === 'lyric' || choice === 'custom')) {
        await page.locator('#wizardNextBtn').click();
        await page.locator('#lyricsText').fill('[00:00.00]Functional test');
      } else if (expected[i] === 'content') {
        await page.locator('#lyricsText').fill('[00:00.00]Functional test');
        await page.locator('#wizardNextBtn').click();
      } else {
        const next = page.locator('#wizardNextBtn');
        if (!(await next.isEnabled())) throw new Error(`${choice}: Next disabled at ${expected[i]}`);
        await next.click();
      }
      await page.waitForTimeout(50);
    }
    const finalLabel = await page.locator('#wizardStepLabel').textContent();
    if (!/Export/i.test(finalLabel || '')) throw new Error(`${choice}: did not reach export step; got ${finalLabel}`);
    await assertGeometry(page, width, height);
    console.log(`PASS ${choiceLabel} @ ${width}x${height}`);
  } finally {
    await page.close();
  }
}

try {
  for (const [width, height] of sizes) {
    for (const choice of Object.keys(paths)) await runPath(choice, width, height);
  }
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('KEFE functional sweep passed: all four wizard paths across desktop, tablet and mobile geometry with browser error checks.');
} finally {
  await browser.close();
  server.close();
}
