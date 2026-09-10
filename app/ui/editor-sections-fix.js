/* KEFE editor section wiring fixes. Keeps lyric style, background controls, Visual FX and export controls separate. */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const q = (sel) => document.querySelector(sel);
  const qa = (sel) => [...document.querySelectorAll(sel)];

  function moveTitleCardIntoExport() {
    const exportSection = $('exportSection');
    const backgroundSection = $('backgroundSection');
    const titleBlock = backgroundSection?.querySelector('.sub-block:has(#titleCardEnabled)');
    if (!exportSection || !titleBlock) return;

    let top = exportSection.querySelector('.export-top-controls');
    if (!top) {
      top = document.createElement('div');
      top.className = 'export-top-controls';
      const aspectLabel = exportSection.querySelector('label:has(#aspectSelect)');
      const aspectInfo = $('aspectInfo');
      if (aspectLabel) top.appendChild(aspectLabel);
      if (aspectInfo) top.appendChild(aspectInfo);
      exportSection.insertBefore(
        top,
        exportSection.firstChild?.nextSibling || exportSection.firstChild,
      );
    }
    if (!top.contains(titleBlock)) top.appendChild(titleBlock);
  }

  function fixNavigation() {
    const exportHeading = $('exportSection')?.querySelector('h3');
    if (exportHeading) exportHeading.textContent = 'Export';


    const legacyFx = $('fxSection');
    if (legacyFx) legacyFx.hidden = true;
  }

  function addStyles() {
    if ($('kefe-editor-sections-fix-style')) return;
    const style = document.createElement('style');
    style.id = 'kefe-editor-sections-fix-style';
    style.textContent = `
      #fxSection[hidden]{display:none!important}
      .export-top-controls{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;align-items:start;margin-bottom:12px}
      .export-top-controls>.sub-block{margin:0}
      .export-top-controls>label{margin:0}
      .background-effects-block{margin-top:14px}
      .background-effects-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
      .background-fx-button{min-height:38px;padding:8px 9px;border:1px solid var(--border,#303030);border-radius:10px;background:var(--panel,#151515);color:var(--text,#fff);font:inherit;cursor:pointer;text-align:left}
      .background-fx-button:hover{border-color:var(--muted,#777)}
      .background-fx-button.active-background-fx{border-color:var(--red,#ff3b30);box-shadow:0 0 0 1px var(--red,#ff3b30) inset}
      .background-fx-label{display:block;font-size:12px;font-weight:700}
      .background-fx-desc{display:block;font-size:10px;opacity:.62;margin-top:2px}
      .background-effects-controls{margin-top:10px}
      @media(max-width:720px){.export-top-controls{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function loadBitsVisuals() {
    if (!$('kefe-bits-visuals-css')) {
      const link = document.createElement('link');
      link.id = 'kefe-bits-visuals-css';
      link.rel = 'stylesheet';
      link.href = './app/ui/bits-visuals.css';
      document.head.appendChild(link);
    }
    if (!$('kefe-bits-visuals-script')) {
      const script = document.createElement('script');
      script.id = 'kefe-bits-visuals-script';
      script.src = './app/ui/bits-visuals.js';
      script.defer = true;
      document.body.appendChild(script);
    }
  }

  const bgCanvas = document.createElement('canvas');
  const bgCtx = bgCanvas.getContext('2d');
  const bgDefaults = { effect: 'none', intensity: 0.55, speed: 1 };
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, Number(v) || 0));
  const rand = (n, s = 0) => {
    const x = Math.sin(n * 12.9898 + s * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };

  function ensureBgSize(w, h) {
    if (bgCanvas.width !== w || bgCanvas.height !== h) {
      bgCanvas.width = w;
      bgCanvas.height = h;
    }
  }

  function drawBackgroundEffect(w, h, t, settings) {
    ensureBgSize(w, h);
    const s = { ...bgDefaults, ...settings };
    const a = clamp(s.intensity),
      speed = Math.max(0.1, Number(s.speed) || 1),
      time = t * speed;
    bgCtx.clearRect(0, 0, w, h);
    if (s.effect === 'none') return bgCanvas;
    if (s.effect === 'gradient-flow') {
      const x = w * (0.5 + 0.38 * Math.sin(time * 0.22)),
        y = h * (0.5 + 0.35 * Math.cos(time * 0.17));
      const g = bgCtx.createRadialGradient(x, y, 0, w * 0.9, h * 0.7);
      g.addColorStop(0, 'rgba(125,82,255,.82)');
      g.addColorStop(0.38, 'rgba(35,84,160,.46)');
      g.addColorStop(1, 'rgba(3,5,12,1)');
      bgCtx.fillStyle = g;
      bgCtx.fillRect(0, 0, w, h);
    } else if (s.effect === 'aurora') {
      bgCtx.fillStyle = '#05070c';
      bgCtx.fillRect(0, 0, w, h);
      for (let i = 0; i < 6; i++) {
        const x = w * (0.15 + i * 0.16) + Math.sin(time * 0.32 + i) * w * 0.12;
        const y = h * (0.25 + 0.12 * Math.sin(time * 0.21 + i));
        const r = Math.min(w, h) * (0.35 + 0.08 * Math.sin(time * 0.3 + i));
        const g = bgCtx.createRadialGradient(x, y, 0, x, y, r);
        const c = ['#5227ff', '#36d6c5', '#7cff67', '#ff4fd8'][i % 4];
        g.addColorStop(0, c + 'aa');
        g.addColorStop(0.48, c + '35');
        g.addColorStop(1, c + '00');
        bgCtx.fillStyle = g;
        bgCtx.fillRect(0, 0, w, h);
      }
    } else if (s.effect === 'waves') {
      bgCtx.fillStyle = '#070a10';
      bgCtx.fillRect(0, 0, w, h);
      for (let i = 0; i < 9; i++) {
        bgCtx.beginPath();
        for (let x = 0; x <= w; x += Math.max(8, w / 120)) {
          const y =
            h * (0.18 + i * 0.085) +
            Math.sin((x / w) * 8 + time * (0.7 + i * 0.07) + i) * h * (0.035 + 0.012 * a);
          if (x === 0) bgCtx.moveTo(x, y);
          else bgCtx.lineTo(x, y);
        }
        bgCtx.strokeStyle = `hsla(${190 + i * 18},80%,${48 + i * 3}%,${0.1 + 0.035 * a})`;
        bgCtx.lineWidth = Math.max(2, w * 0.0025);
        bgCtx.stroke();
      }
    } else if (s.effect === 'particles') {
      bgCtx.fillStyle = '#05070b';
      bgCtx.fillRect(0, 0, w, h);
      const count = Math.round(90 + 100 * a);
      for (let i = 0; i < count; i++) {
        const x = rand(i, 1) * w,
          base = rand(i, 2) * h;
        const y = (base - time * (10 + rand(i, 3) * 26)) % h;
        const r = 0.7 + rand(i, 4) * 2.2;
        bgCtx.globalAlpha = 0.16 + 0.5 * rand(i, 5) * a;
        bgCtx.fillStyle = '#ffffff';
        bgCtx.beginPath();
        bgCtx.arc(x, y, r, 0, Math.PI * 2);
        bgCtx.fill();
      }
      bgCtx.globalAlpha = 1;
    } else if (s.effect === 'spotlight-pulse') {
      bgCtx.fillStyle = '#070504';
      bgCtx.fillRect(0, 0, w, h);
      const pulse = 0.55 + 0.45 * Math.sin(time * 1.6);
      const g = bgCtx.createRadialGradient(
        w * 0.5,
        h * (0.38 + 0.025 * pulse),
        0,
        w * 0.5,
        h * 0.4,
        Math.max(w, h) * (0.55 + 0.08 * pulse),
      );
      g.addColorStop(0, `rgba(255,205,130,${0.72 * a})`);
      g.addColorStop(0.34, `rgba(125,72,32,${0.32 * a})`);
      g.addColorStop(1, 'rgba(0,0,0,1)');
      bgCtx.fillStyle = g;
      bgCtx.fillRect(0, 0, w, h);
    } else if (s.effect === 'film') {
      bgCtx.fillStyle = '#100d0a';
      bgCtx.fillRect(0, 0, w, h);
      const count = Math.round(w * h * 0.000018 * (0.5 + a));
      for (let i = 0; i < count; i++) {
        const x = Math.floor(rand(i, time * 7) * w),
          y = Math.floor(rand(i, time * 11) * h),
          v = rand(i, time * 13) > 0.5 ? 255 : 0;
        bgCtx.fillStyle = `rgba(${v},${v},${v},${0.05 + 0.12 * a})`;
        bgCtx.fillRect(x, y, 1, 1);
      }
    }
    bgCtx.globalAlpha = 1;
    return bgCanvas;
  }

  function installBackgroundRenderer() {
    if (window.__kefeBackgroundFxInstalled || typeof window.render !== 'function') return;
    window.__kefeBackgroundFxInstalled = true;
    const original = window.render;
    window.render = function (ctx, w, h, appState, mediaCache) {
      const effect = appState?.background?.effect || 'none';
      if (effect === 'none') return original(ctx, w, h, appState, mediaCache);
      const image = mediaCache?.image;
      const video = mediaCache?.video;
      const type = appState.background.type;
      const frame = drawBackgroundEffect(
        w,
        h,
        Number(appState.playback?.currentTime) || 0,
        appState.background,
      );
      if (mediaCache) mediaCache.image = frame;
      appState.background.type = 'image';
      appState.background.image = frame;
      try {
        original(ctx, w, h, appState, mediaCache);
      } finally {
        appState.background.type = type;
        appState.background.image = image;
        if (mediaCache) mediaCache.image = image;
        if (video && mediaCache) mediaCache.video = video;
      }
    };
  }

  function addBackgroundEffects() {
    const section = $('backgroundSection');
    if (!section || section.querySelector('.background-effects-block')) return;
    const block = document.createElement('div');
    block.className = 'sub-block background-effects-block';
    block.innerHTML = `<div class="sub-heading">Background effects</div><div class="background-effects-grid"></div><div class="background-effects-controls"></div>`;
    const grid = block.querySelector('.background-effects-grid');
    const defs = [
      ['none', 'Off', 'Use the selected background as-is'],
      ['gradient-flow', 'Gradient Flow', 'Slow moving colour field'],
      ['aurora', 'Aurora', 'Animated atmospheric colour bands'],
      ['waves', 'Waves', 'Subtle animated wave lines'],
      ['particles', 'Particles', 'Floating light particles'],
      ['spotlight-pulse', 'Spotlight Pulse', 'Breathing central light'],
      ['film', 'Film', 'Animated film texture'],
    ];
    defs.forEach(([name, label, desc]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'background-fx-button';
      b.dataset.backgroundFx = name;
      b.innerHTML = `<span class="background-fx-label">${label}</span><span class="background-fx-desc">${desc}</span>`;
      b.addEventListener('click', () => {
        if (window.isExporting) return;
        window.state.background.effect = name;
        grid
          .querySelectorAll('.background-fx-button')
          .forEach((x) =>
            x.classList.toggle('active-background-fx', x.dataset.backgroundFx === name),
          );
        window.redrawCurrentPreviewFrame?.();
      });
      grid.appendChild(b);
    });
    const controls = block.querySelector('.background-effects-controls');
    controls.innerHTML =
      '<div class="control-row"><label for="backgroundFxIntensity">Intensity <span id="backgroundFxIntensityVal">55%</span></label><input id="backgroundFxIntensity" type="range" min="0" max="100" step="1" value="55"></div><div class="control-row"><label for="backgroundFxSpeed">Animation speed <span id="backgroundFxSpeedVal">1.0×</span></label><input id="backgroundFxSpeed" type="range" min="25" max="250" step="5" value="100"></div>';
    const intensity = controls.querySelector('#backgroundFxIntensity'),
      speed = controls.querySelector('#backgroundFxSpeed');
    intensity.addEventListener('input', () => {
      window.state.background.intensity = Number(intensity.value) / 100;
      controls.querySelector('#backgroundFxIntensityVal').textContent = `${intensity.value}%`;
      window.redrawCurrentPreviewFrame?.();
    });
    speed.addEventListener('input', () => {
      window.state.background.speed = Number(speed.value) / 100;
      controls.querySelector('#backgroundFxSpeedVal').textContent =
        `${(Number(speed.value) / 100).toFixed(1)}×`;
      window.redrawCurrentPreviewFrame?.();
    });
    section.appendChild(block);
    const current = window.state.background.effect || 'none';
    grid
      .querySelectorAll('.background-fx-button')
      .forEach((x) =>
        x.classList.toggle('active-background-fx', x.dataset.backgroundFx === current),
      );
  }

  function keepBackgroundMediaStable() {
    const input = $('backgroundInput');
    if (!input) return;
    input.addEventListener('change', () => {
      if (window.state?.background) window.state.background.effect = 'none';
      window.redrawCurrentPreviewFrame?.();
    });
  }

  function boot() {
    addStyles();
    fixNavigation();
    moveTitleCardIntoExport();
    addBackgroundEffects();
    keepBackgroundMediaStable();
    installBackgroundRenderer();
    loadBitsVisuals();
    const observer = new MutationObserver(() => {
      fixNavigation();
      if ($('visualFxSection')) {
      }
    });
    observer.observe(document.querySelector('.sidebar') || document.body, {
      childList: true,
      subtree: true,
    });
    setTimeout(() => {
      fixNavigation();
      moveTitleCardIntoExport();
      addBackgroundEffects();
      installBackgroundRenderer();
      loadBitsVisuals();
    }, 50);
  }

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
