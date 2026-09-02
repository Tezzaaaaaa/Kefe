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
      script.dataset[marker] = '1';
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
    scriptPromises.set(src, promise);
    return promise;
  }

  let runtimeBootstrapped = false;
  async function bootstrapRuntimeModules() {
    if (runtimeBootstrapped) return;
    try {
      await loadScript('./app/core/runtime-bridge.js', 'kefe-runtime-bridge');
      if (!window.kefeRuntime?.ready) return;
      await loadScript('./app/ui/caption-generator.js', 'kefe-caption-generator');
      await Promise.allSettled([
        loadScript('./app/core/analysis-engine.js', 'kefe-analysis'),
        loadScript('./app/core/auto-create.js', 'kefe-auto-create'),
        loadScript('./app/core/smart-render.js', 'kefe-smart-render')
      ]);
      runtimeBootstrapped = true;
      window.dispatchEvent(new CustomEvent('kefe:runtime-bootstrapped'));
    } catch (error) {
      console.error('[KEFE Bootstrap]', error);
    }
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

  document.addEventListener('input', event => {
    if (event.target?.id === 'lyricsText') scheduleAnalysis();
  }, true);
  document.addEventListener('change', event => {
    if (event.target?.id === 'lrcFileInput') scheduleAnalysis();
  }, true);

  window.addEventListener('kefe:analysis-ready', analyzeCurrentLyrics);
  enhanceLivePreview();
  bootstrapRuntimeModules();
  window.setInterval(enhanceLivePreview, 500);
})();

/* Architecture layer remains available as infrastructure; it does not alter the editing flow. */
(() => {
  if (window.kefe || document.querySelector('script[data-kefe-architecture]')) return;
  const script = document.createElement('script');
  script.src = './app/core/architecture.js';
  script.dataset.kefeArchitecture = '1';
  document.head.appendChild(script);
})();
