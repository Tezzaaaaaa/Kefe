(() => {
  'use strict';
  const SAVE_KEY = 'kefe.project.autosave.v1', DB_NAME = 'kefe-project-autosave', DB_STORE = 'media';
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  let restoring = false, saveTimer = 0, dbPromise;
  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return reject(new Error('IndexedDB unavailable'));
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(DB_STORE)) request.result.createObjectStore(DB_STORE); };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
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
  function status(text, saved) {
    const launch = $('#kftStrip .kft-launch') || $('#kefeFloatingToolbar .kft-launch');
    if (launch) { launch.title = 'Editor toolbar · ' + text; launch.dataset.saveState = saved ? 'saved' : 'saving'; launch.setAttribute('aria-label', 'Editor toolbar. ' + text); }
    window.dispatchEvent(new CustomEvent('kefe-autosave-status', { detail: { text, saved: !!saved } }));
  }
  function controlSnapshot() {
    const values = {};
    const fields = $('input:not([type="file"]):not([type="password"]), select, textarea');
    fields.forEach((el, index) => {
      if (!el.id && !el.name) el.dataset.kefeAutosaveKey = 'field-' + index;
      const key = el.id ? '#' + el.id : (el.name ? '[name="' + CSS.escape(el.name) + '"]' : '[data-kefe-autosave-key="' + CSS.escape(el.dataset.kefeAutosaveKey) + '"]');
      values[key] = el.type === 'checkbox' || el.type === 'radio' ? { checked: !!el.checked, value: el.value } : { value: el.value };
    });
    const effect = $('[data-effect].active', $('#lyricEffectOptions') || document);
    const visualiser = $('.kefe-vis-tabs [role="tab"][aria-selected="true"], .kefe-vis-tabs button.primary');
    const background = $('#kefeBackgroundEffectOptions [data-background-mode].active, #kefeBackgroundEffectOptions [data-background-mode][aria-pressed="true"]');
    return { version: 1, savedAt: Date.now(), values, selections: { lyricEffect: effect?.dataset.effect || '', visualiser: visualiser?.dataset.visualiser || '', background: background?.dataset.backgroundMode || '' } };
  }
  async function saveProject() {
    if (restoring) return;
    status('Saving project…', false);
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(controlSnapshot()));
      await Promise.all($$('input[type="file"]').map(input => {
        const file = input.files && input.files[0];
        return input.id && file ? dbWrite(input.id, file) : Promise.resolve();
      }));
      status('All changes saved on this device', true);
    } catch (error) { status('Autosave storage is full or unavailable', false); console.warn('[KEFE autosave]', error); }
  }
  function queueSave() {
    if (restoring) return;
    clearTimeout(saveTimer); status('Changes pending…', false); saveTimer = setTimeout(saveProject, 650);
  }
  function setControlValue(el, data) {
    if (!el || !data) return;
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
    let snapshot;
    try { snapshot = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (_) { return; }
    if (!snapshot || snapshot.version !== 1) return;
    restoring = true;
    try {
      const restoreValues = () => {
        $('input:not([type="file"]):not([type="password"]), select, textarea').forEach((el, index) => {
          if (!el.id && !el.name) el.dataset.kefeAutosaveKey = 'field-' + index;
        });
        Object.entries(snapshot.values || {}).forEach(([selector, data]) => { try { setControlValue($(selector), data); } catch (_) {} });
      };
      restoreValues();
      const selected = snapshot.selections || {};
      if (selected.lyricEffect) $('#lyricEffectOptions [data-effect="' + CSS.escape(selected.lyricEffect) + '"]')?.click();
      if (selected.visualiser) $('.kefe-vis-tabs [data-visualiser="' + CSS.escape(selected.visualiser) + '"]')?.click();
      if (selected.background) $('#kefeBackgroundEffectOptions [data-background-mode="' + CSS.escape(selected.background) + '"]')?.click();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      restoreValues();
      await restoreFiles();
      document.dispatchEvent(new Event('kefe-project-restored'));
    } finally { restoring = false; status('Project restored · autosave active', true); queueSave(); }
  }

  /* Reuses the editor's live controls as the source of truth; no additional toolbar width is introduced. */
  const contextButton = $('button[aria-label="Lyric effect and text style"]');
  let context = 'lyric', contextPopover = null;
  const config = {
    lyric: { title: 'Lyric effect settings', icon: 'effect', selectors: ['#kefeDisplayGroup', '#kefeStyleGroup', '#fontOverride', '#lyricCase'] },
    visualiser: { title: 'Visualiser settings', icon: 'audio-waveform', selectors: ['.kefe-visualiser-form', '#kefeVisualiserPresetRow'] },
    background: { title: 'Background effect settings', icon: 'image', selectors: ['#kefeBackgroundEffectOptions', '.kefe-panel[data-panel-view="background-effects"] .kefe-form'] }
  };
  function labelFor(el) {
    const label = el.labels && el.labels[0];
    if (label?.textContent.trim()) return label.textContent.trim().replace(/\s+/g, ' ');
    const field = el.closest('.kefe-visualiser-field, .kefe-background-effect-control, .kefe-font-selector-control, .kefe-step');
    const heading = field?.querySelector('label, b, strong, .kefe-label');
    return heading?.textContent.trim().replace(/\s+/g, ' ') || el.getAttribute('aria-label') || el.id || 'Setting';
  }
  function sourceControls() {
    const roots = config[context].selectors.flatMap(selector => $$(selector)), seen = new Set();
    return roots.flatMap(root => root.matches?.('input,select,textarea') ? [root] : $$('input:not([type="file"]):not([type="hidden"]),select,textarea', root))
      .filter(el => { if (seen.has(el) || el.disabled || ['submit','button','file','hidden'].includes(el.type)) return false; seen.add(el); return true; });
  }
  function closeContext() { if (!contextPopover) return; contextPopover.remove(); contextPopover = null; contextButton?.setAttribute('aria-expanded', 'false'); }
  function positionContext(pop) {
    const rect = contextButton.getBoundingClientRect(), width = Math.min(340, window.innerWidth - 16);
    pop.style.width = width + 'px';
    pop.style.left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.left + rect.width / 2 - width / 2)) + 'px';
    pop.style.top = 'auto'; pop.style.bottom = Math.max(8, window.innerHeight - rect.top + 8) + 'px';
    pop.style.maxHeight = Math.max(140, Math.min(440, rect.top - 16)) + 'px';
  }
  function renderContext() {
    if (!contextButton) return;
    const selected = config[context];
    contextButton.innerHTML = window.kefeIcon ? window.kefeIcon(selected.icon) : '<span data-kefe-icon="' + selected.icon + '" aria-hidden="true"></span>';
    contextButton.setAttribute('aria-label', 'Lyric effect and text style');
    contextButton.setAttribute('aria-description', selected.title);
    contextButton.title = selected.title;
    if (!contextPopover) return;
    contextPopover.replaceChildren();
    const heading = document.createElement('div'); heading.className = 'kft-label'; heading.textContent = selected.title; contextPopover.appendChild(heading);
    const controls = sourceControls();
    if (!controls.length) { const empty = document.createElement('p'); empty.className = 'kft-hint'; empty.textContent = 'No adjustable settings are available for this selection yet.'; contextPopover.appendChild(empty); return; }
    controls.forEach(source => {
      const row = document.createElement('label'); row.className = 'kft-context-field';
      const title = document.createElement('span'); title.textContent = labelFor(source);
      const proxy = source.cloneNode(true); proxy.removeAttribute('id'); proxy.removeAttribute('name'); proxy.removeAttribute('form');
      proxy.disabled = source.disabled;
      if (source.type === 'checkbox' || source.type === 'radio') proxy.checked = source.checked; else proxy.value = source.value;
      const syncSource = type => {
        if (source.type === 'checkbox' || source.type === 'radio') source.checked = proxy.checked; else source.value = proxy.value;
        source.dispatchEvent(new Event(type, { bubbles: true }));
      };
      proxy.addEventListener('input', () => syncSource('input'));
      proxy.addEventListener('change', () => syncSource('change'));
      row.append(title, proxy); contextPopover.appendChild(row);
    });
  }
  function openContext() {
    if (contextPopover) { closeContext(); return; }
    contextPopover = document.createElement('div'); contextPopover.className = 'kft-popover kft-panel kft-context-popover';
    contextPopover.setAttribute('role', 'dialog'); contextPopover.setAttribute('aria-label', config[context].title);
    document.body.appendChild(contextPopover); renderContext(); positionContext(contextPopover);
    contextButton.setAttribute('aria-expanded', 'true');
  }
  function setContext(next) { if (!config[next] || context === next) return; context = next; closeContext(); renderContext(); }
  if (contextButton) {
    contextButton.addEventListener('click', event => { event.preventDefault(); event.stopImmediatePropagation(); openContext(); }, true);
    document.addEventListener('click', event => { if (contextPopover && !contextPopover.contains(event.target) && !contextButton.contains(event.target)) closeContext(); }, true);
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && contextPopover) { closeContext(); contextButton.focus({ preventScroll: true }); } });
    window.addEventListener('resize', closeContext);
    document.addEventListener('click', event => {
      const target = event.target.closest?.('[data-effect], .kefe-vis-tabs [role="tab"], .kefe-vis-tabs button, .kefe-background-effect-card, [data-background-mode]');
      if (!target) return;
      if (target.closest('#lyricEffectOptions')) setContext('lyric');
      else if (target.closest('.kefe-vis-tabs')) setContext('visualiser');
      else if (target.matches('.kefe-background-effect-card, [data-background-mode]')) setContext('background');
    }, true);
    const form = $('.kefe-visualiser-form');
    if (form) new MutationObserver(() => { if (context === 'visualiser' && contextPopover) renderContext(); })
      .observe(form, { childList: true, subtree: true, attributes: true, attributeFilter: ['value','checked','disabled'] });
    renderContext();
  }
  const css = document.createElement('style');
  css.textContent = '.kft-context-popover{position:fixed;z-index:10005;display:grid;gap:9px;overflow:auto;overscroll-behavior:contain;padding:12px}.kft-context-field{display:grid;grid-template-columns:minmax(0,1fr) minmax(110px,1.15fr);align-items:center;gap:10px;min-width:0;color:var(--kt-text);font-size:11px}.kft-context-field>span{min-width:0;overflow-wrap:anywhere;color:var(--kt-muted)}.kft-context-field>:is(input,select,textarea){box-sizing:border-box;width:100%;min-width:0;max-width:100%}.kft-context-field input[type=range]{accent-color:var(--kt-accent)}.kft-context-field input[type=checkbox]{justify-self:end;width:18px;height:18px}.kft-context-field input[type=color]{height:30px;padding:2px}.kft-context-field select,.kft-context-field input:not([type=checkbox]):not([type=range]):not([type=color]),.kft-context-field textarea{min-height:30px;padding:5px 7px;border:1px solid var(--kt-border);border-radius:5px;background:var(--kt-input);color:var(--kt-text)}#kefeFloatingToolbar .kft-launch{position:relative}#kefeFloatingToolbar .kft-launch[data-save-state]::after{content:"";position:absolute;right:3px;top:3px;width:5px;height:5px;border-radius:50%;background:#36b37e;box-shadow:0 0 0 2px var(--kt-surface)}#kefeFloatingToolbar .kft-launch[data-save-state=saving]::after{background:#d6a23a}@media(max-width:640px){.kft-context-popover{width:min(340px,calc(100vw - 16px))!important;max-height:min(54vh,380px)!important}.kft-context-field{grid-template-columns:minmax(0,1fr) minmax(100px,1fr)}}';
  document.head.appendChild(css);

  window.kefeProjectAutosave = Object.freeze({
    saveNow: saveProject,
    queueSave,
    restore: restoreProject,
    state: () => ({ restoring, hasSnapshot: !!localStorage.getItem(SAVE_KEY) })
  });
  const boundControls = new WeakSet();
  const fieldSelector = 'input:not([type="password"]), select, textarea';
  function bindControl(input) {
    if (boundControls.has(input)) return;
    boundControls.add(input);
    input.addEventListener('input', queueSave);
    input.addEventListener('change', () => {
      if (input instanceof HTMLInputElement && input.type === 'file') {
        const file = input.files && input.files[0];
        if (file && input.id) dbWrite(input.id, file).then(queueSave).catch(error => {
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
  const boot = () => restoreProject().catch(error => { console.warn('[KEFE autosave restore]', error); status('Autosave restore needs attention', false); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();