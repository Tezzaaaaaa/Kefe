import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = 4174;
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
const sizes = [[1440, 1000], [1024, 900], [768, 1024], [390, 844]];

const server = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const relative = url === '/' ? 'index.html' : url.replace(/^\/+/, '');
    const body = await readFile(join(root, relative));
    res.writeHead(200, { 'content-type': mime[extname(relative)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

await new Promise((resolve, reject) => {
  const onError = error => {
    server.off('listening', onListening);
    reject(error);
  };
  const onListening = () => {
    server.off('error', onError);
    resolve();
  };
  server.once('error', onError);
  server.once('listening', onListening);
  server.listen(port, '127.0.0.1');
});

const browser = await chromium.launch({ headless: true });
const errors = [];

async function boot(page) {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.waitForFunction(() => window.kefeRuntime?.ready === true, null, { timeout: 15000 });
  await page.waitForFunction(() => window.kefeCaptionGen && window.kefeAnalysis && window.kefeAutoCreate && window.kefeSmartRender, null, { timeout: 15000 });
}

async function assertDirectEditor(page, width, height) {
  const result = await page.evaluate(() => {
    const rect = el => el?.getBoundingClientRect();
    const main = rect(document.querySelector('main'));
    const sidebar = rect(document.querySelector('.sidebar'));
    const preview = rect(document.querySelector('.preview'));
    const links = [...document.querySelectorAll('.section-nav-link')].map(link => link.dataset.nav);
    return {
      wizardMode: document.body.classList.contains('wizard-mode'),
      wizardPanel: Boolean(document.querySelector('#wizardSection,.wizard-nav,#wizardNextBtn')),
      wizardGlobals: Boolean(window.kefeWizard || window.kefeEditingFlow),
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
      main: Boolean(main && main.width > 0 && main.height > 0),
      sidebar: Boolean(sidebar && sidebar.width > 0 && sidebar.height > 0),
      preview: Boolean(preview && preview.width > 0 && preview.height > 0),
      nav: links
    };
  });
  const expected = ['audio', 'export', 'text', 'background', 'fx'];
  if (
    result.wizardMode ||
    result.wizardPanel ||
    result.wizardGlobals ||
    result.horizontalOverflow ||
    !result.main ||
    !result.sidebar ||
    !result.preview ||
    JSON.stringify(result.nav) !== JSON.stringify(expected)
  ) {
    throw new Error(`Direct editor invariant failed at ${width}x${height}: ${JSON.stringify(result)}`);
  }
}

async function assertSections(page) {
  const sections = await page.evaluate(() => ({
    audio: Boolean(document.querySelector('#audioSection')),
    format: Boolean(document.querySelector('#exportSection')),
    text: Boolean(document.querySelector('#textSection')),
    background: Boolean(document.querySelector('#backgroundSection')),
    fx: Boolean(document.querySelector('#fxSection')),
    preview: Boolean(document.querySelector('#stageCanvas')),
    audioAccept: document.querySelector('#audioInput')?.accept || '',
    backgroundAccept: document.querySelector('#backgroundInput')?.accept || ''
  }));
  if (!sections.audio || !sections.format || !sections.text || !sections.background || !sections.fx || !sections.preview) {
    throw new Error(`Missing core editor sections: ${JSON.stringify(sections)}`);
  }
  if (!sections.audioAccept.includes('audio') || !sections.backgroundAccept.includes('video')) {
    throw new Error(`Media inputs are not configured for the core media flow: ${JSON.stringify(sections)}`);
  }
}

async function clickNav(page, key, sectionId) {
  await page.locator(`.section-nav-link[data-nav="${key}"]`).click();
  await page.waitForFunction(id => document.getElementById(id)?.classList.contains('active'), sectionId, { timeout: 3000 });
  const result = await page.evaluate(({ key, sectionId }) => ({
    linkActive: document.querySelector(`.section-nav-link[data-nav="${key}"]`)?.classList.contains('active'),
    sectionActive: document.getElementById(sectionId)?.classList.contains('active')
  }), { key, sectionId });
  if (!result.linkActive || !result.sectionActive) throw new Error(`Navigation failed for ${key}: ${JSON.stringify(result)}`);
}

async function seedLyrics(page) {
  await page.evaluate(() => {
    const textarea = document.getElementById('lyricsText');
    textarea.value = '[00:00.00]Functional test line\n[00:02.00]Second test line';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    window.state.audio = { ...(window.state.audio || {}), ready: true, file: { name: 'functional-test.mp3' }, duration: 4 };
  });
  await page.waitForFunction(() => document.getElementById('lyricsText')?.value.includes('Functional test line'), null, { timeout: 3000 });
}

async function assertEditing(page) {
  await clickNav(page, 'export', 'exportSection');
  const format = await page.locator('#aspectSelect').inputValue();
  if (!['9:16', '1:1', '16:9'].includes(format)) throw new Error(`Unexpected default aspect ratio: ${format}`);

  await clickNav(page, 'text', 'textSection');
  await seedLyrics(page);
  await page.locator('#lyricStyleBlock [data-effect="brat"]').click();
  await page.waitForFunction(() => window.state?.style?.effect === 'brat', null, { timeout: 3000 });

  await clickNav(page, 'background', 'backgroundSection');
  await page.locator('#backgroundSection [data-background-preset="gradient"]').click();
  await page.waitForFunction(() => window.state?.background?.type === 'image', null, { timeout: 3000 });

  await clickNav(page, 'audio', 'audioSection');
  const globals = await page.evaluate(() => ({
    caption: Boolean(window.kefeCaptionGen?.generate),
    analysis: Boolean(window.kefeAnalysis?.analyzeLyrics),
    autoCreate: Boolean(window.kefeAutoCreate?.run),
    smartRender: Boolean(window.kefeSmartRender?.prepare)
  }));
  if (!Object.values(globals).every(Boolean)) throw new Error(`Core runtime globals missing: ${JSON.stringify(globals)}`);

  const analysis = await page.evaluate(() => window.kefeAnalysis.analyzeLyrics(window.document.getElementById('lyricsText').value, 4));
  if (!analysis?.validation || analysis.validation.count !== 2) throw new Error(`Lyrics analysis failed: ${JSON.stringify(analysis)}`);

  const auto = await page.evaluate(() => window.kefeAutoCreate.run({ allowWithoutAudio: true }));
  if (!auto || !auto.plan?.effect) throw new Error(`Auto Create failed: ${JSON.stringify(auto)}`);

  const renderPlan = await page.evaluate(() => window.kefeSmartRender.prepare());
  if (!renderPlan || !renderPlan.preset) throw new Error(`Smart Render did not prepare: ${JSON.stringify(renderPlan)}`);

  const persisted = await page.evaluate(() => ({
    effect: window.state.style.effect,
    background: window.state.background.type,
    autoCreated: Boolean(window.kefeAutoCreate.lastResult),
    renderPreset: window.kefeSmartRender.lastPlan?.preset
  }));
  if (persisted.effect !== 'brat' || persisted.background !== 'image' || !persisted.autoCreated || !persisted.renderPreset) {
    throw new Error(`Editor state did not persist: ${JSON.stringify(persisted)}`);
  }
}

async function runViewport(width, height) {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('pageerror', error => errors.push(`${width}x${height} pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`${width}x${height} console: ${message.text()}`);
  });
  try {
    await boot(page);
    await assertDirectEditor(page, width, height);
    await assertSections(page);
    await assertEditing(page);
    await assertDirectEditor(page, width, height);
    console.log(`PASS direct editor @ ${width}x${height}`);
  } finally {
    await page.close();
  }
}

try {
  for (const [width, height] of sizes) await runViewport(width, height);
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('KEFE functional sweep passed: direct editor boot, no wizard layer, responsive geometry, media inputs, section navigation, lyrics analysis, effect/background persistence, Auto Create, Smart Render and browser error checks.');
} finally {
  await browser.close();
  server.close();
}
