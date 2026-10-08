/* KEFE Visualiser — Randomize-style animated stencil effect.
   Font-independent treatment inspired by Ion Lucin's animated Randomize typeface.
   The selected font supplies the glyph geometry; this module supplies the animated
   stencil segmentation and grayscale state changes.
*/
(() => {
  'use strict';
  const u = window.kefeEffectUtils;
  window.kefeEffects = window.kefeEffects || {};
  if (!u) { console.error('[lyric-randomize] requires effects/core.js'); return; }

  const KEY = 'kefe.randomize.v1';
  const DEFAULT = { speed: 1, density: 8, jitter: 18, contrast: 100, direction: 1, softness: 0 };
  let S = Object.assign({}, DEFAULT);
  try { S = Object.assign(S, JSON.parse(localStorage.getItem(KEY) || 'null')); } catch (_) {}
  const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (_) {} };
  const redraw = () => { try { window.kefeLyrics?.redraw(); } catch (_) {} };

  let maskCanvas = null, maskCtx = null, workCanvas = null, workCtx = null;
  function buffers(w, h) {
    if (!maskCanvas) { maskCanvas = document.createElement('canvas'); maskCtx = maskCanvas.getContext('2d'); }
    if (!workCanvas) { workCanvas = document.createElement('canvas'); workCtx = workCanvas.getContext('2d'); }
    if (maskCanvas.width !== w || maskCanvas.height !== h) { maskCanvas.width = w; maskCanvas.height = h; }
    if (workCanvas.width !== w || workCanvas.height !== h) { workCanvas.width = w; workCanvas.height = h; }
    maskCtx.setTransform(1, 0, 0, 1, 0, 0); maskCtx.clearRect(0, 0, w, h);
    workCtx.setTransform(1, 0, 0, 1, 0, 0); workCtx.clearRect(0, 0, w, h);
    return { m: maskCtx, g: workCtx };
  }

  function hash(n) {
    n = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
    return n - Math.floor(n);
  }

  function fit(ctx, family, text, size, maxWidth) {
    let s = Math.max(18, Number(size) || 76);
    const safe = family.replace(/"/g, '');
    ctx.font = '700 ' + s + 'px "' + safe + '",system-ui,sans-serif';
    while (s > 18 && ctx.measureText(text).width > maxWidth) {
      s -= Math.max(1, Math.round(s * .025));
      ctx.font = '700 ' + s + 'px "' + safe + '",system-ui,sans-serif';
    }
    return s;
  }

  function rowsFor(ctx, text, family, size, maxWidth) {
    const words = String(text || '').trim().split(/\s+/).filter(Boolean);
    const rows = [];
    let row = '';
    for (const word of words) {
      const test = row ? row + ' ' + word : word;
      if (row && ctx.measureText(test).width > maxWidth) { rows.push(row); row = word; }
      else row = test;
    }
    if (row) rows.push(row);
    return rows;
  }

  function drawState(ctx, w, h, style, text, time, seed) {
    const family = String(style.kefeMotionFont || 'Open Sans').trim() || 'Open Sans';
    const safe = family.replace(/"/g, '');
    const maxWidth = w * .84;
    let size = Math.min(w, h) * .13;
    size = fit(ctx, family, text, size, maxWidth);
    let rows = rowsFor(ctx, text, family, size, maxWidth);
    while (rows.length > 4 && size > 18) {
      size -= Math.max(1, Math.round(size * .03));
      ctx.font = '700 ' + size + 'px "' + safe + '",system-ui,sans-serif';
      rows = rowsFor(ctx, text, family, size, maxWidth);
    }

    const lineH = size * 1.08;
    const totalH = rows.length * lineH;
    const top = h / 2 - totalH / 2 + lineH / 2;
    const width = Math.max(1, ...rows.map(r => ctx.measureText(r).width));
    const left = (w - width) / 2;
    const b = buffers(w, h);
    const m = b.m, g = b.g;

    m.textBaseline = 'middle';
    m.textAlign = 'left';
    m.font = '700 ' + size + 'px "' + safe + '",system-ui,sans-serif';
    rows.forEach((row, i) => m.fillText(row, left + (width - m.measureText(row).width) / 2, top + i * lineH));

    const density = Math.round(clamp(S.density, 3, 16));
    const cell = Math.max(7, Math.min(34, Math.min(w, h) / (density * 2.1)));
    const angle = -.58 * (S.direction >= 0 ? 1 : -1);
    const diag = Math.sqrt(w * w + h * h);
    const phase = time * S.speed * .95;
    const contrast = clamp(S.contrast, 0, 150) / 100;
    const jitter = clamp(S.jitter, 0, 100) / 100;

    g.save();
    g.translate(w / 2, h / 2);
    g.rotate(angle);
    g.translate(-w / 2, -h / 2);
    for (let y = -diag; y < diag; y += cell) {
      for (let x = -diag; x < diag; x += cell) {
        const gx = Math.floor((x + diag) / cell);
        const gy = Math.floor((y + diag) / cell);
        const n = hash(seed * 17 + gx * 13.37 + gy * 71.91);
        const local = phase * .9 + n * 3.5 + (gx - gy) * .035 * jitter;
        const state = Math.floor(((local % 4) + 4) % 4);
        const tones = ['#000000', '#2F2F2F', '#565656', '#B5B5B5'];
        const base = parseInt(tones[state].slice(1), 16);
        const q = Math.max(0, Math.min(255, Math.round(128 + (base - 128) * contrast)));
        const tone = '#' + q.toString(16).padStart(2, '0').repeat(3);
        const skew = (n - .5) * cell * .35 * jitter;
        g.fillStyle = tone;
        g.fillRect(x + skew, y, cell * .94, cell * .94);
      }
    }
    g.restore();

    g.globalCompositeOperation = 'destination-in';
    g.drawImage(maskCanvas, 0, 0);
    g.globalCompositeOperation = 'source-over';

    if (S.softness > 0) {
      ctx.save();
      try { ctx.filter = 'blur(' + Math.min(2, Number(S.softness) || 0) + 'px)'; } catch (_) {}
      ctx.drawImage(workCanvas, 0, 0);
      ctx.restore();
    } else {
      ctx.drawImage(workCanvas, 0, 0);
    }
  }

  window.kefeEffects.randomize = function(ctx, w, h, style, lines, time) {
    const active = u.activeLine(lines, time);
    if (!active) return;
    const text = String(active.line.text || '').trim();
    if (!text) return;
    const start = Number(active.line.time) || 0;
    const end = Math.max(start + .3, Number(active.line.endTime) || start + 3);
    const elapsed = time - start;
    const enter = u.smoother(clamp(elapsed / .28));
    const exit = u.smoother(clamp((end - time) / .22));
    const alpha = enter * exit;
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    drawState(ctx, w, h, style, text, elapsed, active.index + 1);
    ctx.restore();
  };

  function makeControl(panel, label, min, max, step, get, set, fmt) {
    const wrap = document.createElement('label');
    wrap.className = 'kefe-visualiser-field';
    const head = document.createElement('span');
    const b = document.createElement('b'); b.textContent = label;
    const out = document.createElement('output');
    head.append(b, out);
    const input = document.createElement('input'); input.type = 'range'; input.min = min; input.max = max; input.step = step;
    const sync = () => { input.value = get(); out.textContent = fmt(get()); };
    input.addEventListener('input', () => { set(Number(input.value)); sync(); persist(); redraw(); });
    wrap.append(head, input); panel.appendChild(wrap); sync();
    return sync;
  }

  function buildControls() {
    const form = document.querySelector('[data-panel-view="effects"] .kefe-form');
    const select = document.getElementById('lyricEffect');
    if (!form || !select || document.getElementById('kefeRandomizeControls')) return;
    const group = document.createElement('div');
    group.id = 'kefeRandomizeControls';
    group.className = 'kefe-visualiser-control-group';
    const title = document.createElement('div'); title.className = 'kefe-label'; title.textContent = 'Randomize';
    group.appendChild(title);
    const syncers = [];
    syncers.push(makeControl(group, 'Animation speed', .1, 3, .05, () => S.speed, v => S.speed = v, v => v.toFixed(2) + '×'));
    syncers.push(makeControl(group, 'Stencil density', 3, 16, 1, () => S.density, v => S.density = v, v => String(v)));
    syncers.push(makeControl(group, 'Randomness', 0, 100, 1, () => S.jitter, v => S.jitter = v, v => v + '%'));
    syncers.push(makeControl(group, 'Contrast', 0, 150, 1, () => S.contrast, v => S.contrast = v, v => v + '%'));
    syncers.push(makeControl(group, 'Softness', 0, 2, .1, () => S.softness, v => S.softness = v, v => v.toFixed(1) + 'px'));
    const row = document.createElement('div'); row.className = 'kefe-visualiser-spin-row';
    const lab = document.createElement('span'); lab.className = 'kefe-label'; lab.textContent = 'Direction';
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'kefe-btn';
    const syncDir = () => { btn.textContent = S.direction > 0 ? 'Forward' : 'Reverse'; btn.setAttribute('aria-pressed', S.direction > 0 ? 'true' : 'false'); };
    btn.addEventListener('click', () => { S.direction *= -1; syncDir(); persist(); redraw(); });
    row.append(lab, btn); group.appendChild(row); syncDir();
    const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'kefe-btn'; reset.textContent = 'Reset Randomize';
    reset.addEventListener('click', () => { S = Object.assign({}, DEFAULT); syncers.forEach(fn => fn()); syncDir(); persist(); redraw(); });
    group.appendChild(reset);
    const anchor = form.querySelector('.kefe-font-card');
    if (anchor) form.insertBefore(group, anchor.nextSibling); else form.appendChild(group);
    const updateVisibility = () => { group.hidden = select.value !== 'randomize'; };
    select.addEventListener('change', updateVisibility);
    updateVisibility();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildControls); else buildControls();
})();
