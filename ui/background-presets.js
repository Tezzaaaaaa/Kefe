/* KEFE background presets — six clean, reusable canvas backgrounds. */
(() => {
  'use strict';

  // app.js is loaded later in index.html. Register the compatibility patch
  // before the early state check so it still loads after window.load.
  window.addEventListener('load', () => {
    const script = document.createElement('script');
    script.src = './ui/wizard-media-fix.js?v=20260901-2';
    script.async = false;
    document.body.appendChild(script);
  });

  const state = window.state;
  const media = window.kefeMedia;
  const redraw = () => window.redrawCurrentPreviewFrame?.();
  const status = document.getElementById('backgroundStatus');
  const colorInput = document.getElementById('backgroundColor');
  const colorValue = document.getElementById('backgroundColorValue');
  const presets = [...document.querySelectorAll('[data-background-preset]')];
  if (!state || !media || !presets.length) return;

  const defs = {
    gradient: {
      label: 'Soft Gradient',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#241242"/><stop offset=".48" stop-color="#3a1f6b"/><stop offset="1" stop-color="#0b0518"/></linearGradient></defs><rect width="1080" height="1920" fill="url(#g)"/></svg>`
    },
    spotlight: {
      label: 'Spotlight',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><defs><radialGradient id="g" cx="50%" cy="40%" r="70%"><stop stop-color="#9a5a1e"/><stop offset=".45" stop-color="#2c1608"/><stop offset="1" stop-color="#080402"/></radialGradient></defs><rect width="1080" height="1920" fill="url(#g)"/></svg>`
    },
    aurora: {
      label: 'Aurora Wash',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><defs><filter id="b"><feGaussianBlur stdDeviation="90"/></filter><linearGradient id="base" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#04060d"/><stop offset="1" stop-color="#03030a"/></linearGradient></defs><rect width="1080" height="1920" fill="url(#base)"/><g filter="url(#b)" opacity=".88"><ellipse cx="200" cy="500" rx="340" ry="500" fill="#2f7bdc"/><ellipse cx="870" cy="800" rx="380" ry="540" fill="#c23fd0"/><ellipse cx="440" cy="1460" rx="440" ry="360" fill="#12d6a0"/></g></svg>`
    },
    grid: {
      label: 'Fine Grid',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><defs><pattern id="p" width="64" height="64" patternUnits="userSpaceOnUse"><path d="M64 0H0V64" fill="none" stroke="#38e0ff" stroke-opacity=".22" stroke-width="1"/></pattern><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#0a1216"/><stop offset="1" stop-color="#050a0d"/></linearGradient></defs><rect width="1080" height="1920" fill="url(#g)"/><rect width="1080" height="1920" fill="url(#p)"/></svg>`
    },
    grain: {
      label: 'Film Grain',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><defs><radialGradient id="g" cx="50%" cy="40%" r="80%"><stop stop-color="#4a331c"/><stop offset=".78" stop-color="#160e06"/></radialGradient><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".35" numOctaves="2" stitchTiles="stitch"/></filter></defs><rect width="1080" height="1920" fill="url(#g)"/><rect width="1080" height="1920" filter="url(#n)" opacity=".11" style="mix-blend-mode:overlay"/></svg>`
    }
  };

  const clearMedia = () => {
    if (media.video) {
      media.video.pause();
      media.video.src = '';
      media.video = null;
    }
    media.videoFile = null;
    media.videoHasAudio = false;
    if (window.state?.audioSource?.master === 'video') {
      if (window.state?.audio?.file) {
        window.state.audioSource.master = 'uploaded';
        if (typeof window.applyMasterSelection === 'function') window.applyMasterSelection('uploaded', { userInitiated: false, silent: true });
      } else {
        window.state.audioSource.master = 'none';
        if (typeof window.applyMasterSelection === 'function') window.applyMasterSelection('none', { userInitiated: false, silent: true });
      }
    }
    media.image = null;
  };

  const select = (key) => {
    presets.forEach(button => button.classList.toggle('active-background', button.dataset.backgroundPreset === key));
  };

  const setStatus = text => { if (status) { status.textContent = text; status.className = 'status'; } };

  const makeImage = svg => {
    const img = new Image();
    img.decoding = 'async';
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    return img;
  };

  const choosePreset = key => {
    if (window.isExporting) return;
    if (key === 'solid') {
      clearMedia();
      state.background.type = 'solid';
      select('solid');
      setStatus(`Colour background · ${state.background.solid.toUpperCase()}`);
      redraw();
      return;
    }
    const def = defs[key];
    if (!def) return;
    clearMedia();
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
  const solidTile = document.querySelector('.background-choice[data-background-preset="solid"]');
  const setSolidPreview = hex => { if (solidTile) solidTile.style.setProperty('--kefe-bg-solid-preview', hex); };
  setSolidPreview(colorInput?.value || '#0A0A0A');

  colorInput?.addEventListener('input', () => {
    if (window.isExporting) return;
    clearMedia();
    state.background.type = 'solid';
    state.background.solid = colorInput.value;
    if (colorValue) colorValue.textContent = colorInput.value.toUpperCase();
    setSolidPreview(colorInput.value);
    select('solid');
    setStatus(`Colour background · ${colorInput.value.toUpperCase()}`);
    redraw();
  });

  select('solid');
})();
