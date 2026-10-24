/* apps/web/app/effects/lyric-brat.js
 *
 * Brat lyric effect — KEFE replacement.
 *
 * Registered as: window.kefeEffects.brat = drawBratEffect;
 * Signature:     drawBratEffect(g, W, H, style, shown, effT, titleArtImage)
 *
 * Two visual modes (auto-selected from style, overridable per-call):
 *   'green'       — solid #8ACE00 background, black low-res + blurred text.
 *   'transparent' — no background; whole line drawn in ONE colour
 *                   (black OR white) chosen from the frame's average
 *                   brightness underneath.
 *
 * The brat look is a treatment, not a font:
 *   condensed sans-serif  →  low-res raster  →  tiny blur  →  upscale.
 * Low-res first, blur second. That ordering is what makes it read "brat".
 */
(() => {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Tunables (safe to expose later via style.brat if the editor adds UI)
   * ------------------------------------------------------------------ */
  const DEFAULTS = {
    mode: 'green',          // 'green' | 'transparent'
    green: '#8ACE00',
    textColor: '#000000',
    fontFamily: '"Arial Narrow", "Liberation Sans Narrow", Arial, sans-serif',
    weight: 400,
    downscale: 4,           // low-res factor (render small → upscale)
    blurPx: 1.2,            // applied ONLY at upscale, after pixelation
    widthSqueeze: 0.92,     // slight horizontal compression
    lineHeightMul: 1.05,
    wrapRatio: 0.85,        // max text width as fraction of canvas width
    fontSizeRatioW: 0.16,
    fontSizeRatioH: 0.22,
    contrastThreshold: 128, // avg bg luminance pivot for black/white text
    fadeMs: 180,            // per-line fade-in / fade-out
  };

  /* ------------------------------------------------------------------ *
   * Persistent offscreen buffers (one allocation, reused every frame).
   * Keyed by size so a resize just reallocates.
   * ------------------------------------------------------------------ */
  const bufs = {
    low: null,        // low-res text raster
    lctx: null,
    probe: null,      // tiny canvas used to sample background brightness
    pctx: null,
    probeSize: 16,
    lowW: 0,
    lowH: 0,
  };

  function ensureBuffers(W, H, downscale) {
    const lw = Math.max(1, Math.round(W / downscale));
    const lh = Math.max(1, Math.round(H / downscale));

    if (!bufs.low) {
      bufs.low = document.createElement('canvas');
      bufs.lctx = bufs.low.getContext('2d', { willReadFrequently: true });
    }
    if (bufs.lowW !== lw || bufs.lowH !== lh) {
      bufs.low.width = lw;
      bufs.low.height = lh;
      bufs.lowW = lw;
      bufs.lowH = lh;
    }

    if (!bufs.probe) {
      bufs.probe = document.createElement('canvas');
      bufs.pctx = bufs.probe.getContext('2d', { willReadFrequently: true });
      bufs.probe.width = bufs.probeSize;
      bufs.probe.height = bufs.probeSize;
    }
  }

  /* ------------------------------------------------------------------ *
   * Settings resolution — reads from style.brat if present, else
   * falls back to DEFAULTS. Never mutates style.
   * ------------------------------------------------------------------ */
  function resolveSettings(style) {
    const s = (style && style.brat) || {};
    const out = Object.assign({}, DEFAULTS);
    for (const k in DEFAULTS) {
      if (s[k] !== undefined && s[k] !== null) out[k] = s[k];
    }
    // Allow editor-level overrides that already exist on style.
    if (style) {
      if (style.fontFamily) out.fontFamily = style.fontFamily;
      if (style.textColor) out.textColor = style.textColor;
      if (style.color && out.mode === 'green') out.textColor = style.textColor || out.textColor;
      if (style.bratMode) out.mode = style.bratMode;
    }
    return out;
  }

  /* ------------------------------------------------------------------ *
   * Lyric line extraction.
   *
   * KEFE's `shown` is expected to be an array of line objects with at
   * least: { text, time, endTime }. Word-level timing is used when
   * present (line.words[] with { text, time, endTime } or { text, t }).
   * Anything missing degrades gracefully to whole-line timing.
   * ------------------------------------------------------------------ */
  function extractLines(shown) {
    if (!shown) return [];
    if (Array.isArray(shown)) return shown;
    if (Array.isArray(shown.lines)) return shown.lines;
    if (Array.isArray(shown.lyrics)) return shown.lyrics;
    return [];
  }

  function lineStart(l) {
    return Number(l.time ?? l.start ?? l.startTime ?? l.t ?? 0) || 0;
  }
  function lineEnd(l, next) {
    const explicit = Number(l.endTime ?? l.end ?? l.endMs);
    if (Number.isFinite(explicit)) return explicit;
    if (l.duration != null) return lineStart(l) + Number(l.duration);
    if (next) return lineStart(next);
    return lineStart(l) + 3;
  }
  function lineText(l) {
    if (typeof l.text === 'string') return l.text;
    if (typeof l.line === 'string') return l.line;
    if (Array.isArray(l.words)) return l.words.map(w => w.text ?? w.word ?? '').join(' ');
    return '';
  }

  function activeLine(lines, t) {
    for (let i = 0; i < lines.length; i++) {
      const start = lineStart(lines[i]);
      const end = lineEnd(lines[i], lines[i + 1]);
      if (t >= start && t <= end) return { line: lines[i], index: i, start, end };
    }
    return null;
  }

  /* ------------------------------------------------------------------ *
   * Text wrapping (measured against the low-res context).
   * ------------------------------------------------------------------ */
  function wrapText(ctx, text, maxWidth) {
    const words = String(text).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const lines = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (ctx.measureText(test).width > maxWidth && cur) {
        lines.push(cur);
        cur = w;
      } else {
        cur = test;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  /* ------------------------------------------------------------------ *
   * Low-res text raster.
   *   bgColor === null → transparent buffer (transparent mode)
   * ------------------------------------------------------------------ */
  function renderLowRes(text, bgColor, fgColor, cfg) {
    const ctx = bufs.lctx;
    const lw = bufs.lowW;
    const lh = bufs.lowH;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, lw, lh);
    if (bgColor) {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, lw, lh);
    }

    if (!text) return;

    const fontSize = Math.min(lw * cfg.fontSizeRatioW, lh * cfg.fontSizeRatioH);
    const font = `${cfg.weight} ${fontSize}px ${cfg.fontFamily}`;
    ctx.font = font;

    const wrapped = wrapText(ctx, text, lw * cfg.wrapRatio);
    const lineH = fontSize * cfg.lineHeightMul;
    const startY = lh / 2 - (wrapped.length - 1) * lineH / 2;

    ctx.save();
    ctx.translate(lw / 2, lh / 2);
    ctx.scale(cfg.widthSqueeze, 1);
    ctx.translate(-lw / 2, -lh / 2);

    ctx.font = font;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = fgColor;
    const maxWidth = lw * cfg.wrapRatio;
    const left = (lw - maxWidth) / 2;
    for (let i = 0; i < wrapped.length; i++) {
      const words = wrapped[i].split(/\s+/).filter(Boolean);
      const y = startY + i * lineH;
      if (words.length < 2) {
        ctx.fillText(wrapped[i], (lw - ctx.measureText(wrapped[i]).width) / 2, y, maxWidth);
        continue;
      }
      const wordWidths = words.map(word => ctx.measureText(word).width);
      const totalWordWidth = wordWidths.reduce((sum, width) => sum + width, 0);
      const gap = Math.max(0, (maxWidth - totalWordWidth) / (words.length - 1));
      let x = left;
      words.forEach((word, index) => {
        ctx.fillText(word, x, y);
        x += wordWidths[index] + gap;
      });
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ *
   * Average brightness of the pixels underneath the effect.
   *
   * The editor supplies the composited frame on `g`. We sample the
   * already-drawn region from `g` itself. If `g` has been cleared for
   * this effect's turn, the sample will be flat — that's fine, we fall
   * back to a mid luminance that picks black text.
   *
   * Sampling `g` means no extra readback plumbing from the host.
   * ------------------------------------------------------------------ */
  function sampleAverageBrightness(g, W, H, cfg) {
    const probe = bufs.probe;
    const pctx = bufs.pctx;
    const S = bufs.probeSize;

    try {
      pctx.setTransform(1, 0, 0, 1, 0, 0);
      pctx.clearRect(0, 0, S, S);
      pctx.drawImage(g.canvas, 0, 0, W, H, 0, 0, S, S);
      const data = pctx.getImageData(0, 0, S, S).data;
      let sum = 0;
      const count = S * S;
      for (let i = 0; i < data.length; i += 4) {
        sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }
      return sum / count;
    } catch (_) {
      // Tainted canvas / unavailable readback — mid luminance.
      return 255; // assume bright → choose black text
    }
  }

  /* ------------------------------------------------------------------ *
   * Line alpha from effT (real playback time). Seeking is safe because
   * every frame is a pure function of effT.
   * ------------------------------------------------------------------ */
  function lineAlpha(t, start, end, fadeMs) {
    const f = Math.max(1, fadeMs) / 1000;
    const inA  = Math.min(1, Math.max(0, (t - start) / f));
    const outA = Math.min(1, Math.max(0, (end - t) / f));
    return Math.min(inA, outA);
  }

  /* ------------------------------------------------------------------ *
   * Main entry point
   * ------------------------------------------------------------------ */
  function drawBratEffect(g, W, H, style, shown, effT, titleArtImage) {
    if (!g || !W || !H) return;

    const cfg = resolveSettings(style);
    ensureBuffers(W, H, cfg.downscale);

    const lines = extractLines(shown);
    const hit = activeLine(lines, effT);
    if (!hit) return; // nothing to draw this frame

    const text = lineText(hit.line);
    if (!text) return;

    const alpha = lineAlpha(effT, hit.start, hit.end, cfg.fadeMs);
    if (alpha <= 0) return;

    /* ---------------- GREEN MODE ---------------- */
    if (cfg.mode === 'green') {
      renderLowRes(text, cfg.green, cfg.textColor, cfg);

      g.save();
      g.globalAlpha = alpha;
      // Only set smoothing/filter we need; restore on exit.
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'low';
      const prevFilter = g.filter;
      g.filter = `blur(${cfg.blurPx}px)`;
      g.drawImage(bufs.low, 0, 0, W, H);
      g.filter = prevFilter;
      g.restore();
      return;
    }

    /* ---------------- TRANSPARENT MODE ---------------- */
    const brightness = sampleAverageBrightness(g, W, H, cfg);
    const useBlack = brightness > cfg.contrastThreshold;
    const color = useBlack ? '#000000' : '#ffffff';

    renderLowRes(text, null, color, cfg);

    g.save();
    g.globalAlpha = alpha;
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'low';
    const prevFilter = g.filter;
    g.filter = `blur(${cfg.blurPx}px)`;
    g.drawImage(bufs.low, 0, 0, W, H);
    g.filter = prevFilter;
    g.restore();
  }

  /* ------------------------------------------------------------------ *
   * Register (overwrite any prior Brat entry, as the brief specifies).
   * ------------------------------------------------------------------ */
  window.kefeEffects = window.kefeEffects || {};
  window.kefeEffects.brat = drawBratEffect;
})();
