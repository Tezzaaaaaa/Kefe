(() => {
  'use strict';
  const state = window.state;
  if (!state || window.__kefeRemoveBgLoaded) return;
  window.__kefeRemoveBgLoaded = true;

  const wrapper = document.querySelector('.canvas-wrapper');
  const backgroundSection = document.getElementById('backgroundSection');
  if (!wrapper || !backgroundSection) return;

  const ui = document.createElement('div');
  ui.className = 'sub-block kefe-cutout-tools';
  ui.innerHTML = `
    <div class="sub-heading">Foreground cutout</div>
    <div class="drop-zone" id="cutoutDrop">
      <label class="file-button" for="cutoutInput">Choose image…</label>
      <p class="control-hint">Remove the background and place the subject over your video</p>
      <input type="file" id="cutoutInput" accept="image/png,image/jpeg,image/webp" class="hidden">
    </div>
    <div class="lyrics-actions">
      <button type="button" id="removeBgBtn" class="file-button">Remove background</button>
      <button type="button" id="clearCutoutBtn" class="file-button">Remove cutout</button>
    </div>
    <div id="cutoutStatus" class="status">No foreground cutout</div>
    <div class="control-row"><label for="cutoutScale">Scale <span id="cutoutScaleVal">75%</span></label><input type="range" id="cutoutScale" min="15" max="150" value="75"></div>
    <div class="control-row"><label for="cutoutX">Horizontal <span id="cutoutXVal">50%</span></label><input type="range" id="cutoutX" min="0" max="100" value="50"></div>
    <div class="control-row"><label for="cutoutY">Vertical <span id="cutoutYVal">62%</span></label><input type="range" id="cutoutY" min="0" max="100" value="62"></div>
    <div class="control-row"><label for="cutoutOpacity">Opacity <span id="cutoutOpacityVal">100%</span></label><input type="range" id="cutoutOpacity" min="10" max="100" value="100"></div>
    <label>Motion<select id="cutoutMotion"><option value="static">Static</option><option value="rise">Rise</option><option value="slide">Slide</option><option value="drop">Drop</option><option value="drift">Drift</option></select></label>
  `;
  backgroundSection.appendChild(ui);

  const overlay = document.createElement('canvas');
  overlay.id = 'kefeForegroundCanvas';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:5;';
  if (getComputedStyle(wrapper).position === 'static') wrapper.style.position = 'relative';
  wrapper.appendChild(overlay);
  const octx = overlay.getContext('2d');

  let image = null;
  let sourceFile = null;
  let objectUrl = null;
  let busy = false;
  const input = document.getElementById('cutoutInput');
  const removeBtn = document.getElementById('removeBgBtn');
  const clearBtn = document.getElementById('clearCutoutBtn');
  const status = document.getElementById('cutoutStatus');
  const values = { scale: 0.75, x: 0.50, y: 0.62, opacity: 1, motion: 'static' };
  const redraw = () => window.redrawCurrentPreviewFrame?.();
  const setStatus = (text, cls = 'status') => { status.textContent = text; status.className = cls; };

  function readFile(file) {
    if (!file || !/^image\/(png|jpeg|webp)$/i.test(file.type)) return;
    sourceFile = file;
    setStatus(`${file.name} · ready to remove`, 'status success');
  }

  input.addEventListener('change', () => readFile(input.files?.[0]));
  document.getElementById('cutoutDrop').addEventListener('drop', e => {
    e.preventDefault();
    readFile(e.dataTransfer?.files?.[0]);
  });
  document.getElementById('cutoutDrop').addEventListener('dragover', e => e.preventDefault());

  async function removeBackground() {
    if (busy) return;
    if (!sourceFile) { setStatus('Choose an image first', 'status error'); return; }
    busy = true;
    removeBtn.disabled = true;
    setStatus('Removing background…', 'status loading');
    try {
      const body = await sourceFile.arrayBuffer();
      const response = await fetch('/api/remove-background', {
        method: 'POST',
        headers: { 'Content-Type': sourceFile.type || 'image/png' },
        body
      });
      if (!response.ok) {
        let message = `Background removal failed (${response.status})`;
        try { const data = await response.json(); if (data?.error) message = data.error; } catch (_) {}
        throw new Error(message);
      }
      const blob = await response.blob();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(blob);
      const next = new Image();
      next.onload = () => {
        image = next;
        setStatus('Background removed · foreground cutout ready', 'status success');
        redraw();
      };
      next.onerror = () => { setStatus('The processed image could not be decoded.', 'status error'); };
      next.src = objectUrl;
    } catch (error) {
      setStatus(error.message || 'Background removal failed', 'status error');
    } finally {
      busy = false;
      removeBtn.disabled = false;
    }
  }

  removeBtn.addEventListener('click', removeBackground);
  clearBtn.addEventListener('click', () => {
    image = null;
    sourceFile = null;
    input.value = '';
    if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
    setStatus('No foreground cutout');
    redraw();
  });

  function bindRange(id, key, labelId, suffix, scale) {
    const el = document.getElementById(id);
    const label = document.getElementById(labelId);
    el.addEventListener('input', () => {
      values[key] = Number(el.value) * scale;
      label.textContent = `${Math.round(Number(el.value))}${suffix}`;
      drawOverlay();
    });
  }
  bindRange('cutoutScale', 'scale', 'cutoutScaleVal', '%', 0.01);
  bindRange('cutoutX', 'x', 'cutoutXVal', '%', 0.01);
  bindRange('cutoutY', 'y', 'cutoutYVal', '%', 0.01);
  bindRange('cutoutOpacity', 'opacity', 'cutoutOpacityVal', '%', 0.01);
  document.getElementById('cutoutMotion').addEventListener('change', e => { values.motion = e.target.value; drawOverlay(); });

  function activeLineProgress(time) {
    const lines = Array.isArray(state.lyrics?.lines) ? state.lyrics.lines : [];
    let line = null;
    for (const candidate of lines) {
      if (Number(candidate?.time) <= time) line = candidate;
      else break;
    }
    if (!line) return { p: 1 };
    const start = Number(line.time) || 0;
    const duration = Math.max(0.35, Math.min(1.0, (Number(line.endTime) || start + 3) - start));
    return { p: Math.max(0, Math.min(1, (time - start) / duration)) };
  }

  function drawOverlay(targetCtx = octx, w = overlay.width, h = overlay.height, time = 0) {
    if (!targetCtx || !w || !h) return;
    targetCtx.clearRect(0, 0, w, h);
    if (!image) return;
    const iw = image.naturalWidth || image.width;
    const ih = image.naturalHeight || image.height;
    if (!iw || !ih) return;
    const baseH = h * values.scale;
    const baseW = baseH * iw / ih;
    let x = w * values.x - baseW / 2;
    let y = h * values.y - baseH / 2;
    const { p } = activeLineProgress(time);
    const intro = 1 - Math.pow(1 - Math.min(1, p / 0.35), 3);
    if (values.motion === 'rise') y += h * 0.10 * (1 - intro);
    if (values.motion === 'drop') y -= h * 0.10 * (1 - intro);
    if (values.motion === 'slide') x -= w * 0.10 * (1 - intro);
    if (values.motion === 'drift') x += Math.sin(time * 0.7) * w * 0.012;
    const scale = values.motion === 'static' ? 1 : 0.96 + intro * 0.04;
    const dw = baseW * scale, dh = baseH * scale;
    x += (baseW - dw) / 2; y += (baseH - dh) / 2;
    targetCtx.save();
    targetCtx.globalAlpha = values.opacity;
    targetCtx.drawImage(image, x, y, dw, dh);
    targetCtx.restore();
  }

  function syncOverlaySize() {
    const stage = document.getElementById('stageCanvas');
    if (!stage) return;
    if (overlay.width !== stage.width || overlay.height !== stage.height) {
      overlay.width = stage.width;
      overlay.height = stage.height;
    }
  }

  const originalRenderFrame = window.kefeRenderFrame;
  if (typeof originalRenderFrame === 'function') {
    window.kefeRenderFrame = function(ctx, w, h, time) {
      originalRenderFrame(ctx, w, h, time);
      drawOverlay(ctx, w, h, time);
    };
  }

  function loop() {
    syncOverlaySize();
    const seek = document.getElementById('seek');
    const time = Number(seek?.value) || 0;
    drawOverlay(octx, overlay.width, overlay.height, time);
    requestAnimationFrame(loop);
  }
  loop();
})();
