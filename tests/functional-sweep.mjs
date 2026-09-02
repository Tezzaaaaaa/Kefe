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

await new Promise((resolve, reject) => {
  const onError = error => { server.off('listening', onListening); reject(error); };
  const onListening = () => { server.off('error', onError); resolve(); };
  server.once('error', onError);
  server.once('listening', onListening);
  server.listen(port, '127.0.0.1');
});

const browser = await chromium.launch({ headless: true });
const errors = [];

async function boot(page) {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.waitForFunction(() => window.kefeRuntime?.ready === true, null, { timeout: 15000 });
  await page.waitForFunction(() => window.kefeCaptionGen && window.kefeAnalysis && window.kefeAutoCreate && window.kefeSmartRender && window.kefeWizard, null, { timeout: 15000 });
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

async function state(page) {
  return page.evaluate(() => window.kefeWizard.getState());
}

async function assertStep(page, expected, choice) {
  await page.waitForFunction(step => window.kefeWizard?.getState()?.step === step, expected, { timeout: 3000 });
  const current = await state(page);
  if (current.step !== expected || current.path !== choice || current.index !== paths[choice].indexOf(expected)) {
    throw new Error(`${choice}: expected ${expected}, got ${JSON.stringify(current)}`);
  }
  const label = await page.locator('#wizardStepLabel').textContent();
  if ((label || '').trim().toLowerCase() !== ({ intro: 'format', source: 'media', content: 'content', captions: 'captions', style: 'style', background: 'background', preview: 'preview', export: 'export' }[expected])) {
    throw new Error(`${choice}: step label mismatch at ${expected}: ${label}`);
  }
}

async function next(page, choice, expectedNext) {
  const button = page.locator('#wizardNextBtn');
  if (!(await button.isEnabled())) throw new Error(`${choice}: Next disabled before ${expectedNext}`);
  await button.click();
  await assertStep(page, expectedNext, choice);
}

async function prepareContent(page, choice) {
  if (choice === 'captioned') {
    await page.evaluate(() => {
      window.state.audio = { ...(window.state.audio || {}), ready: true, file: { name: 'functional-test.wav' }, duration: 2 };
      window.state.captions = { ...(window.state.captions || {}), lines: [{ start: 0, end: 1, text: 'Caption test' }] };
    });
    return;
  }
  await page.locator('#lyricsText').fill('[00:00.00]Functional test');
}

async function verifyStyleAndBackground(page, choice) {
  if (choice !== 'visualiser') {
    const effect = page.locator('#wizardSection [data-forward-effect="brat"]');
    if (await effect.count()) {
      await effect.click();
      await page.waitForFunction(() => window.state?.style?.effect === 'brat', null, { timeout: 3000 });
      const current = await page.evaluate(() => window.state.style.effect);
      if (current !== 'brat') throw new Error(`${choice}: selected lyric effect did not persist`);
    }
  }

  await page.locator('#wizardSection').locator('[data-background-preset="gradient"]').count().catch(() => 0);
  await next(page, choice, 'background');
  const background = page.locator('#backgroundSection [data-background-preset="gradient"]');
  if (await background.count()) {
    await background.click();
    await page.waitForFunction(() => window.state?.background?.type === 'image', null, { timeout: 3000 });
    await page.waitForFunction(() => document.querySelector('#backgroundSection [data-background-preset="gradient"]')?.classList.contains('active-background'), null, { timeout: 3000 });
  }
}

async function runPath(choice, width, height) {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('pageerror', error => errors.push(`${choice} ${width}x${height} pageerror: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') errors.push(`${choice} ${width}x${height} console: ${message.text()}`); });
  try {
    await boot(page);
    await assertGeometry(page, width, height);
    await assertStep(page, 'intro', choice);

    await page.locator(`#wizardSection [data-choice="${choice}"]`).click();
    await assertStep(page, 'intro', choice);
    await next(page, choice, 'source');

    if (choice === 'captioned') {
      await page.locator('#wizardSection [data-source="uploaded"]').click();
      await page.evaluate(() => {
        window.state.audio = { ...(window.state.audio || {}), ready: true, file: { name: 'functional-test.wav' }, duration: 2 };
      });
      await page.waitForFunction(() => window.kefeWizard.getState().source === 'uploaded', null, { timeout: 3000 });
      await page.waitForFunction(() => !document.querySelector('#wizardNextBtn')?.disabled, null, { timeout: 3000 });
      await next(page, choice, 'captions');
      await prepareContent(page, choice);
      await page.waitForFunction(() => window.state?.captions?.lines?.length > 0, null, { timeout: 3000 });
      await page.waitForFunction(() => !document.querySelector('#wizardNextBtn')?.disabled, null, { timeout: 3000 });
      await next(page, choice, 'style');
    } else {
      await page.locator('#wizardSection [data-source="none"]').click();
      await next(page, choice, 'content');
      await prepareContent(page, choice);
      await page.waitForFunction(() => !document.querySelector('#wizardNextBtn')?.disabled, null, { timeout: 3000 });
      await next(page, choice, 'style');
    }

    await verifyStyleAndBackground(page, choice);
    await next(page, choice, 'preview');

    const previewState = await page.evaluate(() => ({
      step: window.kefeWizard.getState().step,
      expanded: document.querySelector('.preview')?.classList.contains('preview-expanded'),
      summary: document.querySelectorAll('#wizardSection .wizard-summary-row').length,
      playButton: Boolean(document.querySelector('#wizardPlayBtn'))
    }));
    if (previewState.step !== 'preview' || !previewState.expanded || previewState.summary < 2 || !previewState.playButton) {
      throw new Error(`${choice}: preview invariant failed: ${JSON.stringify(previewState)}`);
    }

    await next(page, choice, 'export');
    const exportState = await state(page);
    if (exportState.step !== 'export' || exportState.index !== paths[choice].length - 1) {
      throw new Error(`${choice}: export step invariant failed: ${JSON.stringify(exportState)}`);
    }
    if (!(await page.locator('#exportSection').isVisible())) throw new Error(`${choice}: export section not visible`);

    await page.locator('#wizardBackBtn').click();
    await assertStep(page, 'preview', choice);
    await assertGeometry(page, width, height);
    console.log(`PASS ${choice} @ ${width}x${height}`);
  } finally {
    await page.close();
  }
}

try {
  for (const [width, height] of sizes) {
    for (const choice of Object.keys(paths)) await runPath(choice, width, height);
  }
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('KEFE functional sweep passed: exact wizard paths, gated readiness, style/background persistence, usable preview, export handoff, back navigation, responsive geometry and browser error checks.');
} finally {
  await browser.close();
  server.close();
}
