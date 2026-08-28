/* KEFE background presets — six clean, reusable canvas backgrounds. */
(() => {
  'use strict';
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
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#111827"/><stop offset=".48" stop-color="#26324a"/><stop offset="1" stop-color="#09090b"/></linearGradient></defs><rect width="1080" height="1920" fill="url(#g)"/></svg>`
    },
    spotlight: {
      label: 'Spotlight',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><defs><radialGradient id="g" cx="50%" cy="42%" r="70%"><stop stop-color="#3d4658"/><stop offset=".38" stop-color="#171b25"/><stop offset="1" stop-color="#050505"/></radialGradient></defs><rect width="1080" height="1920" fill="url(#g)"/></svg>`
    },
    aurora: {
      label: 'Aurora Wash',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><defs><filter id="b"><feGaussianBlur stdDeviation="90"/></filter><linearGradient id="base" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#090d18"/><stop offset="1" stop-color="#08070d"/></linearGradient></defs><rect width="1080" height="1920" fill="url(#base)"/><g filter="url(#b)" opacity=".72"><ellipse cx="220" cy="520" rx="330" ry="480" fill="#3159b8"/><ellipse cx="850" cy="780" rx="360" ry="520" fill="#7140a8"/><ellipse cx="450" cy="1450" rx="430" ry="340" fill="#1d806f"/></g></svg>`
    },
    grid: {
      label: 'Fine Grid',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><defs><pattern id="p" width="72" height="72" patternUnits="userSpaceOnUse"><path d="M72 0H0V72" fill="none" stroke="#ffffff" stroke-opacity=".07" stroke-width="1"/></pattern><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#151515"/><stop offset="1" stop-color="#080808"/></linearGradient></defs><rect width="1080" height="1920" fill="url(#g)"/><rect width="1080" height="1920" fill="url(#p)"/></svg>`
    },
    grain: {
      label: 'Film Grain',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".72" numOctaves="3" stitchTiles="stitch"/></filter><rect width="1080" height="1920" fill="#111"/><rect width="1080" height="1920" filter="url(#n)" opacity=".13"/><rect width="1080" height="1920" fill="#000" opacity=".22"/></svg>`
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
    // If the background video was the master audio source, it no longer exists:
    // fall back to a valid master (uploaded audio if present, otherwise the
    // muted virtual timeline) without claiming a silent switch mid-project.
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
  colorInput?.addEventListener('input', () => {
    if (window.isExporting) return;
    clearMedia();
    state.background.type = 'solid';
    state.background.solid = colorInput.value;
    if (colorValue) colorValue.textContent = colorInput.value.toUpperCase();
    select('solid');
    setStatus(`Colour background · ${colorInput.value.toUpperCase()}`);
    redraw();
  });

  select('solid');
})();
