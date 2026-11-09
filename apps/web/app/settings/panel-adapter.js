import { mountWorkspaceTabs } from '../../beui-src/shadcn-workspace-tabs.js';

(() => {
  'use strict';

  const MARKUP_URL = new URL('./app/settings/panel.html?v=subtabs-20261107-1', document.baseURI);
  const SLOT_TO_PANEL = Object.freeze({
    media: 'media',
    'lyric-sync': 'lyrics',
    background: 'background-effects',
    'lyric-effects': 'effects',
    visualisers: 'visualiser',
    export: 'export'
  });
  const PANEL_TO_LEGACY = Object.freeze({});
  const LEGACY_TO_PANEL = Object.freeze({});

  async function mount() {
    if (document.getElementById('kefe-settings-panel')) return;
    const editing = document.querySelector('.kefe-editing');
    if (!editing) throw new Error('KEFE editor panel container is unavailable.');

    const response = await fetch(MARKUP_URL, { credentials: 'same-origin' });
    if (!response.ok) throw new Error('Settings panel markup request failed: ' + response.status);
    const template = document.createElement('template');
    template.innerHTML = await response.text();
    const root = template.content.querySelector('#kefe-settings-panel');
    let settingsFooter = root.querySelector('.kefe-reset-footer');
    if (!settingsFooter) {
      settingsFooter = document.createElement('div');
      settingsFooter.className = 'kefe-reset-footer';
      root.appendChild(settingsFooter);
    }
    if (!settingsFooter.querySelector('.kefe-settings-github')) {
      const githubLink = document.createElement('a');
      githubLink.className = 'kefe-settings-github';
      githubLink.href = 'https://github.com/Tezzaaaaaa/Kefe';
      githubLink.target = '_blank';
      githubLink.rel = 'noopener noreferrer';
      githubLink.setAttribute('aria-label', 'KEFE on GitHub');
      const githubIcon = document.createElement('span');
      githubIcon.setAttribute('data-kefe-icon', 'github');
      githubIcon.setAttribute('data-icon-size', '16');
      githubIcon.setAttribute('aria-hidden', 'true');
      const githubLabel = document.createElement('span');
      githubLabel.textContent = 'GitHub';
      githubLink.append(githubIcon, githubLabel);
      settingsFooter.insertBefore(githubLink, settingsFooter.firstChild);
      window.kefeHydrateIcons?.(githubLink);
    }

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
    const templateTabs = Array.from(root.querySelectorAll('[role="tab"][data-workspace-tab]'));
    const workspaces = Array.from(root.querySelectorAll('.kefe-workspace[data-group]'));
    if (!tablist || templateTabs.length !== 3 || workspaces.length !== 3) {
      throw new Error('All three persistent workspace tabs and panels are required.');
    }
    const workspaceItems = templateTabs.map(tab => ({
      value: tab.dataset.workspaceTab, id: tab.id, label: tab.textContent,
      className: 'kefe-workspace-tab', controls: tab.getAttribute('aria-controls'),
      dataset: { 'data-workspace-tab': tab.dataset.workspaceTab },
    }));
    const initialWorkspace = templateTabs.find(tab => tab.getAttribute('aria-selected') === 'true')?.dataset.workspaceTab || workspaceItems[0].value;
    const tabsMount = document.createElement('div');
    tabsMount.className = 'kefe-workspace-tabs-mount';
    tablist.replaceWith(tabsMount);
    const workspaceTabs = mountWorkspaceTabs(tabsMount, {
      items: workspaceItems, value: initialWorkspace, listClass: 'kefe-workspace-tabs',
      label: 'Editor workspace', dataset: { 'data-workspace-tablist': '' },
      onValueChange: name => activateWorkspace(name, false),
    });
    function activateWorkspace(name, moveFocus) {
      const selected = workspaceItems.find(item => item.value === name);
      if (!selected) return;
      workspaceTabs.setValue(name);
      workspaces.forEach(workspace => {
        const active = workspace.dataset.group === name;
        workspace.hidden = !active;
        workspace.setAttribute('aria-hidden', String(!active));
      });
      root.dataset.activeWorkspace = name;
      if (moveFocus) root.querySelector('#' + selected.id)?.focus();
    }
    /* Subtabs: each workspace lists its features as a second row of tabs and shows one at a time. */
    const SUBTAB_LABELS = Object.freeze({
      media: 'Media', 'lyric-sync': 'Lyric Sync', 'lyric-effects': 'Lyric Effects',
      background: 'Background', visualisers: 'Visualisers', export: 'Export'
    });
    const subtabApis = new Map();
    workspaces.forEach(workspace => {
      const stack = workspace.querySelector('.kefe-workspace-stack');
      const sections = Array.from(workspace.querySelectorAll('.section[data-section-id]'));
      if (!stack || !sections.length) return;
      const items = sections.map(section => {
        const id = section.dataset.sectionId;
        const tabId = 'kefe-subtab-' + id;
        section.id = 'kefe-subpanel-' + id;
        section.setAttribute('role', 'tabpanel');
        section.setAttribute('aria-labelledby', tabId);
        return { id, section, tabId };
      });
      let saved = null;
      try { saved = localStorage.getItem('kefe.subtab.' + workspace.dataset.group); } catch (e) { /* ignore */ }
      const initial = items.find(item => item.id === saved) || items[0];
      const mount = document.createElement('div');
      mount.className = 'kefe-subtabs-mount';
      stack.insertBefore(mount, stack.firstChild);
      const subtabList = mountWorkspaceTabs(mount, {
        items: items.map(item => ({
          value: item.id, id: item.tabId, className: 'kefe-subtab', controls: item.section.id,
          label: SUBTAB_LABELS[item.id] || item.id,
        })),
        value: initial.id, listClass: 'kefe-subtabs', count: sections.length,
        label: (workspace.querySelector('.kefe-workspace-title')?.textContent || 'Workspace') + ' sections',
        onValueChange: id => select(id, false),
      });
      function select(id, moveFocus) {
        const target = items.find(item => item.id === id) || items[0];
        subtabList.setValue(target.id);
        items.forEach(item => { item.section.hidden = item !== target; });
        workspace.dataset.activeSection = target.id;
        try { localStorage.setItem('kefe.subtab.' + workspace.dataset.group, target.id); } catch (e) { /* storage unavailable */ }
        if (moveFocus) workspace.querySelector('#' + target.tabId)?.focus();
      }
      select(initial.id, false);
      subtabApis.set(workspace.dataset.group, select);
    });
    function activateSection(sectionId) {
      for (const workspace of workspaces) {
        if (workspace.querySelector('.section[data-section-id="' + sectionId + '"]')) {
          activateWorkspace(workspace.dataset.group, false);
          subtabApis.get(workspace.dataset.group)?.(sectionId, false);
          return;
        }
      }
    }
    activateWorkspace(initialWorkspace, false);

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
      activateWorkspace,
      activateSection
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