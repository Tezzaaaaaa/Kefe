/* KEFE Music Intelligence UI
 * Visualises local analysis and exposes beat snapping without taking over the renderer.
 * No external chart library; the existing analysis data drives a compact animated card.
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
        .kefe-music-timeline{margin-top:10px}
        .kefe-intelligence-card{position:relative;overflow:hidden;padding:14px;border:1px solid color-mix(in srgb,currentColor 12%,transparent);border-radius:16px;background:color-mix(in srgb,currentColor 4%,transparent)}
        .kefe-intelligence-card::after{content:'';position:absolute;inset:auto -15% -70% 30%;height:120px;border-radius:50%;background:color-mix(in srgb,currentColor 7%,transparent);pointer-events:none}
        .kefe-intelligence-head{position:relative;z-index:1;display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
        .kefe-intelligence-copy{min-width:0}
        .kefe-intelligence-title{font-size:13px;font-weight:750;letter-spacing:-.01em}
        .kefe-intelligence-subtitle{margin-top:2px;max-width:360px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;opacity:.58}
        .kefe-intelligence-metric{display:grid;justify-items:end;flex:0 0 auto}
        .kefe-intelligence-metric strong{font-size:22px;line-height:1;letter-spacing:-.04em;font-variant-numeric:tabular-nums}
        .kefe-intelligence-metric span{margin-top:3px;font-size:9px;text-transform:uppercase;letter-spacing:.1em;opacity:.55}
        .kefe-intelligence-chart{position:relative;z-index:1;display:flex;align-items:flex-end;gap:3px;height:72px;margin:13px 0 9px;padding:0 1px}
        .kefe-intelligence-bar{position:relative;flex:1 1 0;min-width:2px;height:var(--bar-height);border-radius:999px 999px 3px 3px;background:currentColor;opacity:.52;transform-origin:bottom;animation:kefeIntelBarIn .55s cubic-bezier(.2,.8,.2,1) both;animation-delay:var(--bar-delay)}
        .kefe-intelligence-bar[data-beat="true"]{opacity:.9}
        .kefe-intelligence-bar[data-beat="true"]::before{content:'';position:absolute;left:50%;top:-3px;width:3px;height:3px;border-radius:50%;background:currentColor;transform:translateX(-50%)}
        .kefe-intelligence-foot{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:9px;opacity:.56}
        .kefe-intelligence-legend{display:flex;gap:8px;min-width:0}
        .kefe-intelligence-legend span{white-space:nowrap}
        .kefe-intelligence-actions{display:flex;justify-content:flex-end;margin-top:9px}
        .kefe-intelligence-actions button{font-size:10px}
        @keyframes kefeIntelBarIn{from{opacity:0;transform:scaleY(.2)}to{transform:scaleY(1)}}
        @media(prefers-reduced-motion:reduce){.kefe-intelligence-bar{animation:none}}
        @media(max-width:700px){.kefe-intelligence-card{padding:12px}.kefe-intelligence-chart{height:62px;gap:2px}.kefe-intelligence-metric strong{font-size:19px}}
      `;
      document.head.appendChild(style);
    }

    const panel = document.createElement('div');
    panel.id = 'kefeMusicTimeline';
    panel.className = 'sub-block kefe-music-timeline';
    panel.innerHTML = `
      <div class="kefe-intelligence-card" aria-label="Audio analysis">
        <div class="kefe-intelligence-head">
          <div class="kefe-intelligence-copy">
            <div class="kefe-intelligence-title">Beat map</div>
            <div class="kefe-intelligence-subtitle" id="kefeIntelSubtitle">Load audio to analyse rhythm</div>
          </div>
          <div class="kefe-intelligence-metric">
            <strong id="kefeIntelMetric">—</strong>
            <span>BPM</span>
          </div>
        </div>
        <div id="kefeIntelChart" class="kefe-intelligence-chart" role="img" aria-label="Audio energy chart"></div>
        <div class="kefe-intelligence-foot">
          <div class="kefe-intelligence-legend"><span id="kefeIntelDuration">—</span><span id="kefeIntelBeats">— beats</span></div>
          <span>Energy</span>
        </div>
        <div class="kefe-intelligence-actions"><button type="button" id="kefeSnapBeat" class="file-button">Snap offset to nearest beat</button></div>
      </div>`;
    audioSection.appendChild(panel);

    const chart = document.getElementById('kefeIntelChart');
    const subtitle = document.getElementById('kefeIntelSubtitle');
    const metric = document.getElementById('kefeIntelMetric');
    const durationLabel = document.getElementById('kefeIntelDuration');
    const beatsLabel = document.getElementById('kefeIntelBeats');
    let analysis = null;

    function formatDuration(seconds) {
      const total = Math.max(0, Math.round(Number(seconds) || 0));
      const minutes = Math.floor(total / 60);
      return `${minutes}:${String(total % 60).padStart(2, '0')}`;
    }

    function renderChart() {
      if (!chart) return;
      chart.replaceChildren();
      const energy = Array.isArray(analysis?.energy) ? analysis.energy : [];
      if (!energy.length) {
        const empty = document.createElement('span');
        empty.textContent = 'Load audio to analyse rhythm';
        empty.style.cssText = 'align-self:center;font-size:11px;opacity:.5';
        chart.appendChild(empty);
        return;
      }

      const barCount = Math.min(48, Math.max(18, Math.round(chart.clientWidth / 7)));
      const max = Math.max(0.001, ...energy);
      const beatTimes = Array.isArray(analysis?.beats) ? analysis.beats : [];
      const duration = Math.max(0.001, Number(analysis?.duration) || 1);
      for (let i = 0; i < barCount; i++) {
        const start = Math.floor(i * energy.length / barCount);
        const end = Math.max(start + 1, Math.floor((i + 1) * energy.length / barCount));
        let value = 0;
        for (let j = start; j < Math.min(end, energy.length); j++) value = Math.max(value, Number(energy[j]) || 0);
        const time = (start / Math.max(1, energy.length - 1)) * duration;
        const isBeat = beatTimes.some(beat => Math.abs(Number(beat) - time) < duration / barCount / 2);
        const bar = document.createElement('span');
        bar.className = 'kefe-intelligence-bar';
        bar.dataset.beat = String(isBeat);
        bar.style.setProperty('--bar-height', `${Math.max(10, (value / max) * 100)}%`);
        bar.style.setProperty('--bar-delay', `${Math.min(i * 12, 420)}ms`);
        bar.setAttribute('aria-hidden', 'true');
        chart.appendChild(bar);
      }
    }

    function updateCard() {
      if (!analysis) {
        subtitle.textContent = 'Load audio to analyse rhythm';
        metric.textContent = '—';
        durationLabel.textContent = '—';
        beatsLabel.textContent = '— beats';
        renderChart();
        return;
      }
      const title = document.getElementById('metaTitle')?.value.trim() || '';
      const artist = document.getElementById('metaArtist')?.value.trim() || '';
      subtitle.textContent = title && artist ? `${title} — ${artist}` : title || artist || analysis.fileName || 'Local audio analysis';
      metric.textContent = Number.isFinite(Number(analysis.bpm)) && Number(analysis.bpm) > 0 ? String(Math.round(Number(analysis.bpm))) : '—';
      durationLabel.textContent = formatDuration(analysis.duration);
      beatsLabel.textContent = `${Array.isArray(analysis.beats) ? analysis.beats.length : 0} beats`;
      renderChart();
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
      updateCard();
    });
    window.addEventListener('resize', renderChart);
    window.addEventListener('input', event => {
      if (event.target?.id === 'metaTitle' || event.target?.id === 'metaArtist') updateCard();
    });
    window.kefeMusicUI = {
      nearestBeat,
      get analysis() { return analysis; },
      snapTime(time) { return nearestBeat(time); }
    };
    updateCard();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
