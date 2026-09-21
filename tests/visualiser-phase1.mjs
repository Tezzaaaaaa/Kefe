import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = 4174;
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

const server = createServer(async (req, res) => {
  try {
    const relative = decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const body = await readFile(join(root, relative));
    res.writeHead(200, { 'content-type': mime[extname(relative)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.setDefaultTimeout(15000);

try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'commit' });
  await page.waitForFunction(() => window.kefePremiumVisualisers && window.kefeRuntime?.ready === true);

  const modes = ['cinematicfluid', 'cosmicattractor', 'neuralnetwork'];
  const determinism = await page.evaluate((modes) => {
    const out = {};
    const features = { bass: 0.72, mids: 0.48, treble: 0.61, energy: 0.66, flux: 0.35 };
    for (const mode of modes) {
      const fn = window.kefePremiumVisualisers[mode];
      const standalone = document.createElement('canvas');
      standalone.width = standalone.height = 640;
      const sctx = standalone.getContext('2d');
      fn(sctx, 640, 640, 100 / 30, features, { style: {} });
      const a = sctx.getImageData(0, 0, 640, 640).data;

      const sequence = document.createElement('canvas');
      sequence.width = sequence.height = 640;
      const qctx = sequence.getContext('2d');
      for (let frame = 0; frame <= 100; frame++) {
        qctx.clearRect(0, 0, 640, 640);
        fn(qctx, 640, 640, frame / 30, {
          bass: 0.5 + 0.22 * Math.sin(frame * 0.11),
          mids: 0.45 + 0.18 * Math.cos(frame * 0.07),
          treble: 0.55 + 0.14 * Math.sin(frame * 0.17),
          energy: 0.52 + 0.20 * Math.sin(frame * 0.05),
          flux: 0.3
        }, { style: {} });
      }
      // Render frame 100 again from the exact same inputs used for the standalone frame.
      qctx.clearRect(0, 0, 640, 640);
      fn(qctx, 640, 640, 100 / 30, features, { style: {} });
      const b = qctx.getImageData(0, 0, 640, 640).data;
      let different = 0;
      let maxDelta = 0;
      for (let i = 0; i < a.length; i++) {
        const d = Math.abs(a[i] - b[i]);
        if (d) different++;
        if (d > maxDelta) maxDelta = d;
      }
      out[mode] = { differentBytes: different, maxByteDelta: maxDelta, pixelIdentical: different === 0 };
    }
    return out;
  }, modes);

  for (const mode of modes) {
    if (!determinism[mode].pixelIdentical) throw new Error(`Determinism failed for ${mode}: ${JSON.stringify(determinism[mode])}`);
  }

  const parity = await page.evaluate((modes) => {
    const frame = { bass: 0.7, mids: 0.5, treble: 0.6, energy: 0.65, flux: 0.32 };
    const results = {};
    for (const mode of modes) {
      const preview = document.createElement('canvas');
      preview.width = preview.height = 640;
      const pctx = preview.getContext('2d');
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = exportCanvas.height = 640;
      const ectx = exportCanvas.getContext('2d');
      pctx.clearRect(0,0,640,640);
      ectx.clearRect(0,0,640,640);
      window.kefePremiumVisualisers[mode](pctx,640,640,100/30,frame,{style:{}});
      window.kefePremiumVisualisers[mode](ectx,640,640,100/30,frame,{style:{}});
      const a=pctx.getImageData(0,0,640,640).data, b=ectx.getImageData(0,0,640,640).data;
      let different=0;
      for(let i=0;i<a.length;i++) if(a[i]!==b[i]) different++;
      results[mode]={differentBytes:different,pixelIdentical:different===0};
    }
    return results;
  }, modes);

  for (const mode of modes) {
    if (!parity[mode].pixelIdentical) throw new Error(`Preview/export parity failed for ${mode}: ${JSON.stringify(parity[mode])}`);
  }

  const performance = await page.evaluate((modes) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1920; canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    const frame = { bass: 0.72, mids: 0.48, treble: 0.61, energy: 0.66, flux: 0.35 };
    const results = {};
    for (const mode of modes) {
      for(let i=0;i<10;i++){ctx.clearRect(0,0,1920,1080);window.kefePremiumVisualisers[mode](ctx,1920,1080,i/30,frame,{style:{}});}
      const samples=[];
      for(let i=0;i<60;i++){
        ctx.clearRect(0,0,1920,1080);
        const t0=performance.now();
        window.kefePremiumVisualisers[mode](ctx,1920,1080,i/30,frame,{style:{}});
        samples.push(performance.now()-t0);
      }
      samples.sort((a,b)=>a-b);
      results[mode]={
        meanMs: samples.reduce((a,b)=>a+b,0)/samples.length,
        medianMs: samples[Math.floor(samples.length/2)],
        p95Ms: samples[Math.floor(samples.length*.95)-1],
        maxMs: samples[samples.length-1]
      };
    }
    return results;
  }, modes);

  console.log(JSON.stringify({ determinism, parity, performance }, null, 2));
  process.stdout.write(JSON.stringify({ determinism, parity, performance }));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
