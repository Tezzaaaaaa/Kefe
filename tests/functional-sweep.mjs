import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = 4174;
const sizes = [[1440, 1000], [1024, 900], [768, 1024], [390, 844]];
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };

const server = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const relative = url === '/' ? 'index.html' : url.replace(/^\/+/, '');
    res.writeHead(200, { 'content-type': mime[extname(relative)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(await readFile(join(root, relative)));
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(port, '127.0.0.1', resolve);
});

const browser = await chromium.launch({ headless: true });
const errors = [];

async function boot(page) {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.waitForFunction(() => window.kefeRuntime?.ready === true, null, { timeout: 15000 });
  await page.waitForFunction(() => window.kefeCaptionGen && window.kefeAnalysis && window.kefeSmartRender, null, { timeout: 15000 });
}

async function assertSingleGuidedFlow(page, width, height) {
  const result = await page.evaluate(() => {
    const wizardNav = document.querySelectorAll('.wizard-nav');
    const wizardPanel = document.querySelector('#wizardSection');
    const wizardNext = document.querySelector('#wizardNextBtn');
    const legacyNav = document.querySelectorAll('.section-nav, .section-nav-link');
    const sidebarSections = [...document.querySelectorAll('.sidebar > .section')].filter(section => section.id !== 'wizardSection');
    return {
      wizardNavCount: wizardNav.length,
      wizardPanel: Boolean(wizardPanel),
      wizardNext: Boolean(wizardNext),
      legacyNavCount: legacyNav.length,
      sidebarSections,
      wizardStep: document.body.dataset.wizardStep || '',
      overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
      main: Boolean(document.querySelector('main')?.getBoundingClientRect().width),
      sidebar: Boolean(document.querySelector('.sidebar')?.getBoundingClientRect().width),
      preview: Boolean(document.querySelector('.preview')?.getBoundingClientRect().width),
    };
  });
  if (result.wizardNavCount !== 1 || !result.wizardPanel || !result.wizardNext || result.legacyNavCount !== 0 || result.overflow || !result.main || !result.sidebar || !result.preview) {
    throw new Error(`Single guided flow invariant failed at ${width}x${height}: ${JSON.stringify(result)}`);
  }
  if (result.wizardStep !== 'intro') throw new Error(`Unexpected initial wizard step: ${result.wizardStep}`);
}

async function assertSections(page) {
  const result = await page.evaluate(() => ({
    audio: Boolean(document.querySelector('#audioSection')),
    lyrics: Boolean(document.querySelector('#textSection')),
    fx: Boolean(document.querySelector('#fxSection')),
    background: Boolean(document.querySelector('#backgroundSection')),
    export: Boolean(document.querySelector('#exportSection')),
    preview: Boolean(document.querySelector('#stageCanvas')),
    audioAccept: document.querySelector('#audioInput')?.accept || '',
    backgroundAccept: document.querySelector('#backgroundInput')?.accept || '',
  }));
  if (!result.audio || !result.lyrics || !result.fx || !result.background || !result.export || !result.preview) throw new Error(`Missing core editor sections: ${JSON.stringify(result)}`);
  if (!result.audioAccept.includes('audio') || !result.backgroundAccept.includes('video')) throw new Error(`Media inputs are not configured: ${JSON.stringify(result)}`);
}

async function next(page, expectedStep) {
  await page.locator('#wizardNextBtn').click();
  await page.waitForFunction(step => document.body.dataset.wizardStep === step, expectedStep, { timeout: 3000 });
}

async function assertGuidedEditing(page) {
  await page.locator('#startLyricVideo').click();
  await page.waitForFunction(() => document.body.dataset.wizardStep === 'source');

  await page.evaluate(() => {
    window.state.audio = { ...(window.state.audio || {}), ready: true, file: { name: 'functional-test.mp3' }, duration: 4 };
  });
  await page.locator('#wizardNextBtn').click();
  await page.waitForFunction(() => document.body.dataset.wizardStep === 'lyrics');

  await page.locator('#lyricsText').fill('[00:00.00]Functional test line\n[00:02.00]Second test line');
  await page.locator('#wizardNextBtn').click();
  await page.waitForFunction(() => document.body.dataset.wizardStep === 'style');

  await page.locator('#lyricStyleBlock [data-effect="brat"], #kefeLyricStyleGrid [data-wizard-effect="brat"]').first().click();
  await page.waitForFunction(() => window.state?.style?.effect === 'brat');
  await next(page, 'background');

  await page.locator('#backgroundSection [data-background-preset="gradient"]').click();
  await page.waitForFunction(() => window.state?.background?.type === 'image');
  await next(page, 'preview');
  await next(page, 'export');

  const result = await page.evaluate(() => ({
    caption: Boolean(window.kefeCaptionGen?.generate),
    analysis: Boolean(window.kefeAnalysis?.analyzeLyrics),
    smartRender: Boolean(window.kefeSmartRender?.prepare),
    effect: window.state.style.effect,
    background: window.state.background.type,
  }));
  if (!result.caption || !result.analysis || !result.smartRender || result.effect !== 'brat' || result.background !== 'image') throw new Error(`Guided editor state failed: ${JSON.stringify(result)}`);
}

async function runViewport(width, height) {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('pageerror', error => errors.push(`${width}x${height} pageerror: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') errors.push(`${width}x${height} console: ${message.text()}`); });
  try {
    await boot(page);
    await assertSingleGuidedFlow(page, width, height);
    await assertSections(page);
    await assertGuidedEditing(page);
    console.log(`PASS guided editor @ ${width}x${height}`);
  } finally {
    await page.close();
  }
}

try {
  for (const [width, height] of sizes) await runViewport(width, height);
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('KEFE functional sweep passed: single guided wizard, no competing section navigation, responsive geometry, media inputs, lyric/style/background flow, runtime modules, and state persistence.');
} finally {
  await browser.close();
  server.close();
}
