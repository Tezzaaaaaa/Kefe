(() => {
  'use strict';

  const STORAGE_KEY = 'kefe.settings.v1';

  // key, label, hint, type, default, options
  const SCHEMA = [
    { group: 'Title card', items: [
      { key: 'titleCard', label: 'Show title card', hint: 'Song artwork and details before the first lyric. Included in exports.', type: 'toggle', def: true },
      { key: 'titleCardMax', label: 'Max length', hint: 'Never longer than the gap before the first lyric.', type: 'range', def: 10, min: 2, max: 10, step: 0.5, fmt: v => v + 's' }
    ]},
    { group: 'Lyrics', items: [
      { key: 'lyricOffset', label: 'Lyric offset', hint: 'Positive shows lyrics later, negative shows them earlier.', type: 'range', def: 0, min: -3, max: 3, step: 0.05, fmt: v => (v > 0 ? '+' : '') + v.toFixed(2) + 's' }
    ]},
    { group: 'Defaults', items: [
      { key: 'aspect', label: 'Aspect ratio', hint: 'Used for the preview and exports.', type: 'select', def: '16:9', options: [['16:9', '16:9'], ['9:16', '9:16'], ['1:1', '1:1']] },
      { key: 'exportResolution', label: 'Export resolution', type: 'select', def: '1080', options: [['720', '720p'], ['1080', '1080p']] }
    ]},
    { group: 'Visualiser', items: [
      { key: 'particleCount', label: 'Particle count', hint: 'Applies next time the page loads. Lower it if the preview stutters.', type: 'range', def: 20000, min: 1000, max: 30000, step: 1000, fmt: v => Number(v).toLocaleString() },
      { key: 'autoSpin', label: 'Auto spin', hint: 'Applies next time the page loads.', type: 'toggle', def: true }
    ]}
  ];

  const defaults = {};
  SCHEMA.forEach(g => g.items.forEach(i => { defaults[i.key] = i.def; }));

  let values = { ...defaults };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (saved && typeof saved === 'object') {
      Object.keys(defaults).forEach(k => {
        if (!(k in saved)) return;
        if (typeof saved[k] === typeof defaults[k]) values[k] = saved[k];
      });
    }
  } catch (_) {}

  const listeners = [];
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(values)); } catch (_) {}
  }
  function set(key, value) {
    if (!(key in defaults) || values[key] === value) return;
    values[key] = value;
    persist();
    listeners.slice().forEach(fn => { try { fn(key, value); } catch (e) { console.warn('[KEFE settings]', e); } });
  }

  window.kefeSettings = {
    get: key => values[key],
    set,
    all: () => ({ ...values }),
    defaults: () => ({ ...defaults }),
    reset() { Object.keys(defaults).forEach(k => set(k, defaults[k])); },
    onChange(fn) { if (typeof fn === 'function') listeners.push(fn); }
  };

  /* ---------- UI ---------- */
  let backdrop = null, opener = null;
  const controls = {};

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function build() {
    backdrop = el('div', 'kefe-settings-backdrop');
    backdrop.hidden = true;
    const dlg = el('div', 'kefe-settings');
    dlg.setAttribute('role', 'dialog');
    dlg.setAttribute('aria-modal', 'true');
    dlg.setAttribute('aria-labelledby', 'kefeSettingsTitle');
    dlg.tabIndex = -1;

    const head = el('div', 'kefe-settings-head');
    const title = el('h2', '', 'Settings');
    title.id = 'kefeSettingsTitle';
    const close = el('button', 'kefe-btn kefe-settings-close', 'Done');
    close.type = 'button';
    close.addEventListener('click', closeSettings);
    head.append(title, close);
    dlg.appendChild(head);

    SCHEMA.forEach(group => {
      const section = el('section', 'kefe-settings-group');
      section.appendChild(el('h3', 'kefe-settings-group-title', group.group));
      group.items.forEach(item => {
        const row = el('div', 'kefe-settings-row');
        const copy = el('div', 'kefe-settings-copy');
        const label = el('label', 'kefe-settings-label', item.label);
        const id = 'kefeSetting-' + item.key;
        label.htmlFor = id;
        copy.appendChild(label);
        if (item.hint) copy.appendChild(el('p', 'kefe-settings-hint', item.hint));
        const field = el('div', 'kefe-settings-field');

        if (item.type === 'toggle') {
          const sw = el('button', 'kefe-switch');
          sw.type = 'button'; sw.id = id; sw.setAttribute('role', 'switch');
          sw.appendChild(el('span', 'kefe-switch-knob'));
          sw.addEventListener('click', () => set(item.key, !values[item.key]));
          controls[item.key] = () => sw.setAttribute('aria-checked', values[item.key] ? 'true' : 'false');
          field.appendChild(sw);
        } else if (item.type === 'range') {
          const out = el('output', 'kefe-settings-value');
          const input = el('input');
          input.type = 'range'; input.id = id;
          input.min = item.min; input.max = item.max; input.step = item.step;
          input.addEventListener('input', () => set(item.key, parseFloat(input.value)));
          controls[item.key] = () => { input.value = values[item.key]; out.textContent = item.fmt(values[item.key]); };
          field.append(input, out);
        } else if (item.type === 'select') {
          const sel = el('select', 'kefe-select');
          sel.id = id;
          item.options.forEach(([v, t]) => { const o = el('option', '', t); o.value = v; sel.appendChild(o); });
          sel.addEventListener('change', () => set(item.key, sel.value));
          controls[item.key] = () => { sel.value = String(values[item.key]); };
          field.appendChild(sel);
        }
        row.append(copy, field);
        section.appendChild(row);
      });
      dlg.appendChild(section);
    });

    const foot = el('div', 'kefe-settings-foot');
    const reset = el('button', 'kefe-btn', 'Reset to defaults');
    reset.type = 'button';
    reset.addEventListener('click', () => window.kefeSettings.reset());
    foot.appendChild(reset);
    dlg.appendChild(foot);

    backdrop.appendChild(dlg);
    backdrop.addEventListener('mousedown', e => { if (e.target === backdrop) closeSettings(); });
    document.body.appendChild(backdrop);
    refresh();
  }

  function refresh() { Object.values(controls).forEach(fn => fn()); }
  window.kefeSettings.onChange(refresh);

  function openSettings(from) {
    if (!backdrop) build();
    opener = from || document.activeElement;
    refresh();
    backdrop.hidden = false;
    backdrop.querySelector('.kefe-settings').focus();
  }
  function closeSettings() {
    if (!backdrop || backdrop.hidden) return;
    backdrop.hidden = true;
    if (opener && typeof opener.focus === 'function') opener.focus();
    opener = null;
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest && e.target.closest('[data-top-panel="settings"]');
    if (btn) openSettings(btn);
  });
  document.addEventListener('keydown', e => {
    if (!backdrop || backdrop.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); closeSettings(); return; }
    if (e.key === 'Tab') {
      const f = Array.from(backdrop.querySelectorAll('button,input,select')).filter(n => !n.disabled);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === backdrop.firstChild)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
})();
