/* KEFE Deterministic Frame Renderer
 * A small render-clock layer for frame-accurate preview/export orchestration.
 * It never drives playback and never uses wall-clock time for frame selection.
 */
(() => {
  'use strict';

  function createClock({ fps = 30, duration = 0 } = {}) {
    const rate = Math.max(1, Number(fps) || 30);
    const totalFrames = Math.max(0, Math.ceil(Math.max(0, Number(duration) || 0) * rate));
    return Object.freeze({
      fps: rate,
      duration: Math.max(0, Number(duration) || 0),
      frameCount: totalFrames,
      frameDurationMs: 1000 / rate,
      timeForFrame(frame) { return Math.max(0, Number(frame) || 0) / rate; },
      frameForTime(time) { return Math.max(0, Math.round((Number(time) || 0) * rate)); },
      frames() { return Array.from({ length: totalFrames }, (_, frame) => frame); }
    });
  }

  async function renderFrames({ fps = 30, duration = 0, renderFrame, onProgress, signal } = {}) {
    if (typeof renderFrame !== 'function') throw new TypeError('renderFrame(frame, time, clock) is required.');
    const clock = createClock({ fps, duration });
    const outputs = [];
    for (let frame = 0; frame < clock.frameCount; frame++) {
      if (signal?.aborted) throw new DOMException('Render cancelled', 'AbortError');
      const time = clock.timeForFrame(frame);
      outputs.push(await renderFrame(frame, time, clock));
      onProgress?.((frame + 1) / Math.max(1, clock.frameCount), { frame, time, clock });
    }
    return { clock, outputs };
  }

  function install() {
    window.kefeRenderer = {
      version: 1,
      createClock,
      renderFrames,
      frameTime(frame, fps = 30) { return Math.max(0, Number(frame) || 0) / Math.max(1, Number(fps) || 30); }
    };
    window.dispatchEvent(new CustomEvent('kefe:renderer-ready', { detail: window.kefeRenderer }));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
