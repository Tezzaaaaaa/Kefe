(() => {
  'use strict';

  const scriptSrc = document.currentScript && document.currentScript.src;
  const MARKUP_URL = scriptSrc
    ? new URL('./panel.html?v=three-workspaces-20261106-1', scriptSrc)
    : new URL('./app/settings/panel.html?v=three-workspaces-20261106-1', window.location.href);
  const SLOT_TO_PANEL = Object.freeze({
    media: 'media',
    'lyric-sync': 'lyrics',
    background: 'background-effects',
    'lyric-effects': 'effects',
    visualisers: 'visualiser',
    export: 'export'
  });
  const PANEL_TO_LEGACY = Object.freeze({ 'lyric-nudge': 'lyricOffset' });
  const LEGACY_TO_PANEL = Object.freeze({ lyricOffset: 'lyric-nudge' });

  async function mount() {
    if (document.getElementById('kefe-settings-panel')) return;
    const editing = document.querySelector('.kefe-editing');
    if (!editing) throw new Error('KEFE editor panel container is unavailable.');

    const response = await fetch(MARKUP_URL, { credentials: 'same-origin' });
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

    const placements = Object.entries(SLOT_TO_PANEL).map(([slotName, panelView]) => ({
      slot: root.querySelector('.kefe-slot[data-kefe-slot="' + slotName + '"]'),
      panel: editing.querySelector('.kefe-panel[data-panel-view="' + panelView + '"]')
    }));
    if (placements.some(item => !item.slot || !item.panel)) {
      throw new Error('Settings workspace integration requires all six existing editor panels and slots.');
    }

    const contentGroup = root.querySelector('.kefe-panel[data-group="content"]');
    const designGroup = root.querySelector('.kefe-panel[data-group="design"]');
    const audioVisualsGroup = root.querySelector('.kefe-panel[data-group="audio-visuals"]');
    if (!contentGroup || !designGroup || !audioVisualsGroup || !root.querySelector('.kefe-topbar')) {
      throw new Error('All three KEFE workspaces are required.');
    }

    const host = document.createElement('section');
    host.className = 'kefe-settings-mount';
    host.setAttribute('aria-label', 'KEFE editor workspaces');
    host.appendChild(root);
    editing.classList.add('kefe-settings-layout');
    editing.appendChild(host);

    placements.forEach(({ slot, panel }) => {
      panel.classList.add('kefe-settings-embedded-panel', 'active');
      panel.classList.remove('beui-accordion-collapsed', 'kefe-pane-shown', 'beui-accordion-enter');
      panel.style.removeProperty('height');
      panel.style.removeProperty('overflow');
      const heading = panel.querySelector(':scope > .kefe-panel-head h2');
      if (heading && panel.dataset.panelView === 'background-effects') heading.textContent = 'Background';
      slot.appendChild(panel);
    });

    editing.querySelectorAll('.kefe-tabs, .kefe-panels').forEach(element => {
      element.hidden = true;
      element.setAttribute('aria-hidden', 'true');
    });

    const settingsPanel = new window.KefeSettingsPanel(root, {
      storage: null,
      autoPersist: true,
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
        values[panelKey] = typeof current === typeof defaults[legacyKey] ? current : defaults[legacyKey];
      });
      return values;
    }

    function applyLegacyValues() {
      settingsPanel.applyValues(readPanelValues(), { silent: true });
    }

    applyLegacyValues();
    settingsPanel.onChange(({ key, value }) => {
      const legacyKey = PANEL_TO_LEGACY[key];
      if (!legacyKey || writingToLegacy) return;
      writingToLegacy = true;
      try { api.set(legacyKey, value); }
      finally { writingToLegacy = false; }
    });
    settingsPanel.onReset(() => {
      writingToLegacy = true;
      try {
        api.reset();
        applyLegacyValues();
      } finally { writingToLegacy = false; }
    });
    api.onChange(legacyKey => {
      if (!writingToLegacy && LEGACY_TO_PANEL[legacyKey]) applyLegacyValues();
    });

    window.kefeSettingsPanelAdapter = Object.freeze({
      panel: settingsPanel,
      readPanelValues,
      getSlot: name => settingsPanel.getSlot(name)
    });
  }

  function start() {
    mount().catch(error => console.error('[KEFE settings panel adapter]', error));
  }

  function startWhenReady() {
    const requiredViews = ['media', 'lyrics', 'background-effects', 'effects', 'visualiser', 'export'];
    const editorReady = !!document.querySelector('.kefe-editing') &&
      requiredViews.every(view => document.querySelector('.kefe-panel[data-panel-view="' + view + '"]'));
    if (editorReady && window.KefeSettingsPanel && window.kefeSettings) {
      start();
      return;
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startWhenReady, { once: true });
    else if (document.readyState !== 'complete') window.addEventListener('load', startWhenReady, { once: true });
    else start();
  }

  startWhenReady();
})();