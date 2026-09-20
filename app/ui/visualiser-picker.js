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
      '#kefeVisualiserPicker .kefe-ra-row .val{flex:0 0 34px;text-align:right;font-size:11px;color:var(--text);font-variant-numeric:tabular-nums}',
      '#kefeVisualiserPicker .kefe-bc-picks{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}',
      '#kefeVisualiserPicker .kefe-bc-pick{padding:5px 9px;border:1px solid var(--line);border-radius:999px;background:var(--surface);color:var(--text-2);font:600 11px \\\"Open Sans\\\",Arial,sans-serif;cursor:pointer;white-space:nowrap}',
      '#kefeVisualiserPicker .kefe-bc-pick:hover{border-color:var(--line-strong);color:var(--text)}',
      '#kefeVisualiserPicker .kefe-bc-pick.active{border-color:var(--red);color:var(--red)}',
      '#kefeVisualiserPicker .kefe-bc-tools{display:flex;gap:8px;margin-bottom:8px}',
      '#kefeVisualiserPicker .kefe-bc-tools input{flex:1 1 auto;min-width:0;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--text);font:12px \"Open Sans\",Arial,sans-serif}',
      '#kefeVisualiserPicker .kefe-bc-tools button{flex:0 0 auto;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--text);font:600 12px \"Open Sans\",Arial,sans-serif;cursor:pointer}',
      '#kefeVisualiserPicker .kefe-bc-tools button:hover{border-color:var(--line-strong)}',
      '#kefeVisualiserPicker .kefe-bc-count{font-size:11px;color:var(--text-3);margin-bottom:8px}',
      '#kefeVisualiserPicker .kefe-bc-list{max-height:240px;overflow-y:auto;border:1px solid var(--line);border-radius:8px;background:var(--surface)}',
      '#kefeVisualiserPicker .kefe-bc-item{display:block;width:100%;padding:8px 10px;border:0;border-bottom:1px solid var(--line);background:transparent;color:var(--text);text-align:left;font:12px \"Open Sans\",Arial,sans-serif;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '#kefeVisualiserPicker .kefe-bc-item:last-child{border-bottom:0}',
      '#kefeVisualiserPicker .kefe-bc-item:hover{background:var(--surface-2)}',
      '#kefeVisualiserPicker .kefe-bc-item.active{color:var(--red);font-weight:700}',
      '#kefeVisualiserPicker .kefe-bc-item[hidden]{display:none}'
    ].join('\n');
    document.head.appendChild(s);
  }

  var MODES = [
    { key: 'ferrofluid',       label: 'Ferrofluid' },
    { key: 'liquidglass',      label: 'Liquid Glass' },
    { key: 'cinematicfluid',   label: 'Cinematic Fluid' },
    { key: 'fractalplanet',    label: 'Fractal Planet' },
    { key: 'cosmicattractor',  label: 'Cosmic Attractor' },
    { key: 'gyroidcrystal',    label: 'Gyroid Crystal' },
    { key: 'metaball',          label: 'Sonic Metaball' },
    { key: 'holographicribbon', label: 'Holographic Ribbon' },
    { key: 'blackhole',         label: 'Black Hole' },
    { key: 'neuralnetwork',     label: 'Neural Network' },
    { key: 'ra',                label: 'Ra' },
    { key: 'tuffpuff',          label: 'TuffPuff' },
    { key: 'ridgeline',         label: 'Ridgeline' },
    { key: 'butterchurn',       label: 'Spectrum' }
  ];

  function current(){
    return (window.state && window.state.style && window.state.style.visualiserStyle) || 'pulse';
  }

  // Butterchurn preset list: keep the highlighted row in step with state
  // (project load, Random, external changes) without rebuilding the panel.
  function syncButterchurnList(box){
    var list = box && box.querySelector('.kefe-bc-list');
    if (!list || !window.kefeButterchurn) return;
    var sel = window.kefeButterchurn.effectivePreset(window.state);
    if (list.dataset.selected === sel) return;
    list.dataset.selected = sel;
    list.querySelectorAll('.kefe-bc-item').forEach(function(it){
      var on = it.dataset.preset === sel;
      it.classList.toggle('active', on);
      if (on) it.scrollIntoView({ block: 'nearest' });
    });
    (box.querySelectorAll('.kefe-bc-pick') || []).forEach(function(chip){
      chip.classList.toggle('active', chip.dataset.preset === sel);
    });
  }

  function buildButterchurnControls(box){
    var bc = document.createElement('div');
    bc.className = 'kefe-ra-controls';
    var api = window.kefeButterchurn;
    var presets = api && api.isLoaded() ? api.presetNames() : [];
    var displayNames = {};
    presets.forEach(function(name, index){
      var clean = name.replace(/^[^\\-]+\\s*[-+]\\s*/i, '').trim();
      displayNames[name] = 'Spectrum ' + String(index + 1).padStart(2, '0') + (clean ? ' — ' + clean : '');
    });
    if (!presets.length) {
      bc.innerHTML = '<div class="kefe-vis-hint">' + ((api && api.error()) || 'Spectrum presets are not available.') + '</div>';
      box.appendChild(bc);
      return;
    }

    var tools = document.createElement('div');
    tools.className = 'kefe-bc-tools';
    var search = document.createElement('input');
    search.type = 'search';
    search.placeholder = 'Search ' + presets.length + ' Spectrum presets';
    var prev = document.createElement('button'); prev.type = 'button'; prev.textContent = '\u2039'; prev.title = 'Previous preset';
    var next = document.createElement('button'); next.type = 'button'; next.textContent = '\u203A'; next.title = 'Next preset';
    var rnd = document.createElement('button'); rnd.type = 'button'; rnd.textContent = 'Random';
    tools.appendChild(search); tools.appendChild(prev); tools.appendChild(next); tools.appendChild(rnd);

    // Curated shortlist: 20 presets from the bundled preset pack. User-facing
    // names are KEFE-native Spectrum names; original preset keys remain
    // internal so the underlying preset data and rendering stay unchanged.
    var TOP20 = [
      'Geiss - Reaction Diffusion 2',
      'Geiss - Spiral Artifact',
      'Geiss - Thumb Drum',
      'Geiss - Cauldron - painterly 2 (saturation remix)',
      'Martin - charisma',
      'martin - ghost city',
      'martin - glass corridor',
      'martin - infinity (2010 update)',
      'Martin - liquid arrows',
      'martin - stormy sea (2010 update)',
      'martin - The Bridge of Khazad-Dum',
      'martin - witchcraft reloaded',
      'Flexi - alien fish pond',
      'Flexi - area 51',
      'Flexi - mindblob mix',
      'Flexi - predator-prey-spirals',
      'Flexi - smashing fractals [acid etching mix]',
      'Rovastar - Oozing Resistance',
      'Zylot - Star Ornament',
      'Unchained - Unified Drag 2'
    ].filter(function(name){ return presets.indexOf(name) !== -1; });

    if (TOP20.length) {
      var picksLabel = document.createElement('div');
      picksLabel.className = 'kefe-vis-hint';
      picksLabel.style.marginBottom = '6px';
      picksLabel.textContent = 'Top 20 picks';
      bc.appendChild(picksLabel);

      var picks = document.createElement('div');
      picks.className = 'kefe-bc-picks';
      TOP20.forEach(function(name){
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'kefe-bc-pick';
        chip.dataset.preset = name;
          chip.title = displayNames[name];
        chip.textContent = displayNames[name];
        chip.addEventListener('click', function(){ choose(name); });
        picks.appendChild(chip);
      });
      bc.appendChild(picks);
    }

    bc.appendChild(tools);

    var list = document.createElement('div');
    list.className = 'kefe-bc-list';
    presets.forEach(function(name){
      var it = document.createElement('button');
      it.type = 'button';
      it.className = 'kefe-bc-item';
      it.dataset.preset = name;
      it.title = displayNames[name];
      it.textContent = displayNames[name];
      it.addEventListener('click', function(){ choose(name); });
      list.appendChild(it);
    });
    bc.appendChild(list);

    function choose(name){
      if (!window.state) return;
      if (!window.state.style) window.state.style = {};
      window.state.style.butterchurnPreset = name;
      syncButterchurnList(box);
      window.redrawCurrentPreviewFrame && window.redrawCurrentPreviewFrame();
    }
    function step(delta){
      var cur = api.effectivePreset(window.state);
      var i = presets.indexOf(cur);
      choose(presets[(i + delta + presets.length) % presets.length]);
    }
    prev.addEventListener('click', function(){ step(-1); });
    next.addEventListener('click', function(){ step(1); });
    rnd.addEventListener('click', function(){ choose(presets[Math.floor(Math.random() * presets.length)]); });
    search.addEventListener('input', function(){
      var q = search.value.trim().toLowerCase();
      list.querySelectorAll('.kefe-bc-item').forEach(function(it){
        it.hidden = !!q && (displayNames[it.dataset.preset] || it.dataset.preset).toLowerCase().indexOf(q) === -1;
      });
    });

    box.appendChild(bc);
    syncButterchurnList(box);
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
        if (cur === 'butterchurn') syncButterchurnList(existing);
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

    // ---- Premium visualiser controls: four creative controls per mode ----
    var PREMIUM_CONTROLS = {
      ferrofluid:       { name: 'Ferrofluid',       key: 'ferrofluid' },
      liquidglass:      { name: 'Liquid Glass',     key: 'liquidglass' },
      cinematicfluid:   { name: 'Cinematic Fluid',  key: 'cinematicfluid' },
      fractalplanet:    { name: 'Fractal Planet',   key: 'fractalplanet' },
      cosmicattractor:  { name: 'Cosmic Attractor', key: 'cosmicattractor' },
      gyroidcrystal:    { name: 'Gyroid Crystal',   key: 'gyroidcrystal' },
      metaball:         { name: 'Sonic Metaball',   key: 'metaball' },
      holographicribbon:{ name: 'Holographic Ribbon', key: 'holographicribbon' },
      blackhole:        { name: 'Black Hole',       key: 'blackhole' },
      neuralnetwork:    { name: 'Neural Network',   key: 'neuralnetwork' }
    };

    if (PREMIUM_CONTROLS[cur]) {
      var pc = document.createElement('div');
      pc.className = 'kefe-ra-controls';
      var cfgs = [
        { key: 'React',  label: 'React',  min: 0,   max: 2,   step: .05, def: 1 },
        { key: 'Motion', label: 'Motion', min: 0,   max: 2,   step: .05, def: 1 },
        { key: 'Detail', label: 'Detail', min: .4, max: 1.8, step: .05, def: 1 },
        { key: 'Glow',   label: 'Glow',   min: 0,   max: 2,   step: .05, def: 1 }
      ];
      var pk = PREMIUM_CONTROLS[cur].key;
      cfgs.forEach(function(cfg){
        var fullKey = pk + cfg.key;
        var existingVal = (window.state.style && window.state.style[fullKey]);
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
          window.state.style[fullKey] = v;
          valEl.textContent = v.toFixed(2);
          window.redrawCurrentPreviewFrame && window.redrawCurrentPreviewFrame();
        });
        row.appendChild(lab);
        row.appendChild(inp);
        row.appendChild(valEl);
        pc.appendChild(row);
      });
      box.appendChild(pc);
    }

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
      box.appendChild(ridge);
    }

    // ---- Spectrum: preset browser, only when Spectrum is selected ----
    if (cur === 'butterchurn') buildButterchurnControls(box);

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