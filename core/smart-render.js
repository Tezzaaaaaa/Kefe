/* KEFE Smart Render Engine
 * Prepares the existing renderer for an export without replacing its
 * frame-accurate render pipeline. Keeps decisions local and reversible.
 */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const PRESETS = new Set(['480p', '720p', '1080p', 'instagram', 'tiktok']);
  const HIGH_POWER_PIXELS = 70e9;

  function masterDuration() {
    try {
      if (typeof getMasterDuration === 'function') return Number(getMasterDuration()) || 0;
    } catch (_) {}
    return Number(window.state?.audio?.duration || 0);
  }

  function getPreset() {
    const value = $('exportPreset')?.value;
    return PRESETS.has(value) ? value : '720p';
  }

  function deviceProfile() {
    const memory = Number(navigator.deviceMemory || 0);
    const cores = Number(navigator.hardwareConcurrency || 0);
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
    const constrained = (memory && memory <= 4) || (cores && cores <= 4);
    return { memory, cores, mobile, constrained };
  }

  function recommendPreset() {
    const current = getPreset();
    const duration = masterDuration();
    const profile = deviceProfile();
    if (current !== '1080p') return current;
    if (profile.constrained || profile.mobile) return '720p';
    if (duration > 600) return '720p';
    return current;
  }

  function estimate(preset = getPreset()) {
    const duration = masterDuration();
    let dimensions = [720, 1280];
    let fps = 30;
    if (preset === '1080p' || preset === 'instagram' || preset === 'tiktok') { dimensions = [1080, 1920]; fps = preset === '1080p' ? 60 : 30; }
    if (preset === '480p') { dimensions = [480, 854]; fps = 24; }
    const frames = Math.max(0, Math.ceil(duration * fps));
    const pixelFrames = dimensions[0] * dimensions[1] * frames;
    const load = pixelFrames > HIGH_POWER_PIXELS ? 'very-high' : pixelFrames > 30e9 ? 'high' : pixelFrames > 10e9 ? 'moderate' : 'light';
    return { preset, width: dimensions[0], height: dimensions[1], fps, duration, frames, pixelFrames, load };
  }

  function setStatus(text) {
    const el = $('previewStatus');
    if (!el) return;
    el.textContent = text;
    el.dataset.smartRenderStatus = '1';
  }

  function prepare() {
    const requested = getPreset();
    const recommended = recommendPreset();
    const changed = requested !== recommended;
    if (changed && $('exportPreset')) {
      $('exportPreset').value = recommended;
      $('exportPreset').dispatchEvent(new Event('change', { bubbles: true }));
    }
    const info = estimate(recommended);
    window.kefeSmartRender.lastPlan = { requested, recommended, changed, info, device: deviceProfile() };
    setStatus(changed ? `Optimised export • ${recommended}` : `Export ready • ${recommended}`);
    window.dispatchEvent(new CustomEvent('kefe:render-prepared', { detail: window.kefeSmartRender.lastPlan }));
    return window.kefeSmartRender.lastPlan;
  }

  function bind() {
    ['exportBtn', 'exportBottom'].forEach(id => {
      const button = $(id);
      if (!button || button.dataset.smartRenderBound) return;
      button.dataset.smartRenderBound = '1';
      button.addEventListener('click', () => {
        if (window.kefeSmartRender.busy) return;
        window.kefeSmartRender.prepare();
      }, true);
    });
  }

  window.kefeSmartRender = {
    version: 1,
    prepare,
    estimate,
    get device() { return deviceProfile(); },
    lastPlan: null,
    busy: false
  };

  bind();
  new MutationObserver(bind).observe(document.body, { childList: true, subtree: true });
})();
