/* KEFE background presets — clean, reusable canvas backgrounds. */
(() => {
  'use strict';

  const params = new URLSearchParams(document.currentScript?.src?.split('?')[1] || '');
  const runtime = params.get('runtime') === '1';

  if (!runtime) {
    window.addEventListener('load', () => {
      const gradient = document.createElement('script');
      gradient.src = './app/ui/gradient-waves.js?v=20260903-1';
      gradient.async = false;
      document.body.appendChild(gradient);

      const bridge = document.createElement('script');
      bridge.textContent = 'window.state = state;';
      document.body.appendChild(bridge);

      const script = document.createElement('script');
      script.src = './app/ui/background-presets.js?v=20260903-1&runtime=1';
      script.async = false;
      document.body.appendChild(script);
    }, { once: true });
    return;
  }

  const state = window.state;
  const media = window.kefeMedia;
  const grid = document.querySelector('.background-choice-grid');
  if (!state || !media || !grid) return;

  const waveButton = (() => {
    let button = grid.querySelector('[data-background-preset="gradient-waves"]');
    if (button) return button;
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'background-choice';
    button.dataset.backgroundPreset = 'gradient-waves';
    button.innerHTML = '<span class="background-choice-preview"></span><span class="background-choice-label">Gradient Waves</span>';
    grid.appendChild(button);
    return button;
  })();

  function loadRemoveBackground() {
    if (window.__kefeRemoveBgLoaderLoaded) return;
    window.__kefeRemoveBgLoaderLoaded = true;
    const script = document.createElement('script');
    script.src = './app/ui/remove-background.js?v=20260902-1';
    script.async = false;
    document.body.appendChild(script);
  }
  loadRemoveBackground();

  const redraw = () => window.redrawCurrentPreviewFrame?.();
  const status = document.getElementById('backgroundStatus');
  const colorInput = document.getElementById('backgroundColor');
  const colorValue = document.getElementById('backgroundColorValue');
  const presets = [...grid.querySelectorAll('[data-background-preset]')];
  let waves = null;

  const defs = {
    gradient: { label: 'Soft Gradient', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#241242"/><stop offset=".48" stop-color="#3a1f6b"/><stop offset="1" stop-color="#0b0518"/></linearGradient></defs><rect width="1080" height="1920" fill="url(#g)"/></svg>` },
    spotlight: { label: 'Spotlight', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><defs><radialGradient id="g" cx="50%" cy="40%" r="70%"><stop stop-color="#9a5a1e"/><stop offset=".45" stop-color="#2c1608"/><stop offset="1" stop-color="#080402"/></radialGradient></defs><rect width="1080" height="1920" fill="url(#g)"/></svg>` },
    aurora: { label: 'Aurora Wash', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><defs><filter id="b"><feGaussianBlur stdDeviation="90"/></filter><linearGradient id="base" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#04060d"/><stop offset="1" stop-color="#03030a"/></linearGradient></defs><rect width="1080" height="1920" fill="url(#base)"/><g filter="url(#b)" opacity=".88"><ellipse cx="200" cy="500" rx="340" ry="500" fill="#2f7bdc"/><ellipse cx="870" cy="800" rx="380" ry="540" fill="#c23fd0"/><ellipse cx="440" cy="1460" rx="440" ry="360" fill="#12d6a0"/></g></svg>` },
    grid: { label: 'Fine Grid', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><defs><pattern id="p" width="64" height="64" patternUnits="userSpaceOnUse"><path d="M64 0H0V64" fill="none" stroke="#38e0ff" stroke-opacity=".22" stroke-width="1"/></pattern><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#0a1216"/><stop offset="1" stop-color="#050a0d"/></linearGradient></defs><rect width="1080" height="1920" fill="url(#g)"/><rect width="1080" height="1920" fill="url(#p)"/></svg>` },
    grain: { label: 'Film Grain', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><defs><radialGradient id="g" cx="50%" cy="40%" r="80%"><stop stop-color="#4a331c"/><stop offset=".78" stop-color="#160e06"/></radialGradient><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".35" numOctaves="2" stitchTiles="stitch"/></filter></defs><rect width="1080" height="1920" fill="url(#g)"/><rect width="1080" height="1920" filter="url(#n)" opacity=".11" style="mix-blend-mode:overlay"/></svg>` }
  };

  const clearMedia = () => {
    if (waves) { waves.stop(); waves.destroy(); waves = null; }
    if (media.video) {
      media.video.pause(); media.video.src = ''; media.video = null;
    }
    media.videoFile = null;
    media.videoHasAudio = false;
    if (state.audioSource?.master === 'video') {
      if (state.audio?.file) {
        state.audioSource.master = 'uploaded';
        window.applyMasterSelection?.('uploaded', { userInitiated: false, silent: true });
      } else {
        state.audioSource.master = 'none';
        window.applyMasterSelection?.('none', { userInitiated: false, silent: true });
      }
    }
    media.image = null;
  };

  const select = key => presets.forEach(button => button.classList.toggle('active-background', button.dataset.backgroundPreset === key));
  const setStatus = text => { if (status) { status.textContent = text; status.className = 'status'; } };
  const makeImage = svg => { const img = new Image(); img.decoding = 'async'; img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; return img; };

  const choosePreset = key => {
    if (window.isExporting) return;
    clearMedia();
    if (key === 'solid') {
      state.background.type = 'solid'; select('solid');
      setStatus(`Colour background · ${state.background.solid.toUpperCase()}`); redraw(); return;
    }
    if (key === 'gradient-waves') {
      if (!window.KefeGradientWaves) { setStatus('Gradient Waves is loading…'); return; }
      waves = window.KefeGradientWaves.create({ ...window.KefeGradientWaves.defaults });
      media.image = waves.canvas;
      state.background.type = 'image';
      select(key);
      setStatus('Gradient Waves · live');
      redraw();
      return;
    }
    const def = defs[key];
    if (!def) return;
    const img = makeImage(def.svg);
    img.onload = () => {
      if (window.isExporting) return;
      media.image = img;
      state.background.type = 'image';
      select(key);
      setStatus(`${def.label} · ready`);
      redraw();
    };
  };

  presets.forEach(button => button.addEventListener('click', () => choosePreset(button.dataset.backgroundPreset)));
  const solidTile = grid.querySelector('[data-background-preset="solid"]');
  const setSolidPreview = hex => { if (solidTile) solidTile.style.setProperty('--kefe-bg-solid-preview', hex); };
  setSolidPreview(colorInput?.value || '#0A0A0A');

  colorInput?.addEventListener('input', () => {
    if (window.isExporting) return;
    clearMedia(); state.background.type = 'solid'; state.background.solid = colorInput.value;
    if (colorValue) colorValue.textContent = colorInput.value.toUpperCase();
    setSolidPreview(colorInput.value); select('solid');
    setStatus(`Colour background · ${colorInput.value.toUpperCase()}`); redraw();
  });

  select('solid');

  // KEFE landing backdrop: the same visual language as the new editor preset.
  // It sits behind the app chrome and is intentionally non-interactive.
  if (!document.querySelector('.kefe-gradient-landing') && window.KefeGradientWaves) {
    const landing = window.KefeGradientWaves.create({ ...window.KefeGradientWaves.defaults });
    landing.canvas.classList.add('kefe-gradient-landing');
    document.body.prepend(landing.canvas);
    const glass = document.createElement('div');
    glass.className = 'kefe-gradient-landing-glass';
    document.body.insertBefore(glass, document.body.children[1] || null);
    document.body.classList.add('kefe-gradient-landing-active');
    window.kefeLandingWaves = landing;
  }
})();
