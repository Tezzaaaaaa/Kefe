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
const sizes = [
  [1440, 1000],
  [1024, 900],
  [768, 1024],
  [390, 844]
];

const server = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const relative = url === '/' ? 'index.html' : url.replace(/^\/+/, '');
    const file = join(root, relative);
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
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
    const main = document.querySelector('main');
    const sidebar = document.querySelector('.sidebar');
    const preview = document.querySelector('.preview');
    const nav = document.querySelector('.wizard-nav');
    const body = document.body;
    const doc = document.documentElement;
    const rect = el => el?.getBoundingClientRect();
    const mr = rect(main), sr = rect(sidebar), pr = rect(preview), nr = rect(nav);
    return {
      wizard: body.classList.contains('wizard-mode'),
      horizontalOverflow: doc.scrollWidth > window.innerWidth + 2,
      mainVisible: Boolean(mr && mr.width > 0 && mr.height > 0),
      sidebarVisible: Boolean(sr && sr.width > 0 && sr.height > 0),
      previewPresent: Boolean(pr),
      navPresent: Boolean(nr),
      previewWidth: pr?.width || 0,
      previewHeight: pr?.height || 0,
      navBottom: nr ? Math.round(window.innerHeight - nr.bottom) : null,
      viewport: [window.innerWidth, window.innerHeight]
    };
  });
  if (!result.wizard || result.horizontalOverflow || !result.mainVisible || !result.sidebarVisible || !result.previewPresent || !result.navPresent) {
    throw new Error(`Layout invariant failed at ${width}x${height}: ${JSON.stringify(result)}`);
  }
  if (result.previewWidth <= 0 || result.previewHeight <= 0) throw new Error(`Preview has invalid geometry at ${width}x${height}`);
}

async function resetPath(page, choice) {
  await page.locator('#wizardSection [data-choice]').getByText(new RegExp(`^${choice === 'visualiser' ? 'Visualiser' : choice === 'captioned' ? 'Captioned Video' : choice === 'custom' ? 'Custom' : 'Lyric Video'}$`)).click();
  if (choice === 'captioned') {
    await page.locator('#wizardSection [data-source="uploaded"]').click();
    await page.evaluate(() => { window.state.captions = { ...(window.state.captions || {}), lines: [{ start: 0, end: 1, text: 'Caption test' }] }; });
  } else {
    await page.locator('#wizardSection [data-source="none"]').click();
  }
  if (choice === 'lyric' || choice === 'custom') {
    await page.locator('#wizardNextBtn').click();
    await page.locator('#lyricsText').fill('[00:00.00]Functional test');
  }
}

try {
  for (const [width, height] of sizes) {
    const page = await browser.newPage({ viewport: { width, height } });
    page.on('pageerror', error => errors.push(`${width}x${height} pageerror: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error') errors.push(`${width}x${height} console: ${message.text()}`); });
    await boot(page);
    await assertGeometry(page, width, height);

    for (const [choice, expectedSteps] of Object.entries(paths)) {
      await boot(page);
      await resetPath(page, choice);
      const actual = await page.evaluate(() => window.kefeWizard?.steps || null);
      for (let i = 0; i < expectedSteps.length; i += 1) {
        const step = await page.evaluate(() => ({ label: document.querySelector('#wizardStepLabel')?.textContent || '', panel: document.querySelector('#wizardSection')?.textContent || '' }));
        if (!step.panel || !step.label) throw new Error(`${choice}: wizard step ${i + 1} did not render`);
        if (i < expectedSteps.length - 1) {
          const next = page.locator('#wizardNextBtn');
          if (!(await next.isEnabled())) throw new Error(`${choice}: Next disabled at ${expectedSteps[i]}`);
          if (expectedSteps[i] === 'content') await page.locator('#lyricsText').fill('[00:00.00]Functional test');
          await next.click();
        }
      }
      const final = await page.evaluate(() => ({
        stepLabel: document.querySelector('#wizardStepLabel')?.textContent,
        progress: document.querySelector('#wizardProgress')?.textContent,
        path: window.kefeWizardPath || document.body.dataset.wizardPath || null
      }));
      if (!final.stepLabel || !/Export/i.test(final.stepLabel)) throw new Error(`${choice}: did not reach export step: ${JSON.stringify(final)}`);
      await assertGeometry(page, width, height);
    }
    await page.close();
  }
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('KEFE functional sweep passed: all four wizard paths, step progression, responsive geometry and browser error checks.');
} finally {
  await browser.close();
  server.close();
}
