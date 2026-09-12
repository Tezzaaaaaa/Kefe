/* KEFE product polish — small, direct-editor enhancements only. */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const body = document.body;
  if (!body) return;

  const scriptPromises = new Map();

  function loadScript(src, marker) {
    if (window[marker] || document.querySelector(`script[data-${marker}]`)) return Promise.resolve();
    if (scriptPromises.has(src)) return scriptPromises.get(src);
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.setAttribute(`data-${marker}`, '1');
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
    scriptPromises.set(src, promise);
    return promise;
  }

  function ensureSectionNav() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar || sidebar.querySelector('.section-nav')) return;

    const sections = [
      ['audioSection', 'Media', 'audio'],
      ['textSection', 'Lyrics', 'lyrics'],
      ['fxSection', 'Visual FX', 'fx'],
      ['backgroundSection', 'Background', 'background'],
      ['exportSection', 'Export', 'export']
    ];
    const nav = document.createElement('nav');
    nav.className = 'section-nav';
    nav.setAttribute('aria-label', 'Editor sections');
    const list = document.createElement('div');
    list.className = 'section-nav-list';

    sections.forEach(([id, label, key], index) => {
      const section = document.getElementById(id);
      if (!section) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'section-nav-link';
      button.dataset.nav = key;
      button.setAttribute('aria-controls', id);
      button.textContent = label;
      if (index === 0) {
        button.classList.add('active');
        button.setAttribute('aria-current', 'page');
        section.classList.add('active');
      }
      list.appendChild(button);
    });
    nav.appendChild(list);
    sidebar.insertBefore(nav, sidebar.firstChild);
  }

  function repairMediaLoadingState() {
    const audioInput = $('audioInput');
    const audioStatus = $('audioStatus');
    const backgroundInput = $('backgroundInput');
    const backgroundStatus = $('backgroundStatus');

    document.addEventListener('change', event => {
      if (event.target === audioInput && event.target.files?.length) {
        audioStatus?.classList.remove('success', 'error');
        if (audioStatus) {
          audioStatus.textContent = 'Loading media…';
          audioStatus.className = 'status loading';
        }
      }
      if (event.target === backgroundInput && event.target.files?.length) {
        backgroundStatus?.classList.remove('success', 'error');
        if (backgroundStatus) {
          backgroundStatus.textContent = 'Loading background…';
          backgroundStatus.className = 'status loading';
        }
      }
    }, true);

    window.addEventListener('kefe:media-loaded', event => {
      const kind = event.detail?.kind;
      const status = kind === 'background' ? backgroundStatus : audioStatus;
      if (!status) return;
      status.classList.remove('loading');
      status.classList.add('success');
    });

    window.addEventListener('kefe:media-error', event => {
      const kind = event.detail?.kind;
      const status = kind === 'background' ? backgroundStatus : audioStatus;
      if (!status) return;
      status.classList.remove('loading');
      status.classList.add('error');
    });

    const audio = window.__kefeAudioElement || document.querySelector('audio');
    if (audio) {
      audio.addEventListener('loadstart', () => {
        if (audioStatus?.textContent && audioStatus.textContent !== 'No audio loaded') audioStatus.className = 'status loading';
      });
      audio.addEventListener('loadedmetadata', () => {
        if (audioStatus?.textContent !== 'Error loading audio') audioStatus.className = 'status success';
      });
      audio.addEventListener('error', () => {
        if (audioStatus) audioStatus.className = 'status error';
      });
    }
  }

  let runtimeBootstrapped = false;
  let runtimeBootstrapTimer = 0;
  async function bootstrapRuntimeModules() {
    if (runtimeBootstrapped) return;
    try {
      await loadScript('./app/core/runtime-bridge.js', 'kefe-runtime-bridge');
      if (!window.kefeRuntime?.ready) return;
      await loadScript('./app/core/smart-render.js', 'kefe-smart-render');
      runtimeBootstrapped = true;
      if (runtimeBootstrapTimer) {
        clearInterval(runtimeBootstrapTimer);
        runtimeBootstrapTimer = 0;
      }
      window.dispatchEvent(new CustomEvent('kefe:runtime-bootstrapped'));
    } catch (error) {
      console.error('[KEFE Runtime]', error);
    }
  }

  function keepRuntimeBootstrapAlive() {
    if (runtimeBootstrapped) return;
    void bootstrapRuntimeModules();
  }

  function enhanceLivePreview() {
    const heading = document.querySelector('.preview-heading');
    const preview = document.querySelector('.preview');
    if (!heading || !preview) return;

    if (!heading.querySelector('.preview-live-badge')) {
      const live = document.createElement('span');
      live.className = 'preview-live-badge';
      live.textContent = 'Live';
      heading.appendChild(live);
    }
    if (!heading.querySelector('.preview-effect-badge')) {
      const effect = document.createElement('span');
      effect.className = 'preview-effect-badge';
      heading.appendChild(effect);
    }

    const effectName = window.state?.style?.effect || 'apple';
    const effect = heading.querySelector('.preview-effect-badge');
    if (effect) effect.textContent = effectName.replace(/[-_]/g, ' ');

    const playing = Boolean(window.state?.playback?.isPlaying);
    heading.querySelector('.preview-live-badge')?.classList.toggle('is-playing', playing);
    preview.classList.toggle('is-playing', playing);
  }

  let analysisTimer = 0;
  let analysisRequest = 0;
  async function analyzeCurrentLyrics() {
    if (!window.kefeAnalysis?.analyzeLyrics) return;
    const input = $('lyricsText');
    const text = input?.value || '';
    if (!text.trim()) return;
    const request = ++analysisRequest;
    try {
      const result = await window.kefeAnalysis.analyzeLyrics(text, Number(window.state?.audio?.duration || 0));
      if (request !== analysisRequest) return;
      window.kefeAnalysis.lastResult = result;
      window.dispatchEvent(new CustomEvent('kefe:lyrics-analyzed', { detail: result }));
      const status = $('lyricsStatus');
      if (status && result.validation) {
        const count = result.validation.count;
        const problems = result.validation.gaps.length + result.validation.overlaps.length + result.validation.lateLines;
        status.textContent = problems ? `${count} lines • ${problems} timing issue${problems === 1 ? '' : 's'}` : `${count} lines • timing checked`;
        status.dataset.analysisRecommendation = result.recommendation || '';
      }
    } catch (error) {
      console.warn('[KEFE Analysis] lyrics analysis failed', error);
    }
  }

  function scheduleAnalysis() {
    clearTimeout(analysisTimer);
    analysisTimer = setTimeout(analyzeCurrentLyrics, 350);
  }

  ensureSectionNav();
  repairMediaLoadingState();

  document.addEventListener('input', event => {
    if (event.target?.id === 'lyricsText') scheduleAnalysis();
  }, true);
  document.addEventListener('change', event => {
    if (event.target?.id === 'lrcFileInput') scheduleAnalysis();
  }, true);

  window.addEventListener('kefe:analysis-ready', analyzeCurrentLyrics);
  enhanceLivePreview();
  keepRuntimeBootstrapAlive();
  runtimeBootstrapTimer = window.setInterval(keepRuntimeBootstrapAlive, 250);
  window.setInterval(enhanceLivePreview, 500);
})();
