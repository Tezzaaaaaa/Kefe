(() => {
  'use strict';

  const PANEL_TO_LEGACY = Object.freeze({
    'lyric-nudge': 'lyricOffset'
  });
  const LEGACY_TO_PANEL = Object.freeze({
    lyricOffset: 'lyric-nudge'
  });
  const DISABLED_KEYS = new Set([
    'background-enabled',
    'background-mode',
    'lyric-effects-enabled',
    'lyric-accent',
    'visualiser-style',
    'visualiser-intensity',
    'export-ratio',
    'export-format',
    'export-scale'
  ]);

  async function mount() {
    if (document.getElementById('kefe-settings-panel')) return;
    const response = await fetch(new URL('./panel.html', document.currentScript.src), { credentials: 'same-origin' });
    if (!response.ok) throw new Error('Settings panel markup request failed: ' + response.status);
    const template = document.createElement('template');
    template.innerHTML = await response.text();
    const root = template.content.querySelector('#kefe-settings-panel');
    const api = window.kefeSettings;
    if (!root || !window.KefeSettingsPanel || !api ||
        typeof api.defaults !== 'function' || typeof api.get !== 'function' ||
        typeof api.set !== 'function' || typeof api.reset !== 'function' ||
        typeof api.onChange !== 'function') {
      throw new Error('Settings panel adapter dependencies are unavailable.');
    }

    root.querySelectorAll('[data-setting]').forEach(control => {
      const panelKey = control.dataset.setting;
      if (PANEL_TO_LEGACY[panelKey]) return;
      if (!DISABLED_KEYS.has(panelKey)) {
        control.disabled = true;
        control.dataset.state = 'disabled';
        return;
      }
      control.disabled = true;
      control.dataset.state = 'disabled';
      control.setAttribute('aria-disabled', 'true');
      const row = control.closest('.setting-row');
      if (row) row.dataset.state = 'disabled';
    });

    root.querySelectorAll('.section').forEach(section => {
      const controls = [...section.querySelectorAll('[data-setting]')];
      if (controls.length && controls.every(control => control.disabled)) {
        section.dataset.state = 'disabled';
      }
    });

    const host = document.createElement('section');
    host.className = 'kefe-settings-mount';
    host.setAttribute('aria-label', 'Additional settings panel');
    host.appendChild(root);
    const editor = document.querySelector('.kefe-editor');
    if (editor) editor.after(host);
    else document.body.appendChild(host);

    const panel = new window.KefeSettingsPanel(root, {
      storage: null,
      autoPersist: false,
      debounceMs: 80,
      exclusive: false,
      bindShortcuts: false
    });
    let writingToLegacy = false;

    function readPanelValues() {
      const defaults = api.defaults();
      const values = {};
      Object.entries(PANEL_TO_LEGACY).forEach(([panelKey, legacyKey]) => {
        const current = api.get(legacyKey);
        values[panelKey] = typeof current === typeof defaults[legacyKey]
          ? current
          : defaults[legacyKey];
      });
      return values;
    }

    function applyLegacyValues() {
      panel.applyValues(readPanelValues(), { silent: true });
    }

    applyLegacyValues();

    panel.onChange(({ key, value }) => {
      const legacyKey = PANEL_TO_LEGACY[key];
      if (!legacyKey || writingToLegacy) return;
      writingToLegacy = true;
      try {
        window.kefeSettings.set(legacyKey, value);
      } finally {
        writingToLegacy = false;
      }
    });

    panel.onReset(() => {
      writingToLegacy = true;
      try {
        window.kefeSettings.reset();
        applyLegacyValues();
      } finally {
        writingToLegacy = false;
      }
    });

    api.onChange((legacyKey) => {
      if (writingToLegacy) return;
      const panelKey = LEGACY_TO_PANEL[legacyKey];
      if (!panelKey) return;
      applyLegacyValues();
      root.dispatchEvent(new CustomEvent('kefe:change', {
        detail: { key: panelKey, value: api.get(legacyKey), values: panel.getValues() }
      }));
    });

    window.kefeSettingsPanelAdapter = Object.freeze({
      panel,
      readPanelValues,
      getSlot: name => panel.getSlot(name)
    });
  }

  function start() {
    mount().catch(error => console.error('[KEFE settings panel adapter]', error));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
