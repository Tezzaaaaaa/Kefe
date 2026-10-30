(() => {
  'use strict';

  const scriptSrc = document.currentScript && document.currentScript.src;
  const MARKUP_URL = scriptSrc
    ? new URL('./panel.html?v=settings-panel-layout-20261030-1', scriptSrc)
    : new URL('./app/settings/panel.html?v=settings-panel-layout-20261030-1', window.location.href);
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
  const NAV_TO_SECTION = Object.freeze({
    media: 'media',
    lyrics: 'lyric-sync',
    effects: 'lyric-effects',
    'background-effects': 'background',
    visualiser: 'visualisers',
    export: 'export'
  });

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
      slotName,
      slot: root.querySelector('.kefe-slot[data-kefe-slot="' + slotName + '"]'),
      panel: editing.querySelector('.kefe-panel[data-panel-view="' + panelView + '"]')
    }));
    if (placements.some(item => !item.slot || !item.panel)) {
      throw new Error('Settings panel integration requires all six existing editor panels and slots.');
    }

    const inputGroup = root.querySelector('.kefe-panel[data-group="input"]');
    const outputGroup = root.querySelector('.kefe-panel[data-group="output"]');
    const topbar = root.querySelector('.kefe-topbar');
    if (!inputGroup || !outputGroup || !topbar) {
      throw new Error('Settings panel input/output groups are unavailable.');
    }
    inputGroup.append(topbar);
    inputGroup.setAttribute('role', 'region');
    inputGroup.setAttribute('aria-label', 'KEFE settings');
    outputGroup.setAttribute('role', 'region');
    outputGroup.setAttribute('aria-label', 'Visual and output settings');

    root.querySelectorAll('[data-setting]').forEach(control => {
      if (PANEL_TO_LEGACY[control.dataset.setting]) return;
      control.closest('.setting-row')?.remove();
    });

    const host = document.createElement('section');
    host.className = 'kefe-settings-mount';
    host.setAttribute('aria-label', 'KEFE editor settings');
    host.appendChild(root);
    editing.classList.add('kefe-settings-layout');
    editing.appendChild(host);

    placements.forEach(({ slot, panel }) => {
      panel.classList.add('kefe-settings-embedded-panel', 'active');
      panel.classList.remove('beui-accordion-collapsed', 'kefe-pane-shown', 'beui-accordion-enter');
      panel.style.removeProperty('height');
      panel.style.removeProperty('overflow');
      slot.appendChild(panel);
    });

    editing.querySelectorAll('.kefe-tabs, .kefe-panels').forEach(element => {
      if (root.contains(element)) return;
      element.hidden = true;
      element.setAttribute('aria-hidden', 'true');
    });

    const panel = new window.KefeSettingsPanel(root, {
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
    {
      // Stacked layouts open one section (Media); side-by-side columns open one per column.
      const [a, b] = Array.from(root.querySelectorAll('.kefe-panel[data-group]'));
      const stacked = !a || !b || Math.abs(a.getBoundingClientRect().top - b.getBoundingClientRect().top) >= 8;
      if (stacked) root.querySelectorAll('.section[data-section-id]').forEach(item => {
        item.dataset.expanded = String(item.dataset.sectionId === 'media');
      });
    }
    root.querySelectorAll('.section[data-section-id]').forEach(section => {
      section.querySelector('.expand-button')?.setAttribute(
        'aria-expanded',
        String(section.dataset.expanded === 'true')
      );
    });

    panel.onChange(({ key, value }) => {
      const legacyKey = PANEL_TO_LEGACY[key];
      if (!legacyKey || writingToLegacy) return;
      writingToLegacy = true;
      try {
        api.set(legacyKey, value);
      } finally {
        writingToLegacy = false;
      }
    });

    panel.onReset(() => {
      writingToLegacy = true;
      try {
        api.reset();
        applyLegacyValues();
      } finally {
        writingToLegacy = false;
      }
    });

    api.onChange(legacyKey => {
      if (writingToLegacy) return;
      const panelKey = LEGACY_TO_PANEL[legacyKey];
      if (panelKey) applyLegacyValues();
    });

    root.addEventListener('click', event => {
      const trigger = event.target instanceof Element
        ? event.target.closest('.section[data-section-id] .expand-button')
        : null;
      const section = trigger?.closest('.section[data-section-id]');
      if (!section) return;
      const sectionId = section.dataset.sectionId;
      const navKey = Object.keys(NAV_TO_SECTION).find(key => NAV_TO_SECTION[key] === sectionId);
      if (!navKey) return;
      queueMicrotask(() => {
        const expanded = section.dataset.expanded === 'true';
        const showVisualiserControls = expanded && sectionId === 'visualisers';
        editing.setAttribute('data-active-panel', navKey);
        editing.setAttribute('data-selected-section', navKey);
        editing.querySelectorAll('.kefe-vis-tabs, .kefe-visualiser-preset-row').forEach(element => {
          element.hidden = !showVisualiserControls;
        });
      });
    });

    document.addEventListener('click', event => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-top-panel="settings"]')) {
        root.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      const button = target.closest('[data-shell-panel], [data-dock-panel], .kefe-section');
      if (!button) return;
      const key = button.dataset.shellPanel || button.dataset.dockPanel || button.dataset.panel;
      const sectionId = NAV_TO_SECTION[key];
      if (!sectionId) return;
      const editingRoot = editing;
      editingRoot.setAttribute('data-active-panel', key);
      editingRoot.setAttribute('data-selected-section', key);
      const showVisualiserControls = sectionId === 'visualisers';
      editingRoot.querySelectorAll('.kefe-vis-tabs, .kefe-visualiser-preset-row').forEach(element => {
        element.hidden = !showVisualiserControls;
      });
      const section = root.querySelector('.section[data-section-id="' + sectionId + '"]');
      if (!section) return;
      // Side-by-side columns each keep their own open section; stacked layouts show one at a time.
      const groups = Array.from(root.querySelectorAll('.kefe-panel[data-group]'));
      const sideBySide = groups.length > 1 &&
        Math.abs(groups[0].getBoundingClientRect().top - groups[1].getBoundingClientRect().top) < 8;
      const group = section.closest('.kefe-panel[data-group]');
      root.querySelectorAll('.section').forEach(item => {
        if (sideBySide && item.closest('.kefe-panel[data-group]') !== group) return;
        const expanded = item === section;
        item.dataset.expanded = String(expanded);
        item.querySelector('.expand-button')?.setAttribute('aria-expanded', String(expanded));
      });
      if (!sideBySide) {
        setTimeout(() => section.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
      }
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

  function startWhenReady() {
    const requiredViews = ['media', 'lyrics', 'background-effects', 'effects', 'visualiser', 'export'];
    const editorReady = !!document.querySelector('.kefe-editing') &&
      requiredViews.every(view => document.querySelector('.kefe-panel[data-panel-view="' + view + '"]'));
    if (editorReady && window.KefeSettingsPanel && window.kefeSettings) {
      start();
      return;
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startWhenReady, { once: true });
    } else if (document.readyState !== 'complete') {
      window.addEventListener('load', startWhenReady, { once: true });
    } else {
      start();
    }
  }

  startWhenReady();
})();
