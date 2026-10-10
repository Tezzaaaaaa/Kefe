import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const modulePath = process.env.PLAYWRIGHT_MODULE;
assert.ok(modulePath, 'PLAYWRIGHT_MODULE must point to Playwright’s installed index.mjs');
const { chromium } = await import(pathToFileURL(modulePath).href);

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'kefe-export-regression-'));
const port = Number(process.env.KEFE_TEST_PORT || 4179);
let server;
let browser;

function run(command, args) {
  const result = spawnSync(command, args, { encoding: null });
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${result.stderr?.toString() || result.stdout?.toString()}`);
  }
  return result;
}

async function waitForServer(url) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Local test server did not start');
}

try {
  const audioPath = path.join(tempDir, 'test-tone.wav');
  const videoPath = path.join(tempDir, 'test-background.webm');
  run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2.5',
    '-c:a', 'pcm_s16le', audioPath]);
  run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', 'color=c=red:s=320x180:r=30:d=2.5',
    '-an', '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuv420p', videoPath]);

  server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', root], {
    stdio: 'ignore'
  });
  const pageUrl = `http://127.0.0.1:${port}/artifacts/kefe-visualiser/public/legacy/index.html`;
  await waitForServer(pageUrl);

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('#mediaInput').waitFor();
  await page.locator('#mediaInput').setInputFiles(audioPath);
  await page.waitForFunction(() => {
    const audio = document.querySelector('#kefeAudio');
    return audio && audio.src && Number.isFinite(audio.duration) && audio.duration > 0;
  }, null, { timeout: 20000 });

  await page.locator('#bgVideoInput').setInputFiles(videoPath);
  await page.waitForFunction(() => window.kefeBackground?.hasVideo?.() === true, null, { timeout: 15000 });
  await page.waitForFunction(() => {
    const select = document.querySelector('#lyricEffect');
    return select && select.options.length > 1;
  }, null, { timeout: 15000 });

  await page.locator('button.kefe-section[data-panel="lyrics"]').click();
  await page.locator('#lyricsInput').fill('Export regression test lyric');
  await page.locator('button.kefe-section[data-panel="effects"]').click();
  await page.locator('#lyricEffect').selectOption({ index: 1 });
  await page.locator('button.kefe-section[data-panel="export"]').click();
  await page.locator('#exportResolution').selectOption('720');

  const editorPixels = await page.evaluate(() => {
    const canvas = document.querySelector('#kefeCanvas');
    if (!canvas || !canvas.width || !canvas.height) return 0;
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let visible = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 16) visible += 1;
    return visible;
  });
  assert.ok(editorPixels > 100, `Lyrics/effect canvas should contain visible pixels before export; got ${editorPixels}`);

  await page.evaluate(() => {
    const probe = window.__kefeExportProbe = {
      backgroundPaintCalls: 0,
      videoFramesDrawnToExport: 0,
      lyricCanvasDrawnToExport: 0,
      visualiserCanvasDrawnToExport: 0
    };
    const background = window.kefeBackground;
    const originalPaint = background.paint;
    background.paint = function (ctx, width, height, time) {
      probe.backgroundPaintCalls += 1;
      return originalPaint.call(this, ctx, width, height, time);
    };
    const originalDrawImage = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (source, ...args) {
      if (this.canvas.width >= 1200 && this.canvas.height >= 600) {
        if (source instanceof HTMLVideoElement && source.videoWidth > 0) probe.videoFramesDrawnToExport += 1;
        if (source?.id === 'kefeCanvas') probe.lyricCanvasDrawnToExport += 1;
        if (source?.id === 'kefeVisualiserCanvas') probe.visualiserCanvasDrawnToExport += 1;
      }
      return originalDrawImage.call(this, source, ...args);
    };
  });

  const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
  await page.locator('#exportButton').click();
  const download = await downloadPromise;
  const filePath = path.join(tempDir, download.suggestedFilename());
  await download.saveAs(filePath);
  const file = await stat(filePath);
  const probe = await page.evaluate(() => window.__kefeExportProbe);

  assert.ok(file.size > 1000, `Export should contain video data; got ${file.size} bytes`);
  assert.ok(probe.backgroundPaintCalls > 0, 'Export should paint the selected background layer');
  assert.ok(probe.videoFramesDrawnToExport > 0, 'Uploaded background-video frames should be drawn into export frames');
  assert.ok(probe.lyricCanvasDrawnToExport > 0, 'The editor lyric/effect canvas should be included in export frames');
  assert.ok(probe.visualiserCanvasDrawnToExport > 0, 'The visualiser canvas should be included in export frames');

  const exportStatus = await page.locator('#exportStatus').innerText();
  assert.match(exportStatus, /Export complete/i, `Unexpected export status: ${exportStatus}`);
  const decodedPixel = run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-ss', '1', '-i', filePath,
    '-frames:v', '1', '-vf', 'crop=20:20:0:0,scale=1:1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1']);
  const pixelBytes = decodedPixel.stdout;
  assert.equal(pixelBytes.length, 3, `Expected one decoded RGB pixel; got ${pixelBytes.length} bytes`);
  const [red, green, blue] = pixelBytes;
  assert.ok(red > green * 1.5 && red > blue * 1.5 && red > 70,
    `Top-left exported frame should retain the red uploaded video background; got RGB(${red}, ${green}, ${blue})`);
  console.log(JSON.stringify({ result: 'passed', bytes: file.size, editorPixels, exportedCornerRgb: [red, green, blue], probe, pageErrors }, null, 2));
} finally {
  if (browser) await browser.close();
  if (server) server.kill('SIGTERM');
  await rm(tempDir, { recursive: true, force: true });
}
