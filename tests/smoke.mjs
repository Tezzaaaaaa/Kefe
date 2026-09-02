import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = 4173;
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json' };

const server = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const relative = url === '/' ? 'index.html' : url.replace(/^\/+/, '');
    const file = join(root, relative);
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': mime[extname(file)] || 'application/octet-stream',
      'content-length': body.byteLength,
      'cache-control': 'no-store',
      connection: 'close'
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', connection: 'close' });
    res.end('Not found');
  }
});

function makeWav(seconds = 2, sampleRate = 16000) {
  const samples = Math.max(1, Math.floor(seconds * sampleRate));
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(36 + samples * 2, 4); buffer.write('WAVE', 8);
  buffer.write('fmt ', 12); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24); buffer.writeUInt32LE(sampleRate * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36); buffer.writeUInt32LE(samples * 2, 40);
  return buffer;
}

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(port, '127.0.0.1', resolve);
});

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });

try {
  const response = await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'commit', timeout: 10000 });
  if (!response || !response.ok()) throw new Error(`Smoke server returned ${response?.status() ?? 'no response'} for index.html`);

  await page.waitForFunction(() => window.kefeRuntime?.ready === true, null, { timeout: 15000 });
  await page.waitForFunction(() => window.kefeCaptionGen && window.kefeAnalysis && window.kefeAutoCreate && window.kefeSmartRender, null, { timeout: 15000 });

  await page.locator('#lyricStyleBlock [data-effect="pulse"]').click();
  await page.locator('#backgroundSection [data-background-preset="aurora"]').click();
  await page.locator('#titleCardStyle').selectOption('statement');
  const visualState = await page.evaluate(() => ({ effect: window.state.style.effect, background: window.state.background.type, title: window.state.style.titleCardStyle }));
  if (visualState.effect !== 'pulse' || visualState.background !== 'aurora' || visualState.title !== 'statement') throw new Error(`Style controls did not update state: ${JSON.stringify(visualState)}`);

  const analysis = await page.evaluate(() => window.kefeAnalysis.analyzeLyrics('[00:00.00]Hello world\n[00:00.80]Second line', 2));
  if (!analysis?.validation?.count || analysis.validation.count !== 2) throw new Error('Lyrics analysis did not return the expected timed lines');

  const wav = makeWav();
  await page.locator('#audioInput').setInputFiles({ name: 'smoke-test.wav', mimeType: 'audio/wav', buffer: wav });
  await page.waitForFunction(() => window.state?.audio?.ready === true && Number(window.state.audio.duration) > 0, null, { timeout: 10000 });
  await page.locator('#playBtn').click();
  await page.waitForTimeout(250);
  const playing = await page.evaluate(() => Boolean(window.state.playback.isPlaying));
  if (!playing) throw new Error('Preview playback did not enter the playing state');
  await page.locator('#stopBtn').click();

  const autoPlan = await page.evaluate(() => window.kefeAutoCreate.getPlan({ recommendation: 'pulse', validation: { count: 2 }, metrics: { averageCharacters: 12, linesPerMinute: 8 } }, false));
  if (autoPlan.effect !== 'pulse') throw new Error('Auto Create planning failed');
  const renderPlan = await page.evaluate(() => window.kefeSmartRender.prepare());
  if (!renderPlan?.recommended || !renderPlan.info?.width) throw new Error('Smart render preparation failed');

  await page.locator('#exportBtn').click();
  await page.waitForTimeout(250);
  const preflightVisible = await page.locator('#exportPreflight').evaluate(el => !el.classList.contains('hidden'));
  if (!preflightVisible) throw new Error('Export preflight did not open');
  await page.locator('#cancelPreflight').click();

  if (errors.length) throw new Error(errors.join('\n'));
  console.log('KEFE smoke test passed: boot → runtime → style/background → lyrics analysis → audio load → playback → auto-create → smart render → export preflight.');
} finally {
  await browser.close();
  server.close();
}
