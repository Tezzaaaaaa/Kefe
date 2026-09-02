/* KEFE Music Intelligence UI
 * Visualises local analysis and exposes beat snapping without taking over the renderer.
 */
(() => {
  'use strict';

  function install() {
    const audioSection = document.getElementById('audioSection');
    if (!audioSection || document.getElementById('kefeMusicTimeline')) return;

    if (!document.getElementById('kefeMusicIntelligenceCSS')) {
      const style = document.createElement('style');
      style.id = 'kefeMusicIntelligenceCSS';
      style.textContent = `
        .kefe-intelligence-panel .kefe-intel-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:8px 0}
        .kefe-intelligence-panel .kefe-intel-grid>div{padding:8px;border:1px solid color-mix(in srgb,currentColor 14%,transparent);border-radius:8px}
        .kefe-intelligence-panel .kefe-intel-grid span{display:block;font-size:10px;opacity:.6;text-transform:uppercase;letter-spacing:.08em}
        .kefe-intelligence-panel .kefe-intel-grid strong{font-size:15px}
        .kefe-intel-progress{height:3px;border-radius:3px;overflow:hidden;background:color-mix(in srgb,currentColor 10%,transparent);margin:7px 0}
        .kefe-intel-progress span{display:block;height:100%;width:0;background:currentColor;transition:width .15s ease}
        .kefe-waveform{display:block;width:100%;height:72px;border-radius:8px;background:color-mix(in srgb,currentColor 5%,transparent);margin:7px 0}
        .kefe-timeline-legend{display:flex;align-items:center;gap:9px;flex-wrap:wrap;font-size:10px;opacity:.72}
        .kefe-timeline-legend span::before{content:'';display:inline-block;width:10px;height:2px;background:currentColor;margin-right:4px;vertical-align:middle}
        .kefe-timeline-legend button{margin-left:auto}
        @media(max-width:700px){.kefe-timeline-legend button{width:100%;margin-left:0}}
      `;
      document.head.appendChild(style);
    }

    const panel = document.createElement('div');
    panel.id = 'kefeMusicTimeline';
    panel.className = 'sub-block kefe-music-timeline';
    panel.innerHTML = `
      <div class="sub-heading">Beat map</div>
      <canvas id="kefeWaveform" class="kefe-waveform" height="72" aria-label="Audio waveform and detected beats"></canvas>
      <div class="kefe-timeline-legend"><span>Energy</span><span>Beat markers</span><button type="button" id="kefeSnapBeat" class="file-button">Snap offset to nearest beat</button></div>`;
    audioSection.appendChild(panel);

    const canvas = document.getElementById('kefeWaveform');
    const ctx = canvas?.getContext('2d');
    let analysis = null;

    function draw() {
      if (!ctx || !canvas) return;
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(320, Math.floor(rect.width || 520));
      const height = 72;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      if (!analysis?.energy?.length) {
        ctx.globalAlpha = 0.45;
        ctx.font = '12px system-ui, sans-serif';
        ctx.fillText('Load audio to analyse rhythm', 10, 40);
        ctx.globalAlpha = 1;
        return;
      }
      const energy = analysis.energy;
      const max = Math.max(0.001, ...energy);
      const step = Math.max(1, Math.ceil(energy.length / width));
      for (let x = 0; x < width; x++) {
        const start = x * step;
        const end = Math.min(energy.length, start + step);
        let value = 0;
        for (let i = start; i < end; i++) value = Math.max(value, energy[i]);
        const h = Math.max(1, (value / max) * (height - 14));
        ctx.globalAlpha = 0.68;
        ctx.fillRect(x, (height - h) / 2, 1, h);
      }
      const duration = Math.max(0.001, Number(analysis.duration) || 1);
      ctx.globalAlpha = 0.8;
      for (const beat of analysis.beats || []) {
        const x = beat / duration * width;
        ctx.fillRect(Math.round(x), 4, 1, height - 8);
      }
      ctx.globalAlpha = 1;
    }

    function nearestBeat(time) {
      const beats = analysis?.beats || [];
      if (!beats.length) return Number(time) || 0;
      const target = Number(time) || 0;
      let best = beats[0];
      let distance = Math.abs(best - target);
      for (let i = 1; i < beats.length; i++) {
        const d = Math.abs(beats[i] - target);
        if (d < distance) { best = beats[i]; distance = d; }
      }
      return best;
    }

    document.getElementById('kefeSnapBeat')?.addEventListener('click', () => {
      const input = document.getElementById('lyricsOffset');
      const seek = document.getElementById('seek');
      if (!analysis?.beats?.length) return;
      const current = Number(seek?.value || 0);
      const beat = nearestBeat(current);
      if (input) {
        const currentOffset = Number(input.value || 0);
        const correction = Math.max(-10, Math.min(10, currentOffset + (beat - current)));
        input.value = correction.toFixed(2);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      window.dispatchEvent(new CustomEvent('kefe:beat-snapped', { detail: { from: current, to: beat } }));
    });

    window.addEventListener('kefe:audio-analysis-ready', event => {
      analysis = event.detail || null;
      draw();
    });
    window.addEventListener('resize', draw);
    window.kefeMusicUI = {
      nearestBeat,
      get analysis() { return analysis; },
      snapTime(time) { return nearestBeat(time); }
    };
    draw();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
