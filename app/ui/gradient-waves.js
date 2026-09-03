/* KEFE — Gradient Waves
   Native Canvas recreation of the supplied GradientWaves visual.
   No framework dependency; exposes a reusable renderer for the landing surface
   and the editor background system. */
(() => {
  'use strict';

  const DEFAULTS = {
    horizonColor: '#370ee1', waveColor: '#000000', crestColor: '#35365b',
    speed: 0.15, amplitude: 5, waveScale: 0.3, waveRatio: 0.85, swell: 0,
    turbulence: 60, tilt: 1.3, zoom: 2.5, height: 2, fogDepth: 60,
    detail: 'low', brightness: 1.25, opacity: 0.34, mouseInteraction: false,
    parallaxStrength: 0, grain: true, grainIntensity: 0.03
  };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hex = value => {
    const h = String(value || '').replace('#', '');
    const n = h.length === 3 ? h.split('').map(x => x + x).join('') : h;
    const i = parseInt(n, 16);
    if (!Number.isFinite(i)) return [1, 1, 1];
    return [((i >> 16) & 255) / 255, ((i >> 8) & 255) / 255, (i & 255) / 255];
  };

  function createGradientWaves(options = {}) {
    const settings = { ...DEFAULTS, ...options };
    const canvas = document.createElement('canvas');
    canvas.className = 'kefe-gradient-waves';
    canvas.setAttribute('aria-hidden', 'true');
    const ctx = canvas.getContext('2d', { alpha: true });
    const horizon = hex(settings.horizonColor), wave = hex(settings.waveColor), crest = hex(settings.crestColor);
    let raf = 0, running = true, width = 1, height = 1, start = performance.now(), last = -1;
    const renderScale = settings.detail === 'high' ? 0.55 : settings.detail === 'medium' ? 0.42 : 0.32;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width || canvas.clientWidth || 1));
      height = Math.max(1, Math.round(rect.height || canvas.clientHeight || 1));
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.round(width * renderScale * dpr));
      canvas.height = Math.max(1, Math.round(height * renderScale * dpr));
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    };

    const draw = now => {
      if (!running) return;
      if (width < 2 || height < 2) resize();
      const w = canvas.width, h = canvas.height;
      const t = ((now - start) / 1000) * settings.speed;
      const image = ctx.createImageData(w, h), data = image.data;
      const horizonY = h * (0.34 + settings.waveRatio * 0.22);
      const zoom = Math.max(0.15, settings.zoom), scale = Math.max(0.04, settings.waveScale);
      const amp = settings.amplitude * 0.018, turb = settings.turbulence / 100;
      const bright = settings.brightness, depth = Math.max(1, settings.fogDepth);
      const detail = settings.detail === 'high' ? 3 : settings.detail === 'medium' ? 2 : 1;
      const horizonFade = Math.max(0.01, settings.height);

      for (let y = 0; y < h; y++) {
        const ny = y / h, dy = (y - horizonY) / h;
        for (let x = 0; x < w; x++) {
          const nx = x / w, sx = (nx - 0.5) * zoom, sy = dy * zoom * settings.tilt;
          let n = Math.sin(sx * 8 * scale + t * 2.1 + sy * 3.4);
          n += Math.sin(sx * 16 * scale - t * 1.2 + sy * 6.1) * 0.48;
          n += Math.sin((sx + sy) * 25 * scale + t * 0.7) * 0.2 * turb;
          if (detail > 1) n += Math.sin((sx * 43 + sy * 11) * scale - t * 0.5) * 0.09;
          if (detail > 2) n += Math.sin((sx * 71 - sy * 19) * scale + t * 0.35) * 0.045;
          n /= 1.75;

          const ridge = Math.pow(clamp((n + 1) * 0.5, 0, 1), 1.7);
          const waveMix = clamp(0.20 + ridge * 0.72 + Math.sin(n * 3 + t) * amp, 0, 1);
          const crestMix = Math.pow(clamp((ridge - 0.62) / 0.38, 0, 1), 1.25);
          const vertical = clamp((ny - 0.06) / 0.94, 0, 1);
          const fog = clamp(Math.abs(dy) * depth * 0.006, 0, 0.82);
          let r = horizon[0] * (1 - waveMix) + wave[0] * waveMix;
          let g = horizon[1] * (1 - waveMix) + wave[1] * waveMix;
          let b = horizon[2] * (1 - waveMix) + wave[2] * waveMix;
          r = r * (1 - crestMix) + crest[0] * crestMix;
          g = g * (1 - crestMix) + crest[1] * crestMix;
          b = b * (1 - crestMix) + crest[2] * crestMix;
          r = r * (1 - fog) + horizon[0] * fog;
          g = g * (1 - fog) + horizon[1] * fog;
          b = b * (1 - fog) + horizon[2] * fog;
          const glow = (1 - vertical) * 0.16 * horizonFade;
          const grain = settings.grain ? (Math.sin((x + 17) * 12.9898 + (y + 31) * 78.233 + now * 0.001) - 0.5) * settings.grainIntensity : 0;
          const i = (y * w + x) * 4;
          data[i] = clamp((r + glow + grain) * bright, 0, 1) * 255;
          data[i + 1] = clamp((g + glow + grain) * bright, 0, 1) * 255;
          data[i + 2] = clamp((b + glow + grain) * bright, 0, 1) * 255;
          data[i + 3] = settings.opacity * 255;
        }
      }
      ctx.putImageData(image, 0, 0);
      last = now;
      raf = requestAnimationFrame(draw);
    };

    const onResize = () => resize();
    resize();
    window.addEventListener('resize', onResize, { passive: true });
    raf = requestAnimationFrame(draw);
    return {
      canvas,
      start() { if (!running) { running = true; start = performance.now(); raf = requestAnimationFrame(draw); } },
      stop() { running = false; cancelAnimationFrame(raf); },
      redraw() { if (last >= 0) draw(last); },
      destroy() { running = false; cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); canvas.remove(); }
    };
  }

  window.KefeGradientWaves = { create: createGradientWaves, defaults: { ...DEFAULTS } };
})();
