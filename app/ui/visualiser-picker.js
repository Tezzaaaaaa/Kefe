(function(){
  'use strict';
  if (window.__kefeVisualiserPicker) return;
  window.__kefeVisualiserPicker = true;

  // Keep body[data-project-type] in sync so CSS can scope visualiser-only
  // rules without fighting the rest of the layout.
  (function projectTypeMirror() {
    var last = null;
    function sync() {
      var pt = (window.state && window.state.projectType) || '';
      if (pt !== last) {
        document.body.setAttribute('data-project-type', pt);
        last = pt;
      }
    }
    sync();
    setInterval(sync, 300);
  })();


  function injectCss(){
    if (document.getElementById('kefe-visualiser-picker-css')) return;
    var s = document.createElement('style');
    s.id = 'kefe-visualiser-picker-css';
    s.textContent = [
      '#kefeVisualiserPicker{margin:14px 0 12px;padding:14px;border:1px solid var(--line);border-radius:12px;background:var(--surface-2)}',
      '#kefeVisualiserPicker .kefe-vis-title{font-size:12px;font-weight:700;color:var(--text);margin-bottom:4px}',
      '#kefeVisualiserPicker .kefe-vis-hint{font-size:11px;color:var(--text-3);margin-bottom:12px;line-height:1.45}',
      '#kefeVisualiserPicker .kefe-vis-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}',
      '#kefeVisualiserPicker .kefe-vis-btn{position:relative;overflow:hidden;min-height:64px;padding:10px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--text);font:600 12px "Open Sans",Arial,sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:border-color .18s ease,box-shadow .18s ease}',
      '#kefeVisualiserPicker .kefe-vis-btn:hover{border-color:var(--line-strong)}',
      '#kefeVisualiserPicker .kefe-vis-btn.active-effect{border-color:var(--red);box-shadow:0 0 0 1px var(--red)}',
      '#kefeVisualiserPicker .kefe-ra-controls{margin-top:12px;padding-top:12px;border-top:1px solid var(--line)}',
      '#kefeVisualiserPicker .kefe-ra-row{display:flex;align-items:center;gap:10px;margin-bottom:8px}',
      '#kefeVisualiserPicker .kefe-ra-row label{flex:0 0 74px;font-size:11px;color:var(--text-2);text-transform:uppercase;letter-spacing:.06em}',
      '#kefeVisualiserPicker .kefe-ra-row input[type=range]{flex:1 1 auto;-webkit-appearance:none;appearance:none;height:3px;background:var(--line);border-radius:2px;outline:none;cursor:pointer}',
      '#kefeVisualiserPicker .kefe-ra-row input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:var(--text);border:0;cursor:pointer}',
      '#kefeVisualiserPicker .kefe-ra-row input[type=range]::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:var(--text);border:0;cursor:pointer}',
      '#kefeVisualiserPicker .kefe-ra-row .val{flex:0 0 34px;text-align:right;font-size:11px;color:var(--text);font-variant-numeric:tabular-nums}'
    ].join('\n');
    document.head.appendChild(s);
  }

  var MODES = [
    { key: 'ra',        label: 'Ra'        },
    { key: 'tuffpuff',  label: 'TuffPuff'  },
    { key: 'ridgeline', label: 'Ridgeline' }
  ];

  function current(){
    return (window.state && window.state.style && window.state.style.visualiserStyle) || 'pulse';
  }

  function tick(){
    injectCss();
    var isVisualiser = window.state && window.state.projectType === 'visualiser';
    var onStyleStep = document.body.dataset.wizardStep === 'style';
    var host = document.getElementById('wizardSection');
    var existing = document.getElementById('kefeVisualiserPicker');

    if (!isVisualiser || !onStyleStep || !host) {
      if (existing) existing.remove();
      return;
    }

    if (existing && existing.parentElement === host) {
      var cur = current();
      var renderedMode = existing.dataset.renderedMode || '';
      if (renderedMode === cur) {
        existing.querySelectorAll('.kefe-vis-btn').forEach(function(b){
          b.classList.toggle('active-effect', b.dataset.mode === cur);
        });
        return;
      }
      // Rebuild the panel when the selected mode changes so its mode-specific
      // controls (including Ridgeline) are actually rendered.
      existing.remove();
      existing = null;
    }
    if (existing) existing.remove();

    var box = document.createElement('div');
    box.id = 'kefeVisualiserPicker';
    box.dataset.renderedMode = current();
    box.innerHTML =
      '<div class="kefe-vis-title">Visualiser style</div>' +
      '<div class="kefe-vis-hint">Audio-reactive visuals driven by your track\'s energy and beats.</div>' +
      '<div class="kefe-vis-grid"></div>';

    var grid = box.querySelector('.kefe-vis-grid');
    MODES.forEach(function(m){
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'kefe-vis-btn';
      b.dataset.mode = m.key;
      b.textContent = m.label;
      b.addEventListener('click', function(){
        if (!window.state) return;
        if (!window.state.style) window.state.style = {};
        window.state.style.visualiserStyle = m.key;
        window.redrawCurrentPreviewFrame && window.redrawCurrentPreviewFrame();
        tick();
      });
      grid.appendChild(b);
    });

    var cur = current();
    grid.querySelectorAll('.kefe-vis-btn').forEach(function(b){
      b.classList.toggle('active-effect', b.dataset.mode === cur);
    });

    // ---- TuffPuff controls: only when TuffPuff is selected ----
    if (cur === 'tuffpuff') {
      var tp = document.createElement('div');
      tp.className = 'kefe-ra-controls';
      var TP_SLIDERS = [
        { key: 'tpSpeed',     label: 'Speed',    min: 0.1, max: 3,   step: 0.05, def: 1.0 },
        { key: 'tpIntensity', label: 'Colour',   min: 0.03, max: 0.5, step: 0.01, def: 0.15 },
        { key: 'tpCurl',      label: 'Vortex',   min: 0,   max: 3,   step: 0.05, def: 1.0 },
        { key: 'tpForce',     label: 'Force',    min: 0,   max: 2.5, step: 0.05, def: 1.0 },
        { key: 'tpViscosity', label: 'Thick',    min: 0.4, max: 3,   step: 0.05, def: 1.0 },
        { key: 'tpBurst',     label: 'Burst',    min: 0.2, max: 3,   step: 0.05, def: 1.0 }
      ];
      TP_SLIDERS.forEach(function(cfg){
        var existingVal = (window.state.style && window.state.style[cfg.key]);
        var val = (existingVal === undefined || existingVal === null) ? cfg.def : existingVal;
        var row = document.createElement('div');
        row.className = 'kefe-ra-row';
        var lab = document.createElement('label');
        lab.textContent = cfg.label;
        var inp = document.createElement('input');
        inp.type = 'range';
        inp.min = cfg.min; inp.max = cfg.max; inp.step = cfg.step;
        inp.value = val;
        var valEl = document.createElement('span');
        valEl.className = 'val';
        valEl.textContent = (cfg.step < 0.1 ? Number(val).toFixed(2) : Number(val).toFixed(2));
        inp.addEventListener('input', function(){
          var v = Number(inp.value);
          if (!window.state.style) window.state.style = {};
          window.state.style[cfg.key] = v;
          valEl.textContent = v.toFixed(2);
          if (cfg.key === 'tpSpeed' && window.kefeTuffPuff && window.kefeTuffPuff.refresh) {
            // no-op: speed is read per frame
          }
          window.redrawCurrentPreviewFrame && window.redrawCurrentPreviewFrame();
        });
        row.appendChild(lab);
        row.appendChild(inp);
        row.appendChild(valEl);
        tp.appendChild(row);
      });
      box.appendChild(tp);
    }

    // ---- Ridgeline controls: only show when Ridgeline is selected ----
    if (cur === 'ridgeline') {
      var ridge = document.createElement('div');
      ridge.className = 'kefe-ra-controls';
      var RIDGE_SLIDERS = [
        { key: 'ridgeFlow',     label: 'Flow',   min: 0,    max: 2.0, step: 0.05, def: 0.35 },
        { key: 'ridgeSpeed',    label: 'Speed',  min: 0.25, max: 2.5, step: 0.05, def: 1.0 },
        { key: 'ridgeDepth',    label: 'Depth',  min: 0.5,  max: 2.0, step: 0.05, def: 1.0 },
        { key: 'ridgeReaction', label: 'React',  min: 0,    max: 2.0, step: 0.05, def: 1.0 },
        { key: 'ridgePeaks',    label: 'Peaks',  min: 0.3,  max: 2.0, step: 0.05, def: 1.0 }
      ];
      RIDGE_SLIDERS.forEach(function(cfg){
        var existingVal = (window.state.style && window.state.style[cfg.key]);
        var val = (existingVal === undefined || existingVal === null) ? cfg.def : existingVal;
        var row = document.createElement('div');
        row.className = 'kefe-ra-row';
        var lab = document.createElement('label');
        lab.textContent = cfg.label;
        var inp = document.createElement('input');
        inp.type = 'range';
        inp.min = cfg.min; inp.max = cfg.max; inp.step = cfg.step; inp.value = val;
        var valEl = document.createElement('span');
        valEl.className = 'val';
        valEl.textContent = Number(val).toFixed(2);
        inp.addEventListener('input', function(){
          var v = Number(inp.value);
          if (!window.state.style) window.state.style = {};
          window.state.style[cfg.key] = v;
          valEl.textContent = v.toFixed(2);
          window.redrawCurrentPreviewFrame && window.redrawCurrentPreviewFrame();
        });




        row.appendChild(lab);
        row.appendChild(inp);
        row.appendChild(valEl);
        ridge.appendChild(row);
      });
            // ---- Gradient preset swatches (once, below the sliders) ----
      var presetWrap = document.createElement('div');
      presetWrap.className = 'kefe-ridge-gradients';
      var presetLabel = document.createElement('div');
      presetLabel.className = 'kefe-ridge-gradients-label';
      presetLabel.textContent = 'Colour';
      presetWrap.appendChild(presetLabel);

      var presetRow = document.createElement('div');
      presetRow.className = 'kefe-ridge-gradients-row';
      var PRESETS = (window.kefeRidgeline && window.kefeRidgeline.presets) || {};
      var currentPreset = (window.state.style && window.state.style.ridgeGradientPreset) || 'pulsar-white';
      Object.keys(PRESETS).forEach(function(key){
        var preset = PRESETS[key];
        var sw = document.createElement('button');
        sw.type = 'button';
        sw.className = 'kefe-ridge-swatch' + (key === currentPreset ? ' active' : '');
        sw.title = preset.label;
        sw.setAttribute('aria-label', preset.label);
        sw.style.background = 'linear-gradient(90deg,' + preset.stops.join(',') + ')';
        sw.addEventListener('click', function(){
          if (!window.state.style) window.state.style = {};
          window.state.style.ridgeGradientPreset = key;
          presetRow.querySelectorAll('.kefe-ridge-swatch').forEach(function(b){ b.classList.remove('active'); });
          sw.classList.add('active');
          window.redrawCurrentPreviewFrame && window.redrawCurrentPreviewFrame();
        });
        presetRow.appendChild(sw);
      });
      presetWrap.appendChild(presetRow);
      ridge.appendChild(presetWrap);
      box.appendChild(ridge);
    }

    // ---- Ra controls: only show when Ra is the selected visualiser ----
    if (cur === 'ra') {
      var ctrl = document.createElement('div');
      ctrl.className = 'kefe-ra-controls';
      var RA_SLIDERS = [
        { key: 'raSpeed',    label: 'Speed',    min: 0,    max: 100, step: 1,    def: 30 },
        { key: 'raSpread',   label: 'Spread',   min: 0.5,  max: 3,   step: 0.05, def: 1.0 },
        { key: 'raReaction', label: 'React',    min: 0,    max: 3,   step: 0.05, def: 1.0 },
        { key: 'raFlare',    label: 'Flare',    min: 0,    max: 3,   step: 0.05, def: 1.0 },
        { key: 'raBreath',   label: 'Breath',   min: 0,    max: 3,   step: 0.05, def: 1.0 },
        { key: 'raFocus',    label: 'Focus',    min: 0,    max: 2,   step: 0.05, def: 1.0 }
      ];
      RA_SLIDERS.forEach(function(cfg){
        var existingVal = (window.state.style && window.state.style[cfg.key]);
        var val = (existingVal === undefined || existingVal === null) ? cfg.def : existingVal;

        var row = document.createElement('div');
        row.className = 'kefe-ra-row';

        var lab = document.createElement('label');
        lab.textContent = cfg.label;

        var inp = document.createElement('input');
        inp.type = 'range';
        inp.min = cfg.min; inp.max = cfg.max; inp.step = cfg.step;
        inp.value = val;

        var valEl = document.createElement('span');
        valEl.className = 'val';
        valEl.textContent = (cfg.step < 1 ? Number(val).toFixed(2) : String(Math.round(val)));

        inp.addEventListener('input', function(){
          var v = Number(inp.value);
          if (!window.state.style) window.state.style = {};
          window.state.style[cfg.key] = v;
          valEl.textContent = (cfg.step < 1 ? v.toFixed(2) : String(Math.round(v)));
          if (cfg.key === 'raSpread') {
            if (window.kefeVisualiser && window.kefeVisualiser.refreshRa) {
              window.kefeVisualiser.refreshRa();
            }
          }
          window.redrawCurrentPreviewFrame && window.redrawCurrentPreviewFrame();
        });

        row.appendChild(lab);
        row.appendChild(inp);
        row.appendChild(valEl);
        ctrl.appendChild(row);
      });
      box.appendChild(ctrl);
    }

    host.appendChild(box);
  }

  tick();
  setInterval(tick, 300);
  ['click','change','input'].forEach(function(ev){
    document.addEventListener(ev, function(){ setTimeout(tick, 80); }, true);
  });
  console.log('[KEFE] visualiser picker active');
})();
