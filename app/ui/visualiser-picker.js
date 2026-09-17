(function(){
  'use strict';
  if (window.__kefeVisualiserPicker) return;
  window.__kefeVisualiserPicker = true;

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
      '#kefeVisualiserPicker .kefe-vis-btn.active-effect{border-color:var(--red);box-shadow:0 0 0 1px var(--red)}'
    ].join('\n');
    document.head.appendChild(s);
  }

  var MODES = [
    { key: 'pulse',    label: 'Pulse'    },
    { key: 'spectrum', label: 'Spectrum' },
    { key: 'waveform', label: 'Waveform' },
    { key: 'radial',   label: 'Radial'   },
    { key: 'ra',       label: 'Ra'       }
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
      existing.querySelectorAll('.kefe-vis-btn').forEach(function(b){
        b.classList.toggle('active-effect', b.dataset.mode === cur);
      });
      return;
    }
    if (existing) existing.remove();

    var box = document.createElement('div');
    box.id = 'kefeVisualiserPicker';
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

    host.appendChild(box);
  }

  tick();
  setInterval(tick, 300);
  ['click','change','input'].forEach(function(ev){
    document.addEventListener(ev, function(){ setTimeout(tick, 80); }, true);
  });
  console.log('[KEFE] visualiser picker active');
})();
