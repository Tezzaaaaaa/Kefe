(() => {
  'use strict';
  const SAVE_KEY = 'kefe.project.autosave.v1', DB_NAME = 'kefe-project-autosave', DB_STORE = 'media';
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  let restoring = false, saveQueued = false, saveTimer = 0, dbPromise, autosaveError = null, context = 'lyric';
  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) { dbPromise = null; return reject(new Error('IndexedDB unavailable')); }
      try {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(DB_STORE)) request.result.createObjectStore(DB_STORE); };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => { dbPromise = null; reject(request.error); };
        request.onblocked = () => { dbPromise = null; reject(new Error('IndexedDB open blocked')); };
      } catch (err) {
        dbPromise = null;
        reject(err);
      }
    });
    return dbPromise;
  }
  async function dbWrite(key, value) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite'); tx.objectStore(DB_STORE).put(value, key);
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
  }
  async function dbRead(key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(key);
      request.onsuccess = () => resolve(request.result || null); request.onerror = () => reject(request.error);
    });
  }
  async function dbDelete(key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite'); tx.objectStore(DB_STORE).delete(key);
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
  }
  async function resetWorkspace() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = 0; }
    saveQueued = false;
    restoring = true;
    localStorage.removeItem(SAVE_KEY);
    if (dbPromise) {
      try { (await dbPromise).close(); } catch (_) {}
      dbPromise = null;
    }
    await new Promise(resolve => {
      let settled = false;
      const done = () => { if (!settled) { settled = true; clearTimeout(timer); resolve(); } };
      const timer = setTimeout(done, 1500);
      try {
        const request = indexedDB.deleteDatabase(DB_NAME);
        request.onsuccess = request.onerror = request.onblocked = done;
      } catch (_) { done(); }
    });
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter(key => key.startsWith('kefe-')).map(key => caches.delete(key)));
    }
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.filter(registration => {
        try { return new URL(registration.scope).pathname.startsWith(new URL('./', location.href).pathname); }
        catch (_) { return false; }
      }).map(registration => registration.unregister()));
    }
    location.replace(location.pathname + '?kefe-reset=' + Date.now());
  }
  function status(text, saved) {
    const launch = $('#kftStrip .kft-launch') || $('#kefeFloatingToolbar .kft-launch');
    if (launch) { launch.title = 'Editor toolbar · ' + text; launch.dataset.saveState = saved ? 'saved' : 'saving'; launch.setAttribute('aria-label', 'Editor toolbar. ' + text); }
    const saveButton = $('#kefeSaveButton');
    if (saveButton) {
      saveButton.dataset.saveState = saved ? 'saved' : 'saving';
      saveButton.title = saved ? 'Saved on this device' : text;
    }
    window.dispatchEvent(new CustomEvent('kefe-autosave-status', { detail: { text, saved: !!saved } }));
  }
  function projectFields(legacy = false) {
    return $$('input:not([type="password"]), select, textarea').filter(el =>
      !el.closest('#kefeFloatingToolbar, .kft-popover') &&
      (legacy || !el.closest('#kefeTimingEditor .kefe-line-list')));
  }
  function clearTimingRowKeys() {
    $$('#kefeTimingEditor .kefe-line-list [data-kefe-autosave-key]').forEach(el => delete el.dataset.kefeAutosaveKey);
  }
  function controlSnapshot() {
    // Legacy restores may have assigned keys to temporary rows. Don't let a
    // stale key shadow an unrelated control in a new-format snapshot.
    clearTimingRowKeys();
    const values = {};
    const fields = projectFields().filter(el => el.type !== 'file');
    fields.forEach((el, index) => {
      if (!el.id && !el.name) el.dataset.kefeAutosaveKey = 'field-' + index;
      const key = el.id ? '#' + el.id : (el.name ? '[name="' + CSS.escape(el.name) + '"]' : '[data-kefe-autosave-key="' + CSS.escape(el.dataset.kefeAutosaveKey) + '"]');
      values[key] = el.type === 'checkbox' || el.type === 'radio' ? { checked: !!el.checked, value: el.value } : { value: el.value };
    });
    const effect = $('[data-effect].active', $('#lyricEffectOptions') || document);
    // Gallery cards also carry data-visualiser, but the engine buttons own
    // selection and power. Prefer the backing tab when the gallery is mounted.
    const visualiser = $('.shad-vis-backing-controls [role="tab"][aria-selected="true"], .shad-vis-backing-controls button.primary') ||
      $('.kefe-vis-tabs [role="tab"][aria-selected="true"], .kefe-vis-tabs button.primary');
    const visualiserOption = visualiser?.closest('.kefe-vis-option');
    const visualiserPower = visualiserOption?.querySelector('button[role="switch"]');
    const visualiserPreset = $$('.kefe-visualiser-preset-set:not([hidden]) button[aria-pressed="true"], .kefe-visualiser-preset-set:not([hidden]) button.primary')
      .find(button => !button.closest('[data-shadcn-backing]'));
    const background = $('#kefeBackgroundEffectOptions [data-background-mode].active, #kefeBackgroundEffectOptions [data-background-mode][aria-pressed="true"]');
    const backgroundToggle = $('#kefeBackgroundEffectToggle');
    const lyricsToggle = $('#lyricsEnabledToggle');
    const presetKey = visualiserPreset?.dataset.preset || visualiserPreset?.dataset.scene || visualiserPreset?.dataset.value || visualiserPreset?.textContent.trim() || '';
    const activeVisualiserView = $('.kefe-visualiser-form .kefe-vis-view:not([hidden])');
    const visualiserChoices = activeVisualiserView
      ? $$('button[aria-pressed]', activeVisualiserView)
        .filter(button => !button.closest('[data-shadcn-backing]'))
        .reduce((selected, button, index) => {
          if (button.getAttribute('aria-pressed') === 'true') selected.push(index);
          return selected;
        }, [])
      : [];
    return { version: 2, savedAt: Date.now(), values, selections: { lyricEffect: effect?.dataset.effect || '', lyricsEnabled: lyricsToggle?.getAttribute('aria-checked') !== 'false', visualiser: visualiser?.dataset.visualiser || '', visualiserPreset: presetKey, visualiserChoices, visualiserPower: visualiserPower?.getAttribute('aria-checked') === 'true', background: background?.dataset.backgroundMode || '', backgroundEnabled: backgroundToggle?.getAttribute('aria-checked') === 'true', toolbarContext: contextButton?.dataset.settingsContext || context } };
  }
  async function saveProject() {
    if (restoring) return;
    status('Saving project…', false);
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(controlSnapshot()));
      status('All changes saved on this device', true);
    } catch (error) { autosaveError = error?.message || String(error); status('Autosave storage is full or unavailable', false); console.warn('[KEFE autosave]', error); }
  }
  function queueSave() {
    if (restoring) return;
    status('Changes pending…', false);
    if (saveTimer) clearTimeout(saveTimer);
    saveQueued = true;
    saveTimer = window.setTimeout(() => {
      saveTimer = 0;
      saveQueued = false;
      void saveProject();
    }, 350);
  }
  function setControlValue(el, data) {
    if (!el || !data || el.closest('#kefeTimingEditor .kefe-line-list')) return;
    if (el.type === 'checkbox' || el.type === 'radio') { el.checked = !!data.checked; if (data.value != null) el.value = data.value; }
    else if (data.value != null) {
      if (el.tagName === 'SELECT' && !Array.from(el.options).some(option => option.value === data.value)) return;
      el.value = data.value;
    }
    el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  async function restoreFiles() {
    for (const input of $$('input[type="file"]')) {
      if (!input.id) continue;
      try {
        const file = await dbRead(input.id); if (!file) continue;
        const transfer = new DataTransfer();
        transfer.items.add(new File([file], file.name || input.id, { type: file.type || 'application/octet-stream', lastModified: file.lastModified || Date.now() }));
        input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (error) { console.warn('[KEFE autosave media restore]', input.id, error); }
    }
  }
  async function restoreProject() {
    if (restoring) return;
    let snapshot;
    try { snapshot = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (_) { return; }
    if (!snapshot || ![1, 2].includes(snapshot.version)) return;
    restoring = true;
    status('Restoring saved project…', false);
    try {
      const restoreValues = () => {
        if (snapshot.version === 2) clearTimingRowKeys();
        // Version 1 counted temporary timing rows in its anonymous field keys.
        // Preserve those indices for old projects; new saves omit those rows.
        projectFields(snapshot.version === 1).filter(el => el.type !== 'file').forEach((el, index) => {
          if (!el.id && !el.name) el.dataset.kefeAutosaveKey = 'field-' + index;
        });
        Object.entries(snapshot.values || {}).forEach(([selector, data]) => { try { setControlValue($(selector), data); } catch (_) {} });
      };
      restoreValues();
      await restoreFiles();
      const selected = snapshot.selections || {};
      if (typeof selected.lyricsEnabled === 'boolean') {
        const toggle = $('#lyricsEnabledToggle');
        if (toggle && (toggle.getAttribute('aria-checked') !== 'false') !== selected.lyricsEnabled) toggle.click();
      }
      if (selected.lyricEffect) $('#lyricEffectOptions [data-effect="' + CSS.escape(selected.lyricEffect) + '"]')?.click();
      if (selected.visualiser) {
        const selector = 'button[role="tab"][data-visualiser="' + CSS.escape(selected.visualiser) + '"]';
        ($('.shad-vis-backing-controls ' + selector) || $('.kefe-vis-tabs ' + selector))?.click();
      }
      if (selected.background) $('#kefeBackgroundEffectOptions [data-background-mode="' + CSS.escape(selected.background) + '"]')?.click();
      if (typeof selected.backgroundEnabled === 'boolean') {
        const toggle = $('#kefeBackgroundEffectToggle');
        if (toggle && (toggle.getAttribute('aria-checked') === 'true') !== selected.backgroundEnabled) toggle.click();
      }
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (selected.visualiserPreset) {
        const preset = $$('.kefe-visualiser-preset-set:not([hidden]) button')
          .filter(button => !button.closest('[data-shadcn-backing]'))
          .find(button =>
            (button.dataset.preset || button.dataset.scene || button.dataset.value || button.textContent.trim()) === selected.visualiserPreset);
        preset?.click();
      }
      if (Array.isArray(selected.visualiserChoices)) {
        const activeView = $('.kefe-visualiser-form .kefe-vis-view:not([hidden])');
        const choices = activeView ? $$('button[aria-pressed]', activeView).filter(button => !button.closest('[data-shadcn-backing]')) : [];
        selected.visualiserChoices.forEach(index => {
          const button = choices[index];
          if (button && button.getAttribute('aria-pressed') !== 'true') button.click();
        });
      }
      if (typeof selected.visualiserPower === 'boolean' && selected.visualiser) {
        const selector = 'button[role="tab"][data-visualiser="' + CSS.escape(selected.visualiser) + '"]';
        const visualiserTab = $('.shad-vis-backing-controls ' + selector) || $('.kefe-vis-tabs ' + selector);
        const power = visualiserTab?.closest('.kefe-vis-option')?.querySelector('button[role="switch"]');
        if (power && (power.getAttribute('aria-checked') === 'true') !== selected.visualiserPower) power.click();
      }
      restoreValues();
      if (snapshot.selections?.toolbarContext) setContext(snapshot.selections.toolbarContext);
      document.dispatchEvent(new Event('kefe-project-restored'));
    } finally { restoring = false; status('Project restored · autosave active', true); queueSave(); }
  }

  /* Reuses the editor's live controls as the source of truth; no additional toolbar width is introduced. */
  const contextButton = $('#kefeFloatingToolbar button[aria-label="Lyric effect and text style"]');
  let contextPopover = null, forwardingContextClick = false;
  const config = {
    lyric: { title: 'Lyric effect settings', icon: 'effect', selectors: ['#kefeDisplayGroup', '#kefeStyleGroup', '#fontOverride', '#lyricCase'] },
    visualiser: { title: 'Visualiser settings', icon: 'audio-waveform', selectors: ['.kefe-visualiser-form', '#kefeVisualiserPresetRow'] },
    background: { title: 'Background effect settings', icon: 'image', selectors: ['#kefeBackgroundEffectToggle', '#kefeBgVideoZone', '#bgVideoInput', '#backgroundTransparency', '#kefeBackgroundEffectOptions', '.kefe-panel[data-panel-view="background-effects"] .kefe-form'] }
  };
  function labelFor(el) {
    if (el.type === 'file') return el.closest('label')?.querySelector('.kefe-upload-title')?.textContent.trim() || 'Upload background media';
    const label = el.labels && el.labels[0];
    if (label?.textContent.trim()) return label.textContent.trim().replace(/\s+/g, ' ');
    const field = el.closest('.kefe-visualiser-field, .kefe-background-effect-control, .kefe-font-selector-control, .kefe-step');
    const heading = field?.querySelector('label, b, strong, .kefe-label');
    return heading?.textContent.trim().replace(/\s+/g, ' ') || el.getAttribute('aria-label') || el.id || 'Setting';
  }
  function hasHiddenFeatureAncestor(el) {
    let node = el;
    while (node && node !== document.body) {
      // A shadcn bridge hides only the canonical control from the accessibility
      // tree. It is still the source for toolbar proxies; hidden *ancestors*
      // must continue to suppress controls from inactive feature panels.
      const bridgedSource = node === el && node.matches('.shad-native-range, .kefe-dd-native, .kefe-shad-checkbox-native, .kefe-shad-switch-native');
      if ((node.hidden || (node.getAttribute('aria-hidden') === 'true' && !bridgedSource))
        && !node.matches('.kefe-panel[data-panel-view], .kefe-workspace, .kefe-workspace-stack')) return true;
      node = node.parentElement;
    }
    return false;
  }
  function sourceControls() {
    const roots = config[context].selectors.flatMap(selector => $$(selector)), seen = new Set();
    return roots.flatMap(root => {
      const controls = root.matches?.('input,select,textarea,button[role="switch"]') ? [root]
        : $$('input:not([type="hidden"]),select,textarea,button[role="switch"],.kefe-vis-view:not([hidden]) button', root);
      if (root.id === 'kefeVisualiserPresetRow') controls.push(...$$('button', root));
      return controls;
    }).filter(el => {
      // Do not clone a rendered bridge in addition to its original control.
      if (seen.has(el) || el.disabled || el.closest('.shad-slider-host, .kefe-checkbox-host, .kefe-switch-host') || hasHiddenFeatureAncestor(el) || (['submit','button','hidden'].includes(el.type) && !el.matches('button'))) return false;
      seen.add(el); return true;
    });
  }
  function closeContext() { if (!contextPopover) return; contextPopover.remove(); contextPopover = null; contextButton?.setAttribute('aria-expanded', 'false'); }
  function positionContext(pop) {
    const rect = contextButton.getBoundingClientRect();
    const toolbar = contextButton.closest('#kefeFloatingToolbar');
    const toolbarWidth = toolbar?.querySelector('.kft-bar')?.getBoundingClientRect().width || toolbar?.getBoundingClientRect().width || 340;
    const width = Math.min(window.innerWidth <= 640 ? toolbarWidth : 340, window.innerWidth - 16);
    const belowTop = rect.bottom + 8, belowSpace = window.innerHeight - belowTop - 8, aboveSpace = rect.top - 16;
    pop.style.width = width + 'px';
    pop.style.left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.left + rect.width / 2 - width / 2)) + 'px';
    if (belowSpace >= 180 || belowSpace >= aboveSpace) {
      pop.style.top = belowTop + 'px'; pop.style.bottom = 'auto';
      pop.style.maxHeight = Math.max(120, Math.min(440, belowSpace)) + 'px';
    } else {
      pop.style.top = 'auto'; pop.style.bottom = Math.max(8, window.innerHeight - rect.top + 8) + 'px';
      pop.style.maxHeight = Math.max(120, Math.min(440, aboveSpace)) + 'px';
    }
  }
  function renderContext() {
    if (!contextButton) return;
    const selected = config[context];
    contextButton.dataset.settingsContext = context;
    const iconHost = document.createElement('span');
    iconHost.setAttribute('data-kefe-icon', selected.icon);
    iconHost.setAttribute('data-icon-class', 'kft-icon');
    iconHost.setAttribute('data-icon-size', '16');
    contextButton.replaceChildren(iconHost);
    if (window.kefeHydrateIcons) window.kefeHydrateIcons(contextButton);
    const title = contextTitle();
    contextButton.setAttribute('aria-label', 'Lyric effect and text style');
    contextButton.setAttribute('aria-description', title);
    contextButton.title = title;
    if (!contextPopover) return;
    contextPopover.replaceChildren();
    const heading = document.createElement('div'); heading.className = 'kft-label'; heading.textContent = contextTitle(); contextPopover.appendChild(heading);
    const controls = sourceControls();
    if (!controls.length) { const empty = document.createElement('p'); empty.className = 'kft-hint'; empty.textContent = 'No adjustable settings are available for this selection yet.'; contextPopover.appendChild(empty); return; }
    controls.forEach(source => {
      const row = document.createElement('div'); row.className = 'kft-context-field';
      const title = document.createElement('span'); title.textContent = labelFor(source);
      const proxy = source.cloneNode(true); proxy.removeAttribute('id'); proxy.removeAttribute('name'); proxy.removeAttribute('form');
      // Clones must be visible and focusable, not inherit the backing control's
      // off-screen bridge markers. Range bridges can then enhance them normally.
      if (source.matches('.shad-native-range, .kefe-dd-native, .kefe-shad-checkbox-native, .kefe-shad-switch-native')) {
        proxy.classList.remove('shad-native-range', 'kefe-dd-native', 'kefe-shad-checkbox-native', 'kefe-shad-switch-native');
        proxy.removeAttribute('aria-hidden'); proxy.removeAttribute('tabindex'); proxy.removeAttribute('data-shad-slider-mounted');
      }
      if (!proxy.hasAttribute('aria-label') && !proxy.hasAttribute('aria-labelledby')) proxy.setAttribute('aria-label', title.textContent);
      proxy.disabled = source.disabled;
      if (source.type === 'file') {
        proxy.classList.remove('kefe-file'); proxy.value = '';
        proxy.addEventListener('change', () => {
          try {
            const transfer = new DataTransfer();
            Array.from(proxy.files || []).forEach(file => transfer.items.add(file));
            source.files = transfer.files;
            source.dispatchEvent(new Event('change', { bubbles: true }));
          } catch (_) { status('Use the Background panel to upload this file', false); }
        });
      } else if (source.matches('button')) {
        proxy.addEventListener('click', () => {
          // The source button is outside the popover. Forwarding its click
          // must not be mistaken for an outside click and remove the proxy
          // while its own activation is still in progress.
          forwardingContextClick = true;
          try { source.click(); } finally { forwardingContextClick = false; }
          queueSave();
          requestAnimationFrame(() => {
            ['aria-checked', 'aria-pressed'].forEach(name => {
              const value = source.getAttribute(name);
              if (value == null) proxy.removeAttribute(name); else proxy.setAttribute(name, value);
            });
            proxy.classList.toggle('is-on', source.classList.contains('is-on'));
            proxy.classList.toggle('active', source.classList.contains('active'));
          });
        });
      } else {
        if (source.type === 'checkbox' || source.type === 'radio') proxy.checked = source.checked; else proxy.value = source.value;
        const syncSource = type => {
          if (source.type === 'checkbox' || source.type === 'radio') source.checked = proxy.checked; else source.value = proxy.value;
          source.dispatchEvent(new Event(type, { bubbles: true }));
        };
        proxy.addEventListener('input', () => syncSource('input'));
        proxy.addEventListener('change', () => syncSource('change'));
      }
      row.append(title, proxy); contextPopover.appendChild(row);
    });
  }
  function openContext() {
    if (contextPopover) { closeContext(); return; }
    window.dispatchEvent(new Event('kefe-toolbar-close-popovers'));
    contextPopover = document.createElement('div'); contextPopover.className = 'kft-popover kft-panel kft-context-popover';
    contextPopover.setAttribute('role', 'dialog');
    contextPopover.setAttribute('aria-label', context === 'lyric' ? 'Lyric effect and text style' : config[context].title);
    document.body.appendChild(contextPopover); renderContext(); positionContext(contextPopover);
    contextButton.setAttribute('aria-expanded', 'true');
  }
  function selectedFeatureName() {
    let selected;
    if (context === 'lyric') selected = $('#lyricEffectOptions [data-effect].active, #lyricEffectOptions [data-effect][aria-pressed="true"]');
    else if (context === 'visualiser') selected = $('.kefe-vis-tabs [role="tab"][aria-selected="true"], .kefe-vis-tabs [data-visualiser].active, .kefe-vis-tabs [data-visualiser][aria-pressed="true"], .kefe-vis-tabs button.primary');
    else selected = $('#kefeBackgroundEffectOptions [data-background-mode].active, #kefeBackgroundEffectOptions [data-background-mode][aria-pressed="true"]');
    const label = selected?.querySelector('.kefe-lyric-effect-name, .kefe-background-effect-name, .kefe-vis-tab-label')?.textContent || selected?.getAttribute('aria-label') || selected?.textContent || '';
    return label.trim().replace(/\s+/g, ' ').slice(0, 48);
  }
  function contextTitle() { const name = selectedFeatureName(); return name ? name + ' settings' : config[context].title; }
  function setContext(next, keepToolbarPanel = false) {
    if (!config[next]) return;
    const changed = context !== next;
    context = next;
    if (changed) {
      closeContext();
      if (!keepToolbarPanel) window.dispatchEvent(new Event('kefe-toolbar-close-popovers'));
    }
    // Forwarded proxy events also select their current context. Rebuilding the
    // open popover here would discard focus and interrupt keyboard/drag input.
    if (changed || !contextPopover) renderContext();
    if (changed) queueSave();
  }
  if (contextButton) {
    contextButton.addEventListener('click', event => {
      if (context === 'lyric') return;
      event.preventDefault(); event.stopImmediatePropagation(); openContext();
    }, true);
    document.addEventListener('click', event => { if (!forwardingContextClick && contextPopover && !contextPopover.contains(event.target) && !contextButton.contains(event.target)) closeContext(); }, true);
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && contextPopover) { closeContext(); contextButton.focus({ preventScroll: true }); } });
    window.addEventListener('resize', closeContext);
    // Only preserve the toolbar for events explicitly forwarded by one of its
    // controls, not unrelated updates while a toolbar control happens to have focus.
    const editingToolbarPanel = () => window.kefeToolbarForwarding === true;
    function contextForControl(target) {
      if (!target || !(target instanceof Element)) return '';
      if (target.id === 'lyricsEnabledToggle' || target.matches('#fontOverride, #lyricCase') || target.closest('#lyricEffectOptions, #kefeDisplayGroup, #kefeStyleGroup, .kefe-font-selector-control')) return 'lyric';
      if (target.closest('.kefe-vis-tabs, .kefe-visualiser-form, #kefeVisualiserPresetRow')) return 'visualiser';
      if (target.id === 'kefeBackgroundEffectToggle' || target.matches('.kefe-background-effect-card, [data-background-mode]') || target.closest('#kefeBackgroundEffectOptions, [data-panel-view="background-effects"] .kefe-form')) return 'background';
      return '';
    }
    document.addEventListener('click', event => {
      if (restoring) return;
      const target = event.target.closest?.('button, [data-effect], [data-background-mode]');
      if (!target) return;
      const next = contextForControl(target);
      if (next) {
        const keepToolbarPanel = editingToolbarPanel();
        queueMicrotask(() => setContext(next, keepToolbarPanel));
        if (target.id === 'bgVideoRemove') {
          const input = $('#bgVideoInput');
          if (input?.id) dbDelete(input.id).then(queueSave).catch(error => {
            console.warn('[KEFE autosave media]', error);
            status('Removed media could not be cleared from autosave', false);
          });
        }
        queueSave();
      }
    }, true);
    ['input', 'change'].forEach(type => document.addEventListener(type, event => {
      if (restoring) return;
      const next = contextForControl(event.target);
      if (next) setContext(next, editingToolbarPanel());
    }, true));
    window.addEventListener('kefe-toolbar-change', event => {
      if (restoring) return;
      const action = event.detail?.action;
      const keepToolbarPanel = event.detail?.source === 'editor-toolbar' && editingToolbarPanel();
      if (action === 'effect' || ['lyric-mode', 'font', 'text-case', 'text-size', 'text-colour', 'outline', 'glow', 'lyrics'].includes(action)) setContext('lyric', keepToolbarPanel);
      else if (action === 'visualiser') setContext('visualiser', keepToolbarPanel);
      else if (action === 'background' || action === 'background-darkness') setContext('background', keepToolbarPanel);
      if (!['ready', 'position'].includes(action)) queueSave();
    });
  const form = $('.kefe-visualiser-form');
    if (form) new MutationObserver(() => { if (context === 'visualiser' && contextPopover && !contextPopover.contains(document.activeElement)) renderContext(); })
      .observe(form, { childList: true, subtree: true, attributes: true, attributeFilter: ['value','checked','disabled','hidden','aria-hidden','class','style'] });
    const backgroundForm = $('[data-panel-view="background-effects"] .kefe-form');
    if (backgroundForm) new MutationObserver(() => { if (context === 'background' && contextPopover && !contextPopover.contains(document.activeElement)) renderContext(); })
      .observe(backgroundForm, { childList: true, subtree: true, attributes: true, attributeFilter: ['value','checked','disabled','aria-checked','hidden','aria-hidden','class','style'] });
    renderContext();
    if (!window.kefeIcon) window.addEventListener('load', () => renderContext(), { once: true });
  }
  const css = document.createElement('style');
  css.textContent = '.kft-context-popover{position:fixed;z-index:10005;display:grid;gap:9px;overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;padding:12px}.kft-context-field{display:grid;grid-template-columns:minmax(0,1fr) minmax(110px,1.15fr);align-items:center;gap:10px;min-width:0;color:var(--kt-text);font-size:11px}.kft-context-field>span{min-width:0;overflow-wrap:anywhere;color:var(--kt-muted)}.kft-context-field>:is(input,select,textarea,button){box-sizing:border-box;width:100%;min-width:0;max-width:100%}.kft-context-field input[type=file]{display:block;min-height:30px;font-size:11px}.kft-context-field input[type=range]{accent-color:var(--kt-accent)}.kft-context-field input[type=checkbox]{justify-self:end;width:18px;height:18px}.kft-context-field input[type=color]{height:30px;padding:2px}.kft-context-field select,.kft-context-field input:not([type=checkbox]):not([type=range]):not([type=color]):not([type=file]),.kft-context-field textarea,.kft-context-field button{min-height:30px;padding:5px 7px;border:1px solid var(--kt-border);border-radius:5px;background:var(--kt-input);color:var(--kt-text)}#kefeFloatingToolbar .kft-launch{position:relative}#kefeFloatingToolbar .kft-launch[data-save-state]::after{content:"";position:absolute;right:3px;top:3px;width:5px;height:5px;border-radius:50%;background:#36b37e;box-shadow:0 0 0 2px var(--kt-surface)}#kefeFloatingToolbar .kft-launch[data-save-state=saving]::after{background:#d6a23a}@media(max-width:640px){.kft-context-popover{max-width:calc(100vw - 16px)!important;max-height:min(54vh,380px)!important}.kft-context-field{grid-template-columns:minmax(0,1fr) minmax(100px,1fr)}}';
  document.head.appendChild(css);

  let observedInputEvents = 0;
  let resolveAutosaveReady;
  const autosaveReady = new Promise(resolve => { resolveAutosaveReady = resolve; });
  window.kefeProjectAutosave = Object.freeze({
    saveNow: saveProject,
    resetWorkspace,
    queueSave,
    setToolbarContext: setContext,
    restore: restoreProject,
    ready: autosaveReady,
    state: () => {
      const title = document.querySelector('#songTitle');
      const launcher = document.querySelector('#kefeFloatingToolbar .kft-launch');
      return { restoring, hasSnapshot: !!localStorage.getItem(SAVE_KEY), songTitleBound: !!title && boundControls.has(title), observedInputEvents, saveState: launcher?.dataset.saveState || '', launcherTitle: launcher?.title || '', error: autosaveError };
    }
  });
  document.addEventListener('click', async event => {
    const saveButton = event.target.closest?.('#kefeSaveButton');
    if (saveButton) {
      event.preventDefault();
      if (saveTimer) { clearTimeout(saveTimer); saveTimer = 0; }
      saveQueued = false;
      await saveProject();
      return;
    }
    const resetButton = event.target.closest?.('#kefeResetButton');
    if (resetButton) {
      event.preventDefault();
      if (!window.confirm('Reset KEFE? This clears the saved project and media on this device, removes KEFE app caches, and reloads the editor.')) return;
      resetButton.disabled = true;
      resetButton.setAttribute('aria-busy', 'true');
      try { await resetWorkspace(); }
      catch (error) {
        resetButton.disabled = false;
        resetButton.removeAttribute('aria-busy');
        status('Reset failed. Your saved project has been retained.', false);
        console.error('[KEFE reset]', error);
      }
    }
  });
  const boundControls = new WeakSet();
  const fieldSelector = 'input:not([type="password"]), select, textarea';
  function bindControl(input) {
    if (boundControls.has(input) || input.closest('#kefeFloatingToolbar, .kft-popover')) return;
    boundControls.add(input);
    input.addEventListener('input', () => { observedInputEvents++; queueSave(); });
    input.addEventListener('change', () => {
      if (input instanceof HTMLInputElement && input.type === 'file') {
        const file = input.files && input.files[0];
        if (input.id) (file ? dbWrite(input.id, file) : dbDelete(input.id)).then(queueSave).catch(error => {
          console.warn('[KEFE autosave media]', error);
          status('Media could not be saved', false);
        });
        return;
      }
      queueSave();
    });
  }
  function bindControls(root = document) {
    if (root instanceof Element && root.matches(fieldSelector)) bindControl(root);
    if (root.querySelectorAll) root.querySelectorAll(fieldSelector).forEach(bindControl);
  }
  bindControls();
  const controlObserver = new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) bindControls(node);
    }));
  });
  controlObserver.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('click', event => {
    if (event.target.closest?.('[data-effect], .kefe-vis-tabs [role="tab"], .kefe-vis-tabs button, .kefe-background-effect-card, [data-background-mode]')) queueSave();
  }, true);
  window.addEventListener('pagehide', () => { if (!restoring) try { localStorage.setItem(SAVE_KEY, JSON.stringify(controlSnapshot())); } catch (_) {} });
  window.addEventListener('beforeunload', () => { if (!restoring) try { localStorage.setItem(SAVE_KEY, JSON.stringify(controlSnapshot())); } catch (_) {} });
  const boot = () => restoreProject().catch(error => { console.warn('[KEFE autosave restore]', error); status('Autosave restore needs attention', false); }).finally(() => resolveAutosaveReady());
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();