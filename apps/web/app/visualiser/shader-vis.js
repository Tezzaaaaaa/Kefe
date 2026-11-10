/* KEFE shader visualiser framework — shared tab/power/view/preset/audio/canvas plumbing for
   single-fragment-shader visualisers (Silk Road, Visuals Mix). Each visualiser registers a
   definition; this file builds its tab (toolbar + side panel read the same .kefe-vis-tabs),
   its panel view, preset buttons, sliders, WebGL canvas and render loop. */
(function () {
  'use strict';
  const instances = new Map();
  const VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const reducedMotion = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const queue = [];
  let ready = document.readyState !== 'loading';

  function make(def) {
    const key = 'kefe.shaderVis.' + def.id + '.v1';
    let cfg = { ...def.defaults };
    try { const s = JSON.parse(localStorage.getItem(key) || 'null'); if (s) cfg = { ...cfg, ...s }; } catch (_) {}
    let stage, canvas, gl, program, vertexBuffer = null, loc = {}, enabled = false, active = false, last = 0, t = 0, tick = 0;
    let rendererError = null, loop = null;
    let tabs, form, tab, view, power, powerState, presetSet, ui = { sync: [] };
    let bins = null, smoothed = [0, 0, 0, 0], peak = [.1, .1, .1, .1];
    const scope = window.kefeResilience?.createScope?.();
    const shown = () => enabled && active && !rendererError;
    const persist = () => { try { localStorage.setItem(key, JSON.stringify(cfg)); } catch (_) {} };
    const opts = { antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' };

    function compile(type, src) {
      const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { console.error('[KEFE ' + def.name + ' shader]', gl.getShaderInfoLog(sh)); gl.deleteShader(sh); return null; }
      return sh;
    }
    function destroyGL() {
      if (gl && !gl.isContextLost()) {
        try { if (vertexBuffer) gl.deleteBuffer(vertexBuffer); } catch (_) {}
        try { if (program) gl.deleteProgram(program); } catch (_) {}
      }
      vertexBuffer = null;
      program = null;
    }
    function build() {
      destroyGL();
      const vs = compile(gl.VERTEX_SHADER, VS), fs = compile(gl.FRAGMENT_SHADER, def.fs);
      if (!vs || !fs) return false;
      const p = gl.createProgram(); gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
      gl.deleteShader(vs); gl.deleteShader(fs);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.error('[KEFE ' + def.name + ' program]', gl.getProgramInfoLog(p)); gl.deleteProgram(p); return false; }
      program = p; gl.useProgram(program);
      vertexBuffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const a = gl.getAttribLocation(program, 'a');
      if (a < 0) { destroyGL(); return false; }
      gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
      def.uniforms.forEach(n => { loc[n] = gl.getUniformLocation(program, n); });
      return true;
    }
    function reportError(err, title, message) {
      rendererError = err || new Error('WebGL unavailable');
      enabled = false;
      loop?.stop();
      syncPowerUI();
      window.kefeResilience?.panelError('visualiser', {
        id: 'shader-vis-' + def.id,
        title: title || (def.name + ' preview could not initialise'),
        message: message || 'WebGL graphics acceleration is unavailable or blocked in this browser.',
        retryLabel: 'Retry',
        onRetry() {
          rendererError = null;
          if (ensureGL()) { enabled = true; sync(); }
        },
        continueLabel: 'Continue with Fluid Ink (2D)',
        onContinue() { document.querySelector('[data-visualiser="gradient"]')?.click(); },
      });
    }
    function ensureGL() {
      if (gl && !gl.isContextLost() && program) return true;
      if (rendererError) return false;
      try {
        gl = canvas.getContext('webgl', opts);
        if (!gl || gl.isContextLost() || !build()) throw new Error('WebGL initialization failed');
        rendererError = null;
        window.kefeResilience?.clearPanelError('visualiser', 'shader-vis-' + def.id);
        return true;
      } catch (e) {
        console.error('[KEFE ' + def.name + ']', e);
        reportError(e);
        return false;
      }
    }
    function resize() {
      if (!canvas || !stage) return false;
      const r = stage.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (r.width < 2 || r.height < 2) return false;
      let w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
      const cap = def.maxSide || 1920, big = Math.max(w, h);
      if (big > cap) { const k = cap / big; w = Math.max(2, Math.round(w * k)); h = Math.max(2, Math.round(h * k)); }
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      if (gl && !gl.isContextLost()) gl.viewport(0, 0, canvas.width, canvas.height);
      return true;
    }
    function audio(dt) {
      const g = window.kefeAudioGraph;
      const an = g?.analyser?.();
      let target = [0, 0, 0, 0];
      if (an) {
        if (!bins || bins.length !== an.frequencyBinCount) bins = new Uint8Array(an.frequencyBinCount);
        const res = g?.readFrequencyData ? g.readFrequencyData(bins) : (an.getByteFrequencyData(bins), { ok: true });
        if (res.ok) {
          const hz = (an.context?.sampleRate || 48000) / (an.fftSize || 2048);
          const band = (lo, hi) => { const a = Math.max(1, Math.floor(lo / hz)), b = Math.min(bins.length - 1, Math.ceil(hi / hz)); let s = 0; for (let i = a; i <= b; i++) s += bins[i]; return s / (Math.max(1, b - a + 1) * 255); };
          const raw = [band(30, 140), band(140, 500), band(500, 2200), band(2200, 9000)];
          target = raw.map((v, i) => { peak[i] = Math.max(v, peak[i] * Math.exp(-dt / 30), .06); return Math.pow(clamp(v / peak[i]), 1.3); });
        }
      }
      smoothed = smoothed.map((s, i) => s + (target[i] - s) * (1 - Math.exp(-dt / (target[i] > s ? .12 : .35))));
    }
    function step(now) {
      if (!shown() || document.hidden) return false;
      if (!gl || gl.isContextLost() || !program) return false;
      if (window.kefeFrameGate && !window.kefeFrameGate(now)) return true;
      if (!resize()) return true;
      const dt = Math.min(.1, Math.max(0, (now - (last || now)) / 1000)); last = now; tick += dt;
      audio(dt);
      gl.useProgram(program);
      def.draw({ gl, loc, cfg, dt, audio: smoothed, width: canvas.width, height: canvas.height, reducedMotion,
        advance: v => { t += v; return t; }, time: () => t });
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return true;
    }
    function start() { if (!shown() || document.hidden) return; if (!ensureGL()) return; last = performance.now(); loop?.start(); }
    function syncPowerUI() {
      if (canvas) canvas.style.display = shown() && gl && !gl.isContextLost() ? 'block' : 'none';
      if (power) {
        power.disabled = !!rendererError;
        powerState.textContent = rendererError ? 'Unavailable' : (enabled ? 'On' : 'Off');
        power.classList.toggle('is-on', enabled && !rendererError);
        power.setAttribute('aria-checked', String(enabled && !rendererError));
      }
    }
    function sync() {
      if (shown()) {
        if (ensureGL()) { resize(); syncPowerUI(); start(); }
      } else {
        loop?.stop(); last = 0; syncPowerUI();
      }
      window.dispatchEvent(new CustomEvent('kefe-shader-vis-change', { detail: { id: def.id, enabled: shown(), power: enabled && !rendererError, active } }));
    }
    function setEnabled(v) { enabled = !!v; if (enabled) rendererError = null; sync(); }
    function setActive(v) { active = !!v; sync(); }

    function field(label, k, min, max, step, fmt) {
      const wrap = document.createElement('label'); wrap.className = 'kefe-visualiser-field';
      const head = document.createElement('span'), name = document.createElement('b'), out = document.createElement('output'), input = document.createElement('input');
      name.textContent = label; input.type = 'range'; input.min = min; input.max = max; input.step = step;
      const paint = () => { input.value = cfg[k]; out.textContent = fmt(Number(cfg[k])); };
      paint(); head.append(name, out); wrap.append(head, input);
      input.addEventListener('input', () => { cfg[k] = Number(input.value); out.textContent = fmt(cfg[k]); persist(); clearPresetMarks(); });
      ui.sync.push(paint);
      return wrap;
    }
    function clearPresetMarks() { presetSet?.querySelectorAll('button').forEach(b => { b.classList.remove('primary'); b.setAttribute('aria-pressed', 'false'); }); }
    function markPreset(btn) { clearPresetMarks(); if (btn) { btn.classList.add('primary'); btn.setAttribute('aria-pressed', 'true'); } }
    function choice(container, items, k, onPick) {
      items.forEach(([val, label]) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'kefe-btn'; b.textContent = label; b.dataset.value = val;
        b.addEventListener('click', () => { cfg[k] = val; persist(); paint(); onPick?.(); });
        container.appendChild(b);
      });
      const paint = () => container.querySelectorAll('button').forEach(b => { const on = String(cfg[k]) === b.dataset.value; b.classList.toggle('primary', on); b.setAttribute('aria-pressed', String(on)); });
      paint(); ui.sync.push(paint);
    }

    function init() {
      tabs = document.querySelector('.kefe-vis-tabs'); form = document.querySelector('.kefe-visualiser-form'); stage = document.querySelector('.kefe-stage');
      if (!tabs || !form || !stage) { console.error('[KEFE ' + def.name + '] Required preview or controls are missing.'); return; }
      canvas = document.createElement('canvas'); canvas.id = def.canvasId; canvas.setAttribute('aria-label', def.name + ' visualiser output');
      Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'none', opacity: String(def.opacity ?? .72), zIndex: '2', pointerEvents: 'none', borderRadius: '0' });
      stage.insertBefore(canvas, document.getElementById('kefeCanvas') || null);
      loop = window.kefeResilience?.createRenderLoop
        ? window.kefeResilience.createRenderLoop(step, { onError: err => reportError(err, def.name + ' stopped rendering', 'A graphics error interrupted ' + def.name + '.') })
        : { start() {}, stop() {}, dispose() {} };

      canvas.addEventListener('webglcontextlost', e => {
        e.preventDefault(); loop?.stop(); gl = null;
        if (shown()) reportError(new Error('WebGL context lost'), def.name + ' paused', 'The browser paused 3D graphics. Tap Retry or switch to Fluid Ink.');
      });
      canvas.addEventListener('webglcontextrestored', () => {
        rendererError = null;
        if (shown() && ensureGL()) { resize(); syncPowerUI(); start(); }
      });

      view = document.createElement('section'); view.className = 'kefe-vis-view kefe-shader-vis-view'; view.id = 'kefeVis' + def.id + 'View'; view.hidden = true;
      const intro = document.createElement('div'); intro.className = 'kefe-visualiser-intro'; intro.hidden = true; view.appendChild(intro);

      power = document.createElement('button'); power.type = 'button'; power.className = 'kefe-btn kefe-switch kefe-vis-option-power';
      power.setAttribute('role', 'switch'); power.setAttribute('aria-checked', 'false'); power.setAttribute('aria-label', def.name + ' Visualiser');
      powerState = document.createElement('span'); powerState.className = 'kefe-switch-state'; powerState.textContent = 'Off';
      const track = document.createElement('span'); track.className = 'kefe-switch-track'; track.setAttribute('aria-hidden', 'true');
      const thumb = document.createElement('span'); thumb.className = 'kefe-switch-thumb'; track.appendChild(thumb); power.append(powerState, track);
      power.addEventListener('click', e => { e.stopPropagation(); setEnabled(!enabled); });

      const presetRow = document.querySelector('#kefeVisualiserPresetRow') || document.querySelector('.kefe-visualiser-preset-row');
      presetSet = document.createElement('div'); presetSet.className = 'kefe-visualiser-preset-set'; presetSet.id = 'kefe' + def.id + 'PresetSet'; presetSet.hidden = true;
      const presetBox = document.createElement('div'); presetBox.className = 'kefe-shader-vis-presets'; presetSet.appendChild(presetBox);
      def.presets.forEach(p => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'kefe-btn'; b.textContent = p.label; b.dataset.preset = p.id;
        b.addEventListener('click', () => { Object.assign(cfg, p.values); t = 0; persist(); ui.sync.forEach(f => f()); markPreset(b); });
        presetBox.appendChild(b);
      });
      presetRow?.appendChild(presetSet);
      def.buildView({ view, cfg, field, choice, persist, clearPresetMarks });

      const tabsList = tabs.querySelector('[role="tablist"]') || tabs;
      tab = document.createElement('button'); tab.type = 'button'; tab.className = 'kefe-btn'; tab.setAttribute('role', 'tab');
      tab.dataset.visualiser = def.id; tab.dataset.icon = def.icon; tab.setAttribute('aria-controls', view.id);
      tab.setAttribute('aria-label', def.name + ' visualiser'); tab.title = def.name + ' visualiser'; tab.textContent = def.name;
      const option = document.createElement('div'); option.className = 'kefe-vis-option'; option.append(tab, power);
      tabsList.appendChild(option); form.appendChild(view);

      tab.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('kefe-visualiser-select', { detail: { id: def.id } }));
        form.querySelectorAll('.kefe-vis-view').forEach(v => { v.hidden = v !== view; });
        tabs.querySelectorAll('.kefe-vis-option [role="tab"]').forEach(b => { const sel = b === tab; b.classList.toggle('primary', sel); b.setAttribute('aria-selected', String(sel)); });
        if (presetRow) { presetRow.hidden = false; presetRow.querySelectorAll('.kefe-visualiser-preset-set').forEach(s => { s.hidden = s !== presetSet; }); }
        const heading = document.getElementById('kefeVisualiserHeading'), description = document.getElementById('kefeVisualiserDescription');
        if (heading) heading.textContent = def.name; if (description) description.textContent = '';
        setActive(true);
      });
      /* Any other visualiser's tab (or a later-registered one) deselects this one. */
      const onVisSelect = e => { if (e.detail?.id !== def.id) { presetSet.hidden = true; view.hidden = true; setActive(false); } };
      const onResize = () => { if (shown()) resize(); };
      if (scope) {
        scope.on(window, 'kefe-visualiser-select', onVisSelect);
        scope.on(window, 'resize', onResize);
        scope.on(window, 'kefe-stage-resize', onResize);
        scope.add(() => { loop?.dispose(); destroyGL(); });
      } else {
        window.addEventListener('kefe-visualiser-select', onVisSelect);
        window.addEventListener('resize', onResize);
        window.addEventListener('kefe-stage-resize', onResize);
      }
      tabsList.addEventListener('click', e => {
        const c = e.target.closest('[role="tab"]');
        if (c && c !== tab && c.dataset.visualiser !== def.id) { presetSet.hidden = true; setActive(false); }
      });

      const isReady = () => !!(gl && !gl.isContextLost() && program && canvas && canvas.width > 1 && canvas.height > 1);
      const api = {
        id: def.id,
        name: def.name,
        setEnabled,
        setActive,
        isReady,
        destroy() { scope?.dispose(); instances.delete(def.id); },
        canvas: () => canvas,
        getState: () => ({ enabled: shown(), power: enabled && !rendererError, active, ready: isReady(), settings: { ...cfg } }),
      };
      instances.set(def.id, api);
      window.kefeShaderVis.instances = instances;
      window.dispatchEvent(new CustomEvent('kefe-shader-vis-ready', { detail: { id: def.id } }));
    }
    return { init };
  }

  window.kefeShaderVis = {
    instances,
    register(def) { const inst = make(def); if (ready) inst.init(); else queue.push(inst); },
    /* the canvas of whichever shader visualiser is the visible preview, or null */
    current() { for (const v of instances.values()) if (v.getState().enabled && v.isReady()) return v.canvas(); return null; },
    canvases() { return [...instances.values()].map(v => v.canvas()).filter(Boolean); },
  };
  if (!ready) document.addEventListener('DOMContentLoaded', () => { ready = true; queue.splice(0).forEach(i => i.init()); }, { once: true });
})();
