(() => {
  'use strict';

  const scriptSrc = document.currentScript && document.currentScript.src;
  const MARKUP_URL = scriptSrc
    ? new URL('./panel.html?v=reset-footer-20261106-1', scriptSrc)
    : new URL('./app/settings/panel.html?v=three-tabs-20261106-1', window.location.href);
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
    if (!contentGroup || !designGroup || !audioVisualsGroup) {
      throw new Error('All three KEFE workspaces are required.');
    }

    const tablist = root.querySelector('[data-workspace-tablist]');
    const tabs = Array.from(root.querySelectorAll('[role="tab"][data-workspace-tab]'));
    const workspaces = Array.from(root.querySelectorAll('.kefe-workspace[data-group]'));
    if (!tablist || tabs.length !== 3 || workspaces.length !== 3) {
      throw new Error('All three persistent workspace tabs and panels are required.');
    }
    function activateWorkspace(name, moveFocus) {
      const selectedTab = tabs.find(tab => tab.dataset.workspaceTab === name);
      if (!selectedTab) return;
      tabs.forEach(tab => {
        const selected = tab === selectedTab;
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
      });
      workspaces.forEach(workspace => {
        const selected = workspace.dataset.group === name;
        workspace.hidden = !selected;
        workspace.setAttribute('aria-hidden', String(!selected));
      });
      root.dataset.activeWorkspace = name;
      if (moveFocus) selectedTab.focus();
    }
    const initialTab = tabs.find(tab => tab.getAttribute('aria-selected') === 'true') || tabs[0];
    activateWorkspace(initialTab.dataset.workspaceTab, false);
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => activateWorkspace(tab.dataset.workspaceTab, false));
      tab.addEventListener('keydown', event => {
        let nextIndex = index;
        if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
        else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
        else if (event.key === 'Home') nextIndex = 0;
        else if (event.key === 'End') nextIndex = tabs.length - 1;
        else return;
        event.preventDefault();
        activateWorkspace(tabs[nextIndex].dataset.workspaceTab, true);
      });
    });

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
      getSlot: name => settingsPanel.getSlot(name),
      activateWorkspace
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