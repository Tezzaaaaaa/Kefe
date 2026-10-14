(() => {
  'use strict';

  const STORAGE_KEY = 'kefe.settings.v1';

  // key, label, hint, type, default, options
  const SCHEMA = [
    { group: 'Title card', items: [
      { key: 'titleCard', label: 'Show title card', hint: 'Apple Music effect only: artwork and details on their own until 1s before the first lyric, then they move up into the header. Included in exports.', type: 'toggle', def: true }
    ]},
    { group: 'Lyrics', items: [
      { key: 'lyricOffset', label: 'Lyric offset', hint: 'Positive shows lyrics later, negative shows them earlier.', type: 'range', def: 0, min: -3, max: 3, step: 0.05, fmt: v => (v > 0 ? '+' : '') + v.toFixed(2) + 's' }
    ]},
    { group: 'Defaults', items: [
      { key: 'aspect', label: 'Aspect ratio', hint: 'Used for the preview and exports.', type: 'select', def: '16:9', options: [['16:9', '16:9'], ['9:16', '9:16'], ['1:1', '1:1']] },
      { key: 'exportResolution', label: 'Export resolution', type: 'select', def: '1080', options: [['720', '720p'], ['1080', '1080p'], ['1440', '1440p (2K)'], ['2160', '2160p (4K)']] }
    ]},
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

    const project = el('section', 'kefe-settings-project');
    const projectHead = el('div', 'kefe-settings-project-head');
    const projectIcon = el('img', 'kefe-settings-project-icon');
    projectIcon.src = './app/brand/favicon.svg';
    projectIcon.alt = 'KEFE';
    const projectCopy = el('div', 'kefe-settings-project-copy');
    projectCopy.appendChild(el('strong', '', 'KEFE Visualiser'));
    projectCopy.appendChild(el('span', '', 'Browser-based music visualiser and lyric-video editor'));
    projectHead.append(projectIcon, projectCopy);
    project.appendChild(projectHead);
    const projectGrid = el('div', 'kefe-settings-project-grid');
    const projectItems = [
      ['Repository', 'Tezzaaaaaa/Kefe'],
      ['Visibility', 'Public'],
      ['Branch', 'main'],
      ['Status', 'Active development'],
      ['Commits', '1,799+'],
      ['Editor', 'KEFE Visualiser'],
      ['Site', 'tezzaaaaaa.github.io/Kefe'],
      ['Hosting', 'GitHub Pages'],
      ['Stack', 'HTML · CSS · JavaScript · Three.js'],
      ['Scope', 'Lyric video · music visualiser']
    ];
    projectItems.forEach(([label, value]) => {
      const item = el('div', 'kefe-settings-project-item');
      item.append(el('span', '', label), el('strong', '', value));
      projectGrid.appendChild(item);
    });
    project.appendChild(projectGrid);
    const projectLinks = el('div', 'kefe-settings-project-links');
    const live = el('a', 'kefe-btn', 'Open live site'); live.href = 'https://tezzaaaaaa.github.io/Kefe/'; live.target = '_blank'; live.rel = 'noopener noreferrer';
    const github = el('a', 'kefe-btn', 'Open GitHub'); github.href = 'https://github.com/Tezzaaaaaa/Kefe'; github.target = '_blank'; github.rel = 'noopener noreferrer';
    projectLinks.append(live, github);
    project.appendChild(projectLinks);
    dlg.appendChild(project);

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
