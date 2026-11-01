/* KEFE editor toolbar (beUI compact toolbar, wired to KEFE).
   Every control here writes through to the editor's existing native controls, so presets, saved defaults and
   exports behave exactly as before: lyric effect gallery, #fontOverride, style colour/size, lyric display mode,
   #lyricCase, lyrics timing, #kefeAspect, #visualiserBackground, #backgroundTransparency, the visualiser tabs,
   the lyrics switch, fullscreen, and the "Adjust layer" controls created by editor.js (kept in a hidden host). */
(() => {
  'use strict';
  // Normally linked after styles.css in editor.html; injected last here only if that link is missing.
  try {
    const src = document.currentScript && document.currentScript.src;
    if (src && !document.getElementById('kefeToolbarCss') && !document.querySelector('link[rel="stylesheet"][href*="/toolbar.css"]')) {
      const link = document.createElement('link');
      link.id = 'kefeToolbarCss'; link.rel = 'stylesheet';
      link.href = src.replace(/toolbar\.js(\?.*)?$/, 'toolbar.css$1');
      document.head.appendChild(link);
    }
  } catch (_) {}
  const stage = document.querySelector('.kefe-stage');
  if (!stage || document.getElementById('kefeFloatingToolbar')) return;

  const icon = (name, cls) => window.kefeIcon
    ? window.kefeIcon(name, 'kft-icon' + (cls ? ' ' + cls : ''))
    : '<span data-kefe-icon="' + name + '" data-icon-class="kft-icon' + (cls ? ' ' + cls : '') + '" aria-hidden="true"></span>';
  const h = (tag, cls, attrs) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (attrs) for (const key of Object.keys(attrs)) node.setAttribute(key, attrs[key]);
    return node;
  };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const emit = (action, value) => {
    window.dispatchEvent(new CustomEvent('kefe-toolbar-change', { detail: { action, value, source: 'editor-toolbar' } }));
    if (!['ready', 'position', 'reset-position', 'lock', 'nudge', 'move-tool'].includes(action)) recordHistory();
  };
  const fire = (node, ...types) => types.forEach(type => node.dispatchEvent(new Event(type, { bubbles: true })));
  const mirror = (node, fn, opts) => { if (!node) return; new MutationObserver(fn).observe(node, opts); fn(); };

  /* ───────── Existing editor controls (source of truth) ───────── */
  const $ = id => document.getElementById(id);
  const gallery = () => $('lyricEffectOptions');
  const fontSelect = () => $('fontOverride');
  const aspectSelect = () => $('kefeAspect');
  const lyricsSwitch = () => $('lyricsEnabledToggle');
  const bgSelect = () => $('visualiserBackground');
  const bgDarkness = () => $('backgroundTransparency');
  const caseSelect = () => $('lyricCase');
  const styleColor = () => document.querySelector('#kefeStyleGroup input.kefe-style-color[aria-label="Text custom colour"]')
    || document.querySelector('#kefeStyleGroup input[type="color"]');
  // "Text size" lives in the Size and placement group, which the lyric studio moves out of #kefeStyleGroup,
  // so find it by its label rather than by position (the first range in the style group is Outline width).
  const styleScale = () => {
    // Some effects add their own "Text size" slider (a different range), so prefer the lyric-style one (50-160%).
    const ranges = Array.from(document.querySelectorAll('label.kefe-visualiser-field'))
      .filter(l => l.querySelector('b')?.textContent.trim() === 'Text size')
      .map(l => l.querySelector('input[type="range"]')).filter(Boolean);
    return ranges.find(r => Number(r.min) === 50 && Number(r.max) === 160) || ranges[0] || null;
  };
  const modeButtons = () => Array.from(document.querySelectorAll('#kefeDisplayGroup [data-mode]'));
  const visTabs = () => Array.from(document.querySelectorAll('.kefe-vis-tabs [role="tab"], .kefe-vis-tabs button[data-visualiser]'))
    .filter((tab, i, all) => all.indexOf(tab) === i);

  // editor.js handles layer move / scale / reset / effect defaults through page-wide delegation on these
  // data attributes. The toolbar owns the controls: a hidden native set that its own UI drives, so saved layout
  // and per-effect defaults keep working exactly as before.
  const backing = h('div', 'kft-backing', { 'aria-hidden': 'true' });
  backing.hidden = true;
  backing.innerHTML =
    '<select data-layout-target tabindex="-1"><option value="lyrics">Lyrics</option><option value="card">Album artwork + title</option></select>' +
    '<input data-layout-scale type="range" min="50" max="200" step="1" value="100" tabindex="-1">' +
    '<button type="button" data-layout-move aria-pressed="false" tabindex="-1">Move layer</button>' +
    '<button type="button" data-layout-reset tabindex="-1">Reset</button>' +
    '<button type="button" data-layout-nudge="0,0" tabindex="-1">Nudge</button>' +
    '<button type="button" data-effect-default tabindex="-1">Lock default</button>' +
    '<button type="button" data-effect-default-clear tabindex="-1">Unlock</button>' +
    '<span data-layout-hint role="status"></span>';
  document.body.appendChild(backing);
  const adjustUi = backing;
  const q = sel => backing.querySelector(sel);
  const layerTarget = q('[data-layout-target]'), layerScale = q('[data-layout-scale]'), layerMove = q('[data-layout-move]');
  const layerReset = q('[data-layout-reset]'), layerDefault = q('[data-effect-default]'), layerDefaultClear = q('[data-effect-default-clear]');
  const layerHint = q('[data-layout-hint]');
  document.dispatchEvent(new Event('kefe-layout-controls-ready'));

  /* ───────── Popover manager ─────────
     Two layers, both portaled to <body>: a listbox (one open at a time) and a panel (the toolbar's
     dialog popovers). A listbox can open from inside a panel without closing it. */
  let current = null, panel = null;
  function closeListbox(restoreFocus) {
    if (!current) return;
    const { pop, trigger, onDoc } = current;
    current = null;
    pop.remove();
    trigger.setAttribute('aria-expanded', 'false');
    trigger.removeAttribute('aria-activedescendant');
    document.removeEventListener('pointerdown', onDoc, true);
    if (restoreFocus) trigger.focus({ preventScroll: true });
  }
  function closePanel(restoreFocus) {
    if (!panel) return;
    const { pop, trigger, onDoc } = panel;
    panel = null;
    closeListbox(false);
    pop.remove();
    trigger.setAttribute('aria-expanded', 'false');
    trigger.classList.remove('is-open');
    document.removeEventListener('pointerdown', onDoc, true);
    if (restoreFocus) trigger.focus({ preventScroll: true });
  }
  function closePopover(restoreFocus) { closeListbox(restoreFocus); closePanel(false); }
  function placePopover(pop, trigger, width) {
    const r = trigger.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const w = Math.min(width || Math.max(r.width, 140), vw - 16);
    pop.style.width = w + 'px';
    pop.style.left = clamp(r.left + (width ? (r.width - w) / 2 : 0), 8, vw - w - 8) + 'px';
    const below = vh - r.bottom - 12, above = r.top - 12;
    const natural = Math.min(pop.scrollHeight + 2, 420);
    const placeBelow = below >= Math.min(natural, 200) || below >= above;
    pop.style.maxHeight = Math.max(120, Math.min(420, placeBelow ? below : above)) + 'px';
    pop.style.top = placeBelow ? (r.bottom + 6) + 'px' : 'auto';
    pop.style.bottom = placeBelow ? 'auto' : (vh - r.top + 6) + 'px';
  }
  // Popovers render in the fullscreen element while it is active (anything outside it is not painted).
  const popHost = () => document.fullscreenElement || document.body;
  function openPopover(pop, trigger, width) {
    closeListbox(false);
    popHost().appendChild(pop);
    placePopover(pop, trigger, width);
    const onDoc = e => { if (!pop.contains(e.target) && !trigger.contains(e.target)) closeListbox(false); };
    document.addEventListener('pointerdown', onDoc, true);
    current = { pop, trigger, onDoc };
    trigger.setAttribute('aria-expanded', 'true');
  }
  function openPanel(pop, trigger, width) {
    popHost().appendChild(pop);
    placePopover(pop, trigger, width);
    const onDoc = e => { if (!e.target.closest('.kft-popover') && !trigger.contains(e.target) && !e.target.closest('.kft-tip')) closePanel(false); };
    document.addEventListener('pointerdown', onDoc, true);
    panel = { pop, trigger, onDoc };
    trigger.setAttribute('aria-expanded', 'true');
    trigger.classList.add('is-open');
  }
  window.addEventListener('resize', () => closePopover(false));

  let menuSeq = 0;
  function createMenu({ label, getOptions, getValue, onSelect, variant, fallback, width }) {
    const trigger = h('button', 'kft-trigger kft-trigger--' + variant, { type: 'button', 'aria-haspopup': 'listbox', 'aria-expanded': 'false', 'aria-label': label });
    const text = h('span', 'kft-trigger__text');
    trigger.appendChild(text);
    trigger.insertAdjacentHTML('beforeend', icon('chevron-down', 'kft-trigger__chev'));
    const listId = 'kftList' + (++menuSeq);
    let typed = '', typedTimer = 0;
    function refresh() {
      const match = getOptions().find(o => o.value === getValue());
      text.textContent = match ? match.label : (fallback || label);
      trigger.setAttribute('aria-label', label + ': ' + text.textContent);
    }
    function open() {
      const options = getOptions();
      const pop = h('div', 'kft-popover', { role: 'listbox', id: listId, 'aria-label': label, tabindex: '-1' });
      if (!options.length) { const empty = h('div', 'kft-empty'); empty.textContent = 'Nothing to choose yet'; pop.appendChild(empty); }
      const value = getValue();
      let active = Math.max(0, options.findIndex(o => o.value === value));
      const items = options.map((option, index) => {
        const item = h('div', 'kft-item', { role: 'option', id: listId + '-' + index, 'aria-selected': String(option.value === value) });
        const t = h('span', 'kft-item__text'); t.textContent = option.label;
        item.appendChild(t);
        item.insertAdjacentHTML('beforeend', icon('check', 'kft-item__check'));
        item.addEventListener('pointerdown', e => e.preventDefault());
        item.addEventListener('pointermove', () => setActive(index, false));
        item.addEventListener('click', () => choose(index));
        pop.appendChild(item);
        return item;
      });
      function setActive(i, scroll) {
        if (!items.length) return;
        active = clamp(i, 0, items.length - 1);
        items.forEach((it, k) => it.classList.toggle('is-active', k === active));
        trigger.setAttribute('aria-activedescendant', items[active].id);
        if (scroll !== false) items[active].scrollIntoView({ block: 'nearest' });
      }
      function choose(i) {
        const option = options[i];
        closeListbox(true);
        if (option) { onSelect(option.value); refresh(); }
      }
      pop._ctl = { setActive, choose, count: () => items.length, active: () => active, options };
      openPopover(pop, trigger, width);
      setActive(active);
    }
    trigger.addEventListener('click', () => { if (current && current.trigger === trigger) closeListbox(false); else open(); });
    trigger.addEventListener('keydown', e => {
      const isOpen = current && current.trigger === trigger;
      if (!isOpen) { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(); } return; }
      const ctl = current.pop._ctl;
      if (e.key === 'ArrowDown') { e.preventDefault(); ctl.setActive(ctl.active() + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); ctl.setActive(ctl.active() - 1); }
      else if (e.key === 'Home') { e.preventDefault(); ctl.setActive(0); }
      else if (e.key === 'End') { e.preventDefault(); ctl.setActive(ctl.count() - 1); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ctl.choose(ctl.active()); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeListbox(true); }
      else if (e.key === 'Tab') closeListbox(false);
      else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
        typed += e.key.toLowerCase();
        clearTimeout(typedTimer); typedTimer = setTimeout(() => { typed = ''; }, 600);
        const hit = ctl.options.findIndex(o => o.label.toLowerCase().startsWith(typed));
        if (hit >= 0) ctl.setActive(hit);
      }
    });
    return { trigger, refresh };
  }

  /* ───────── Scrub field (click or drag; arrow keys step) ───────── */
  function createScrubber({ label, min, max, step, onInput, format, bare }) {
    const el = h('div', 'kft-scrub', { role: 'slider', tabindex: '0', 'aria-label': label });
    const fill = h('span', 'kft-scrub__fill');
    const name = h('span', 'kft-scrub__label'); name.textContent = label;
    const out = h('span', 'kft-scrub__value');
    el.append(fill, bare ? h('span') : name, out);
    let value = min, lo = min, hi = max;
    const fmt = format || (v => Math.round(v) + '%');
    function render() {
      el.style.setProperty('--kt-fill', (clamp(hi > lo ? (value - lo) / (hi - lo) : 0, 0, 1) * 100).toFixed(2) + '%');
      el.setAttribute('aria-valuemin', String(lo)); el.setAttribute('aria-valuemax', String(hi));
      el.setAttribute('aria-valuenow', String(value)); el.setAttribute('aria-valuetext', fmt(value));
      out.textContent = fmt(value);
    }
    function commit(v) {
      const snapped = clamp(Math.round(v / step) * step, lo, hi);
      if (snapped === value) return;
      value = snapped; render(); onInput(value);
    }
    const fromX = x => { const r = el.getBoundingClientRect(); return lo + clamp((x - r.left) / Math.max(1, r.width), 0, 1) * (hi - lo); };
    let dragging = false;
    el.addEventListener('pointerdown', e => {
      if (el.getAttribute('aria-disabled') === 'true' || (e.button !== 0 && e.pointerType === 'mouse')) return;
      dragging = true; el.setPointerCapture(e.pointerId); el.focus({ preventScroll: true }); commit(fromX(e.clientX)); e.preventDefault();
    });
    el.addEventListener('pointermove', e => { if (dragging) commit(fromX(e.clientX)); });
    const end = () => { dragging = false; };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', end);
    el.addEventListener('keydown', e => {
      if (el.getAttribute('aria-disabled') === 'true') return;
      const big = e.shiftKey ? 10 : 1;
      const map = { ArrowRight: step * big, ArrowUp: step * big, ArrowLeft: -step * big, ArrowDown: -step * big, PageUp: step * 10, PageDown: -step * 10 };
      if (e.key in map) { e.preventDefault(); commit(value + map[e.key]); }
      else if (e.key === 'Home') { e.preventDefault(); commit(lo); }
      else if (e.key === 'End') { e.preventDefault(); commit(hi); }
    });
    render();
    return {
      el,
      set(v, newMin, newMax) {
        if (Number.isFinite(newMin)) lo = newMin;
        if (Number.isFinite(newMax)) hi = newMax;
        const n = Number(v);
        value = Number.isFinite(n) ? clamp(n, lo, hi) : lo; render();
      },
      disable(b) { el.setAttribute('aria-disabled', String(!!b)); el.tabIndex = b ? -1 : 0; }
    };
  }

  /* ───────── Segmented control ───────── */
  function createSegmented({ label, options, onChange }) {
    const el = h('div', 'kft-seg', { role: 'radiogroup', 'aria-label': label });
    const buttons = options.map(o => {
      const b = h('button', 'kft-seg__item', { type: 'button', role: 'radio', 'aria-checked': 'false', tabindex: '-1' });
      b.textContent = o.label; b.dataset.value = o.value;
      b.addEventListener('click', () => { set(o.value); onChange(o.value); });
      el.appendChild(b);
      return b;
    });
    function set(value) {
      let any = false;
      buttons.forEach(b => { const on = b.dataset.value === value; any = any || on; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
      if (!any && buttons[0]) buttons[0].tabIndex = 0;
    }
    el.addEventListener('keydown', e => {
      const i = buttons.indexOf(document.activeElement);
      if (i < 0 || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      e.preventDefault();
      const next = buttons[(i + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length];
      next.focus(); next.click();
    });
    return { el, set };
  }

  /* ───────── Tooltips ───────── */
  const tip = h('div', 'kft-tip'); tip.hidden = true;
  let tipTimer = 0;
  function bindTip(node, text) {
    node.setAttribute('aria-label', text);
    const show = () => {
      clearTimeout(tipTimer);
      tipTimer = setTimeout(() => {
        if (current || panel || dragging) return;
        tip.textContent = node.dataset.tip || text;
        tip.hidden = false;
        if (tip.parentNode !== popHost()) popHost().appendChild(tip);
        const r = node.getBoundingClientRect(), t = tip.getBoundingClientRect();
        tip.style.left = clamp(r.left + (r.width - t.width) / 2, 6, window.innerWidth - t.width - 6) + 'px';
        const below = r.bottom + 8 + t.height < window.innerHeight - 6;
        tip.style.top = (below ? r.bottom + 8 : r.top - t.height - 8) + 'px';
      }, 420);
    };
    const hide = () => { clearTimeout(tipTimer); tip.hidden = true; };
    node.dataset.tip = text;
    node.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch') show(); });
    node.addEventListener('pointerleave', hide);
    node.addEventListener('focus', show);
    node.addEventListener('blur', hide);
    node.addEventListener('pointerdown', hide);
  }
  const iconBtn = (name, label, extra) => {
    const b = h('button', 'kft-btn kft-btn--icon' + (extra ? ' ' + extra : ''), { type: 'button' });
    b.innerHTML = icon(name);
    bindTip(b, label);
    return b;
  };
  const flash = node => { node.classList.add('is-flash'); setTimeout(() => node.classList.remove('is-flash'), 450); };

  /* ───────── Structure ───────── */
  // The toolbar lives in the preview bar, left of the fullscreen button: a launcher icon that expands into the strip.
  const root = h('div', 'kefe-floating-toolbar', { id: 'kefeFloatingToolbar' });
  root.addEventListener('pointerdown', e => e.stopPropagation());
  root.addEventListener('click', e => e.stopPropagation());
  const bar = h('div', 'kft-bar', { id: 'kftStrip', role: 'toolbar', 'aria-label': 'KEFE editor toolbar' });
  const main = h('div', 'kft-main');
  const launch = h('button', 'kft-launch', { type: 'button', 'aria-expanded': 'false', 'aria-controls': 'kftStrip' });
  launch.innerHTML = icon('toolbar');
  bindTip(launch, 'Editor toolbar');
  // Placeholder left in the bar while the toolbar is dragged elsewhere: one click docks it again.
  const ghost = h('button', 'kft-ghost', { type: 'button' });
  ghost.innerHTML = icon('dock'); ghost.hidden = true;
  bindTip(ghost, 'Dock toolbar here');
  const cluster = (label, ...children) => {
    const el = h('div', 'kft-cluster', { role: 'group', 'aria-label': label });
    el.append(...children);
    return el;
  };

  const grip = h('button', 'kft-grip', { type: 'button' });
  grip.innerHTML = icon('grip');
  bindTip(grip, 'Drag to reposition · double-click to re-dock');
  grip.setAttribute('aria-label', 'Move toolbar. Drag, or use arrow keys to nudge. Double-click to re-dock.');

  const group = (title, ...children) => {
    const g = h('div', 'kft-group');
    const l = h('div', 'kft-label'); l.textContent = title;
    g.append(l, ...children);
    return g;
  };
  const field = (text, control) => {
    const wrap = h('div'); wrap.style.cssText = 'display:grid;gap:3px';
    const l = h('span', 'kft-field-label'); l.textContent = text;
    wrap.append(l, control);
    return wrap;
  };
  const chip = (name, text, onClick, extra) => {
    const c = h('button', 'kft-chip' + (extra ? ' ' + extra : ''), { type: 'button' });
    c.innerHTML = (name ? icon(name) : '') + '<span>' + text + '</span>';
    c.addEventListener('click', onClick);
    return c;
  };
  const checkRow = (text, input) => {
    const l = h('label', 'kft-pref');
    const s = h('span'); s.textContent = text;
    l.append(input, s);
    return l;
  };
  const cellBtn = (name, label, extra) => iconBtn(name, label, 'kft-cell' + (extra ? ' ' + extra : ''));
  const panelBtn = (name, label) => {
    const b = cellBtn(name, label);
    b.setAttribute('aria-haspopup', 'dialog'); b.setAttribute('aria-expanded', 'false');
    return b;
  };
  function makePanel(btn, label, width) {
    const pop = h('div', 'kft-popover kft-panel', { role: 'dialog', 'aria-label': label });
    pop.addEventListener('keydown', e => { if (e.key === 'Escape' && !current) { e.preventDefault(); e.stopPropagation(); closePanel(true); } });
    btn.addEventListener('click', () => {
      if (panel && panel.trigger === btn) { closePanel(false); return; }
      closeListbox(false); closePanel(false); sync();
      openPanel(pop, btn, width);
    });
    return pop;
  }
  const hint = h('p', 'kft-hint', { role: 'status', 'aria-live': 'polite' });
  function setHint(text) { hint.textContent = text || ''; }

  /* Move panel: layer, scale, nudge pad, drag-in-preview */
  const moveBtn = panelBtn('move', 'Move and scale layer');
  const undoBtn = cellBtn('undo', 'Undo');
  const redoBtn = cellBtn('redo', 'Redo');
  undoBtn.disabled = true; redoBtn.disabled = true;

  let layerMenu = null, layerSizeScrub = null, moveChip = null;
  const movePanel = makePanel(moveBtn, 'Move layer', 264);
  if (layerTarget && layerScale) {
    layerMenu = createMenu({
      label: 'Layer', variant: 'field', fallback: 'Lyrics',
      getOptions: () => Array.from(layerTarget.options).map(o => ({ value: o.value, label: o.textContent.trim() })),
      getValue: () => layerTarget.value,
      onSelect: value => { layerTarget.value = value; fire(layerTarget, 'change'); requestAnimationFrame(syncLayer); }
    });
    layerSizeScrub = createScrubber({
      label: 'Layer scale', bare: true, min: Number(layerScale.min) || 50, max: Number(layerScale.max) || 200, step: 1,
      onInput: v => { layerScale.value = String(v); fire(layerScale, 'input'); }
    });
    moveChip = chip('move', 'Drag in preview', () => { layerMove?.click(); requestAnimationFrame(syncMove); });
    moveChip.setAttribute('aria-pressed', 'false');
    movePanel.append(field('Active layer', layerMenu.trigger), field('Layer scale', layerSizeScrub.el));
  }
  const pad = h('div', 'kft-pad', { role: 'group', 'aria-label': 'Reposition selected layer' });
  function nudgeLayer(dx, dy) {
    const b = q('[data-layout-nudge]'); if (!b) return;
    b.dataset.layoutNudge = dx + ',' + dy; b.click();
    emit('nudge', { dx, dy });
  }
  [['up', 0, -1, 'Nudge up'], ['left', -1, 0, 'Nudge left'], ['dot', 0, 0, 'Reset layer position'], ['right', 1, 0, 'Nudge right'], ['down', 0, 1, 'Nudge down']].forEach(([name, dx, dy, label]) => {
    const b = h('button', 'kft-padbtn kft-pad--' + name, { type: 'button', title: label + (dx || dy ? ' (Shift = 10px)' : '') });
    b.innerHTML = icon(name === 'dot' ? 'dot' : 'arrow-' + name);
    b.setAttribute('aria-label', label);
    b.addEventListener('click', e => {
      if (!dx && !dy) { layerReset?.click(); requestAnimationFrame(syncLayer); return; }
      const step = e.shiftKey ? 10 : 1; nudgeLayer(dx * step, dy * step);
    });
    pad.appendChild(b);
  });
  movePanel.append(field('Position', pad));
  if (moveChip) movePanel.append(moveChip);
  document.addEventListener('keydown', e => {
    if (!panel || panel.pop !== movePanel || e.target.matches('input, select, textarea, [role="slider"]')) return;
    const step = e.shiftKey ? 10 : 1;
    const k = { ArrowUp: [0, -step], ArrowDown: [0, step], ArrowLeft: [-step, 0], ArrowRight: [step, 0] }[e.key];
    if (k) { e.preventDefault(); nudgeLayer(k[0], k[1]); }
  });

  /* Effect panel */
  const lyricStyleBtn = panelBtn('effect', 'Lyric effect and text style');
  const effectMenu = createMenu({
    label: 'Lyric effect', variant: 'field', fallback: 'Lyric effect',
    getOptions: () => Array.from(gallery()?.querySelectorAll('[data-effect]') || []).map(item => ({
      value: item.dataset.effect,
      label: item.querySelector('.kefe-lyric-effect-name')?.textContent.trim() || item.dataset.effect
    })),
    getValue: () => gallery()?.querySelector('[data-effect].active')?.dataset.effect || '',
    onSelect: value => { gallery()?.querySelector('[data-effect="' + CSS.escape(value) + '"]')?.click(); emit('effect', value); }
  });
  const modeSeg = createSegmented({
    label: 'Lyric display mode',
    options: [{ value: 'line', label: 'Line' }, { value: 'word', label: 'Word' }, { value: 'chunk', label: 'Chunk' }],
    onChange: value => { modeButtons().find(b => b.dataset.mode === value)?.click(); emit('lyric-mode', value); }
  });
  /* Timing nudge: drives the Lyrics timing controls */
  const nudge = h('div', 'kft-nudge', { role: 'group', 'aria-label': 'Lyrics timing offset' });
  const nudgeLess = h('button', '', { type: 'button', 'aria-label': 'Lyrics 0.1 seconds earlier' }); nudgeLess.innerHTML = icon('minus');
  const nudgeMore = h('button', '', { type: 'button', 'aria-label': 'Lyrics 0.1 seconds later' }); nudgeMore.innerHTML = icon('plus');
  const nudgeVal = h('span', 'kft-nudge__val'); nudgeVal.textContent = '0.0s';
  nudge.append(nudgeLess, nudgeVal, nudgeMore);
  nudgeLess.addEventListener('click', () => { $('lyricsTimingEarlier')?.click(); requestAnimationFrame(syncTiming); emit('timing', -0.1); });
  nudgeMore.addEventListener('click', () => { $('lyricsTimingLater')?.click(); requestAnimationFrame(syncTiming); emit('timing', 0.1); });
  function syncTiming() {
    const t = $('lyricsTimingValue')?.textContent.trim() || '0.00s';
    const n = parseFloat(t);
    nudgeVal.textContent = Number.isFinite(n) ? (n > 0 ? '+' : '') + n.toFixed(1) + 's' : t;
  }
  const timingReset = chip('reset', 'Reset timing', () => { $('lyricsTimingReset')?.click(); requestAnimationFrame(syncTiming); });
  // One Lyrics panel groups everything that styles the lyric text: effect, display mode, timing, font and colour.
  const lyricPanel = makePanel(lyricStyleBtn, 'Lyric effect and text style', 288);
  const sectionLabel = text => { const l = h('div', 'kft-label'); l.textContent = text; return l; };
  lyricPanel.append(sectionLabel('Effect'), field('Effect', effectMenu.trigger), field('Display mode', modeSeg.el), field('Timing nudge', nudge), timingReset);

  /* Text controls (rendered in the Lyrics panel) */
  const fontMenu = createMenu({
    label: 'Lyric font', variant: 'field', fallback: 'Effect font',
    getOptions: () => Array.from(fontSelect()?.options || []).map(o => ({ value: o.value, label: o.value === '' ? 'Effect font' : o.textContent.trim() })),
    getValue: () => fontSelect()?.value ?? '',
    onSelect: value => { const s = fontSelect(); if (!s) return; s.value = value; fire(s, 'change'); emit('font', value); }
  });
  const caseMenu = createMenu({
    label: 'Text case', variant: 'field', fallback: 'As written',
    getOptions: () => Array.from(caseSelect()?.options || []).map(o => ({ value: o.value, label: o.textContent.trim() })),
    getValue: () => caseSelect()?.value ?? 'asis',
    onSelect: value => { const s = caseSelect(); if (!s) return; s.value = value; fire(s, 'change'); emit('text-case', value); }
  });
  const sizeScrub = createScrubber({
    label: 'Text size', bare: true, min: 50, max: 160, step: 1,
    onInput: v => {
      const t = styleScale();
      if (!t) { setHint('Text size is available once the lyric style controls have loaded.'); return; }
      t.value = String(v); fire(t, 'input'); emit('text-size', v);
    }
  });
  lyricPanel.append(h('div', 'kft-rule'), sectionLabel('Text'), field('Font family', fontMenu.trigger), field('Text case', caseMenu.trigger), field('Text size', sizeScrub.el));

  /* Colour panel: presets + native picker + hex + outline/glow */
  const PRESETS = ['#ffffff', '#ef4444', '#22c55e', '#06b6d4', '#a855f7', '#f59e0b', '#ec4899', '#14b8a6', '#111113', '#8b8b9a'];
  const presetsEl = h('div', 'kft-presets');
  const presetBtns = PRESETS.map(hex => {
    const b = h('button', 'kft-preset', { type: 'button', 'aria-label': hex.toUpperCase(), 'aria-pressed': 'false' });
    b.style.setProperty('--kt-p', hex); b.dataset.color = hex;
    b.addEventListener('click', () => setColour(hex));
    presetsEl.appendChild(b);
    return b;
  });
  const hexRow = h('div', 'kft-hexrow');
  const nativePicker = h('input', '', { type: 'color', value: '#ffffff', 'aria-label': 'Pick a custom colour' });
  const hexInput = h('input', 'kft-hex', { type: 'text', maxlength: '7', spellcheck: 'false', 'aria-label': 'Hex colour', value: '#FFFFFF' });
  hexRow.append(nativePicker, hexInput);
  let colourValue = '#ffffff';
  function paintColour(hex) {
    colourValue = hex;
    nativePicker.value = hex;
    if (document.activeElement !== hexInput) hexInput.value = hex.toUpperCase();
    presetBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.color.toLowerCase() === hex.toLowerCase())));
  }
  function setColour(hex) {
    paintColour(hex);
    const target = styleColor();
    if (!target) { setHint('Text colour is available once the lyric style controls have loaded.'); return; }
    target.value = hex; fire(target, 'input', 'change');
    emit('text-colour', hex);
  }
  nativePicker.addEventListener('input', () => setColour(nativePicker.value));
  hexInput.addEventListener('input', () => {
    let v = hexInput.value.trim(); if (v && v[0] !== '#') v = '#' + v;
    if (/^#[0-9a-f]{6}$/i.test(v)) setColour(v.toLowerCase());
  });
  hexInput.addEventListener('blur', () => { hexInput.value = colourValue.toUpperCase(); });
  const outlineToggle = h('input', '', { type: 'checkbox', 'aria-label': 'Enable lyric outline' });
  const glowToggle = h('input', '', { type: 'checkbox', 'aria-label': 'Enable lyric glow' });
  function syncStyleToggles() {
    const style = window.kefeStyle?.state?.();
    if (style) { outlineToggle.checked = !!style.outline?.on; glowToggle.checked = !!style.glow?.on; }
  }
  function setStyleToggle(key, enabled) {
    const api = window.kefeStyle;
    if (!api?.state || !api?.applyState) { setHint('Lyric style controls are still loading.'); return; }
    const style = api.state();
    style[key].on = enabled;
    api.applyState(style);
    syncStyleToggles(); emit(key, enabled);
  }
  outlineToggle.addEventListener('change', () => setStyleToggle('outline', outlineToggle.checked));
  glowToggle.addEventListener('change', () => setStyleToggle('glow', glowToggle.checked));
  window.addEventListener('kefe-style-change', syncStyleToggles);
  syncStyleToggles();
  lyricPanel.append(sectionLabel('Colour'), presetsEl, hexRow, checkRow('Outline', outlineToggle), checkRow('Soft glow', glowToggle));

  const lyricsToggle = cellBtn('eye', 'Lyrics on or off', 'kft-btn--toggle');
  lyricsToggle.setAttribute('aria-pressed', 'true');

  /* Canvas panel: ratio, safe area, preview background, background + visualiser */
  const ratioBtn = h('button', 'kft-btn kft-cell kft-cell--ratio', { type: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': 'false' });
  const ratioLabel = h('span'); ratioLabel.textContent = '16:9';
  ratioBtn.innerHTML = icon('frame'); ratioBtn.appendChild(ratioLabel);
  bindTip(ratioBtn, 'Canvas, background and visualiser');
  const aspectSeg = createSegmented({
    label: 'Canvas ratio',
    options: [{ value: '16:9', label: '16:9' }, { value: '9:16', label: '9:16' }, { value: '1:1', label: '1:1' }],
    onChange: value => { const s = aspectSelect(); if (!s) return; s.value = value; fire(s, 'change'); ratioLabel.textContent = value; emit('aspect', value); }
  });
  const bgMenu = createMenu({
    label: 'Background', variant: 'field', fallback: 'Background',
    getOptions: () => Array.from(bgSelect()?.options || []).filter(o => !o.disabled).map(o => ({ value: o.value, label: o.textContent.trim() })),
    getValue: () => bgSelect()?.value ?? '',
    onSelect: value => { const s = bgSelect(); if (!s) return; s.value = value; fire(s, 'input', 'change'); emit('background', value); }
  });
  const visKey = tab => tab.dataset.visualiser || tab.getAttribute('aria-label') || tab.textContent.trim();
  const visLabel = tab => (tab.getAttribute('aria-label') || tab.textContent || '').replace(/\s*visualiser$/i, '').trim() || visKey(tab);
  const visMenu = createMenu({
    label: 'Visualiser', variant: 'field', fallback: 'Choose visualiser',
    getOptions: () => visTabs().map(tab => ({ value: visKey(tab), label: visLabel(tab) })).filter((o, i, all) => all.findIndex(x => x.value === o.value) === i),
    getValue: () => { const on = visTabs().find(t => t.getAttribute('aria-selected') === 'true' || t.classList.contains('primary')); return on ? visKey(on) : ''; },
    onSelect: value => { visTabs().find(t => visKey(t) === value)?.click(); emit('visualiser', value); }
  });
  const visualiserBtn = panelBtn('audio-waveform', 'Visualiser');
  const visualiserPanel = makePanel(visualiserBtn, 'Visualiser', 264);
  visualiserPanel.append(field('Visualiser', visMenu.trigger));
  const darkScrub = createScrubber({
    label: 'Background darkness', bare: true, min: 0, max: 100, step: 1,
    onInput: v => { const t = bgDarkness(); if (!t) return; t.value = String(v); fire(t, 'input', 'change'); emit('background-darkness', v); }
  });
  const safeAreaToggle = h('input', '', { type: 'checkbox', 'aria-label': 'Show preview safe area' });
  const previewBg = h('input', '', { type: 'color', value: '#171719', 'aria-label': 'Preview background colour' });
  const previewBgLabel = h('label', 'kft-pref kft-pref--colour');
  const previewBgText = h('span'); previewBgText.textContent = 'Preview background';
  previewBgLabel.append(previewBgText, previewBg);
  let safeInset = 5;
  const safeScrub = createScrubber({
    label: 'Safe-area inset', bare: true, min: 2, max: 20, step: 1, format: v => Math.round(v) + '%',
    onInput: v => { safeInset = v; syncPreferences(); emit('safe-inset', v); }
  });
  const canvasPanel = makePanel(ratioBtn, 'Canvas', 264);
  canvasPanel.append(field('Canvas ratio', aspectSeg.el), field('Background', bgMenu.trigger), field('Background darkness', darkScrub.el), checkRow('Show safe area', safeAreaToggle), field('Safe-area inset', safeScrub.el), previewBgLabel);

  /* Actions panel */
  const actionsBtn = panelBtn('menu', 'More actions');
  const compactToggle = h('input', '', { type: 'checkbox', 'aria-label': 'Compact toolbar' });
  const safeOverlay = h('div', 'kft-safe-overlay', { 'aria-hidden': 'true' });
  safeOverlay.style.cssText = 'position:absolute;z-index:5;pointer-events:none;box-sizing:border-box;border:1px dashed rgba(255,255,255,.75);outline:1px solid rgba(0,0,0,.3);display:none';
  const prefKey = 'kefe.toolbar.preferences.v1';
  const previewHost = document.querySelector('.kefe-preview, .kefe-preview-stage, .kefe-stage');
  try {
    const saved = JSON.parse(localStorage.getItem(prefKey) || 'null');
    if (saved) {
      safeAreaToggle.checked = saved.safeArea === true;
      compactToggle.checked = saved.compact === true;
      if (Number.isFinite(saved.safeInset)) safeInset = clamp(saved.safeInset, 2, 20);
      if (typeof saved.background === 'string' && /^#[0-9a-f]{6}$/i.test(saved.background)) {
        previewBg.value = saved.background;
        previewBg.dataset.changed = 'true';
      }
    }
  } catch (_) {}
  function syncPreferences() {
    root.classList.toggle('is-compact', compactToggle.checked);
    if (!safeOverlay.isConnected) { if (getComputedStyle(stage).position === 'static') stage.style.position = 'relative'; stage.appendChild(safeOverlay); }
    safeOverlay.style.display = safeAreaToggle.checked ? 'block' : 'none';
    safeOverlay.style.inset = safeInset + '%';
    safeScrub.set(safeInset);
    if (previewHost && previewBg.dataset.changed === 'true') previewHost.style.backgroundColor = previewBg.value;
    try {
      localStorage.setItem(prefKey, JSON.stringify({
        safeArea: safeAreaToggle.checked,
        compact: compactToggle.checked,
        safeInset,
        background: previewBg.dataset.changed === 'true' ? previewBg.value : ''
      }));
    } catch (_) {}
  }
  [safeAreaToggle, compactToggle].forEach(input => input.addEventListener('change', syncPreferences));
  previewBg.addEventListener('input', () => { previewBg.dataset.changed = 'true'; syncPreferences(); });
  syncPreferences();

  const resetChip = chip('reset', 'Reset selected layer', () => { layerReset?.click(); requestAnimationFrame(syncLayer); });
  const lockChip = chip('lock', 'Lock as effect default', () => layerDefault?.click());
  const clearChip = chip('unlock', 'Clear effect default', () => layerDefaultClear?.click());
  const lockPos = chip('unlock', 'Lock toolbar position', () => {
    const on = lockPos.getAttribute('aria-pressed') !== 'true';
    lockPos.setAttribute('aria-pressed', String(on));
    root.classList.toggle('is-locked', on);
    lockPos.innerHTML = icon(on ? 'lock' : 'unlock') + '<span>' + (on ? 'Toolbar position locked' : 'Lock toolbar position') + '</span>';
    emit('lock', on);
  });
  lockPos.setAttribute('aria-pressed', 'false');
  const resetPos = chip('dock', 'Dock toolbar in preview bar', () => { closePanel(false); redock(); });
  const actionsPanel = makePanel(actionsBtn, 'Actions', 244);
  actionsPanel.append(resetChip, lockChip, clearChip, h('div', 'kft-rule'), lockPos, resetPos, h('div', 'kft-rule'), checkRow('Compact density', compactToggle), hint);

  main.append(
    cluster('Layer', grip, moveBtn),
    cluster('History', undoBtn, redoBtn),
    cluster('Lyrics', lyricStyleBtn, lyricsToggle),
    cluster('Canvas', ratioBtn),
    cluster('Visualiser', visualiserBtn),
    cluster('Actions', actionsBtn)
  );
  bar.append(main);
  root.append(bar, launch);

  /* ───────── Sync with the editor ───────── */
  function syncLayer() {
    if (!layerScale) return;
    layerSizeScrub?.set(layerScale.value, Number(layerScale.min) || 50, Number(layerScale.max) || 200);
    layerMenu?.refresh();
  }
  function syncMove() {
    const pressed = layerMove?.getAttribute('aria-pressed') === 'true';
    moveBtn.classList.toggle('is-active', pressed);
    if (moveChip) { moveChip.setAttribute('aria-pressed', String(pressed)); moveChip.lastElementChild.textContent = pressed ? 'Done moving' : 'Drag in preview'; }
  }
  function sync() {
    effectMenu.refresh(); fontMenu.refresh(); caseMenu.refresh(); bgMenu.refresh(); visMenu.refresh();
    const a = aspectSelect(); if (a) { aspectSeg.set(a.value); ratioLabel.textContent = a.value; }
    const active = modeButtons().find(b => b.getAttribute('aria-checked') === 'true' || b.classList.contains('active'));
    modeSeg.set(active ? active.dataset.mode : 'line');
    syncStyleToggles();
    const c = styleColor();
    if (c && /^#[0-9a-f]{6}$/i.test(c.value)) paintColour(c.value.toLowerCase()); else paintColour(colourValue);
    const s = styleScale(); sizeScrub.disable(!s); sizeScrub.set(s ? s.value : 100);
    const d = bgDarkness(); darkScrub.disable(!d); darkScrub.set(d ? d.value : 0, Number(d?.min) || 0, Number(d?.max) || 100);
    const on = lyricsSwitch()?.getAttribute('aria-checked') !== 'false';
    lyricsToggle.setAttribute('aria-pressed', String(on));
    lyricsToggle.dataset.tip = on ? 'Lyrics on · click to hide' : 'Lyrics off · click to show';
    syncTiming(); syncLayer(); syncMove();
  }
  let syncQueued = 0;
  const queueSync = () => { if (syncQueued) return; syncQueued = requestAnimationFrame(() => { syncQueued = 0; if (!current) sync(); recordHistory(); }); };
  ['input', 'change', 'click'].forEach(type => document.addEventListener(type, e => { if (!root.contains(e.target)) queueSync(); }, true));
  mirror(layerHint, () => { const t = layerHint?.textContent.trim(); if (t) setHint(t); }, { childList: true, characterData: true, subtree: true });
  mirror(layerMove, syncMove, { attributes: true, attributeFilter: ['aria-pressed'] });
  mirror($('lyricsTimingValue'), syncTiming, { childList: true, characterData: true, subtree: true });
  mirror(gallery(), () => effectMenu.refresh(), { attributes: true, attributeFilter: ['class'], subtree: true, childList: true });
  window.addEventListener('kefe-style-change', sync);
  document.addEventListener('kefe-effect-change', sync);
  document.addEventListener('DOMContentLoaded', sync, { once: true });
  window.addEventListener('kefe-shell-ready', () => { sync(); queueMount(); });
  window.addEventListener('load', () => { sync(); queueMount(); });

  lyricsToggle.addEventListener('click', () => {
    const s = lyricsSwitch(); if (!s) return;
    s.click();
    const on = s.getAttribute('aria-checked') !== 'false';
    lyricsToggle.setAttribute('aria-pressed', String(on));
    lyricsToggle.dataset.tip = on ? 'Lyrics on · click to hide' : 'Lyrics off · click to show';
    emit('lyrics', on);
  });

  /* ───────── Docking, expanding, dragging ─────────
     Default home: inside the preview bar, immediately left of the fullscreen button. The launcher is always there;
     it expands into the strip. Dragging the grip floats the toolbar; double-click the grip, the dock placeholder
     or "Dock toolbar" puts it back. Position is deliberately not persisted: a refresh always re-docks. */
  const OPEN_KEY = 'kefe.toolbar.open.v2';
  const bareBar = () => document.querySelector('.kefe-preview-dock');
  const dockHost = () => bareBar() || null;
  const inFullscreen = () => document.fullscreenElement === stage || stage.classList.contains('kefe-pseudo-fullscreen');
  let pos = { x: 12, y: 12 }, floating = false, dragging = null, isOpen = false;
  try { localStorage.removeItem('kefe.floating-toolbar.position.v4'); isOpen = localStorage.getItem(OPEN_KEY) !== '0'; } catch (_) {}

  const clampPos = (x, y) => ({
    x: clamp(x, 8, Math.max(8, window.innerWidth - root.offsetWidth - 8)),
    y: clamp(y, 8, Math.max(8, window.innerHeight - root.offsetHeight - 8))
  });
  function placeFloating() {
    pos = clampPos(pos.x, pos.y);
    root.style.left = pos.x + 'px'; root.style.top = pos.y + 'px';
  }
  function setOpen(next, focusLauncher) {
    isOpen = !!next;
    clearTimeout(tipTimer); tip.hidden = true;
    root.classList.toggle('is-open', isOpen);
    launch.setAttribute('aria-expanded', String(isOpen));
    launch.classList.toggle('is-open', isOpen);
    if (!isOpen) closePopover(false);
    try { localStorage.setItem(OPEN_KEY, isOpen ? '1' : '0'); } catch (_) {}
    if (floating) requestAnimationFrame(placeFloating);
    requestAnimationFrame(() => window.dispatchEvent(new Event('kefe-preview-fit')));
    if (focusLauncher) launch.focus({ preventScroll: true });
  }
  // Where the root should live right now: the fullscreen stage, the page (floating), or the preview bar (docked).
  function mountRoot() {
    const host = dockHost();
    if (inFullscreen()) {
      root.classList.add('is-floating', 'is-fullscreen');
      if (root.parentNode !== stage) stage.appendChild(root);
      root.style.left = ''; root.style.top = '';
      ghost.hidden = !floating || !host; return;
    }
    root.classList.remove('is-fullscreen');
    if (floating) {
      root.classList.add('is-floating');
      if (root.parentNode !== document.body) document.body.appendChild(root);
      placeFloating();
      ghost.hidden = !host;
    } else if (host) {
      root.classList.remove('is-floating');
      root.style.left = ''; root.style.top = '';
      if (root.parentNode !== host || root.nextElementSibling !== null) host.appendChild(root);
      ghost.hidden = true;
    }
    if (host && ghost.parentNode !== host) host.insertBefore(ghost, root.parentNode === host ? root : null);
  }
  function redock() {
    floating = false;
    closePopover(false);
    mountRoot(); emit('reset-position', pos);
    requestAnimationFrame(() => window.dispatchEvent(new Event('kefe-preview-fit')));
  }
  launch.addEventListener('click', () => setOpen(!isOpen));
  ghost.addEventListener('click', redock);
  // Escape: close an open panel first; with nothing open, collapse the strip back to the launcher.
  root.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (panel) { closePanel(true); e.stopPropagation(); return; }
    if (current) return;
    if (isOpen) { e.stopPropagation(); setOpen(false, true); }
  });

  grip.addEventListener('pointerdown', e => {
    if (lockPos.getAttribute('aria-pressed') === 'true' || inFullscreen() || (e.button !== 0 && e.pointerType === 'mouse')) return;
    e.preventDefault();
    closePopover(false); tip.hidden = true;
    const r = root.getBoundingClientRect();
    dragging = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top, moved: false, from: r };
    grip.setPointerCapture?.(e.pointerId);
  });
  grip.addEventListener('pointermove', e => {
    if (!dragging || e.pointerId !== dragging.id) return;
    if (!dragging.moved) {
      if (Math.hypot(e.clientX - dragging.dx - dragging.from.left, e.clientY - dragging.dy - dragging.from.top) < 4) return;
      // First real movement: float at the current spot so nothing jumps, then follow the pointer.
      dragging.moved = true; floating = true;
      pos = { x: dragging.from.left, y: dragging.from.top };
      mountRoot(); root.classList.add('is-dragging');
    }
    pos = clampPos(e.clientX - dragging.dx, e.clientY - dragging.dy);
    root.style.left = pos.x + 'px'; root.style.top = pos.y + 'px';
  });
  const stopDrag = e => {
    if (!dragging || (e && e.pointerId !== dragging.id)) return;
    const moved = dragging.moved;
    dragging = null; root.classList.remove('is-dragging');
    if (moved) { emit('position', pos); requestAnimationFrame(() => window.dispatchEvent(new Event('kefe-preview-fit'))); }
  };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => grip.addEventListener(t, stopDrag));
  grip.addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(e.key) || lockPos.getAttribute('aria-pressed') === 'true' || inFullscreen()) return;
    e.preventDefault();
    if (e.key === 'Home') { redock(); return; }
    const step = e.shiftKey ? 24 : 6;
    if (!floating) { const r = root.getBoundingClientRect(); pos = { x: r.left, y: r.top }; floating = true; mountRoot(); }
    pos = { x: pos.x + (e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0), y: pos.y + (e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0) };
    placeFloating(); emit('position', pos);
  });
  grip.addEventListener('dblclick', redock);

  let mountQueued = 0;
  const queueMount = () => { if (mountQueued) return; mountQueued = requestAnimationFrame(() => { mountQueued = 0; mountRoot(); }); };
  window.addEventListener('resize', () => { if (floating) placeFloating(); queueMount(); });
  document.addEventListener('fullscreenchange', queueMount);
  new MutationObserver(queueMount).observe(stage, { attributes: true, attributeFilter: ['class'] });
  // The bar's height changes when the strip wraps; keep the preview stage fitted to what is left.
  // Width flag for the stacked layout (strip on its own row). Measured from the pane, not the bar, so it cannot feed back.
  const flagWidth = () => {
    const barEl = bareBar(); if (!barEl) return;
    const w = (barEl.parentElement || barEl).clientWidth;
    const next = w <= 360 ? 'tight' : w <= 540 ? 'narrow' : '';
    if (next) barEl.setAttribute('data-kft', next); else barEl.removeAttribute('data-kft');
  };
  flagWidth();
  if (window.ResizeObserver) {
    const barEl = bareBar();
    if (barEl) {
      // Toolbar wrapping changes only the preview's available height; do not
      // broadcast a global viewport resize to every editor subsystem.
      new ResizeObserver(() => window.dispatchEvent(new Event('kefe-preview-fit'))).observe(barEl);
      if (barEl.parentElement) new ResizeObserver(flagWidth).observe(barEl.parentElement);
    }
  }

  /* ───────── Undo / redo (toolbar-level history of look & canvas settings) ───────── */
  const hist = { past: [], future: [], last: null, busy: false, timer: 0 };
  const snap = () => ({
    effect: gallery()?.querySelector('[data-effect].active')?.dataset.effect || '',
    font: fontSelect()?.value ?? null, case: caseSelect()?.value ?? null, aspect: aspectSelect()?.value ?? null,
    bg: bgSelect()?.value ?? null, dark: bgDarkness()?.value ?? null, size: styleScale()?.value ?? null,
    colour: styleColor()?.value ?? null,
    mode: (modeButtons().find(b => b.getAttribute('aria-checked') === 'true' || b.classList.contains('active')) || {}).dataset?.mode || null,
    lyrics: lyricsSwitch() ? lyricsSwitch().getAttribute('aria-checked') !== 'false' : null
  });
  function updateHistoryButtons() { undoBtn.disabled = !hist.past.length; redoBtn.disabled = !hist.future.length; }
  function recordHistory() {
    if (hist.busy) return;
    clearTimeout(hist.timer);
    hist.timer = setTimeout(() => {
      if (hist.busy) return;
      const now = JSON.stringify(snap());
      if (hist.last === null) { hist.last = now; return; }
      if (now === hist.last) return;
      hist.past.push(hist.last); if (hist.past.length > 100) hist.past.shift();
      hist.future.length = 0; hist.last = now; updateHistoryButtons();
    }, 220);
  }
  function applySnap(st) {
    hist.busy = true;
    if (st.effect) gallery()?.querySelector('[data-effect="' + CSS.escape(st.effect) + '"]')?.click();
    const sel = (el, v) => { if (el && v != null && el.value !== v) { el.value = v; fire(el, 'input', 'change'); } };
    sel(fontSelect(), st.font); sel(caseSelect(), st.case); sel(aspectSelect(), st.aspect); sel(bgSelect(), st.bg); sel(bgDarkness(), st.dark);
    const sc = styleScale(); if (sc && st.size != null) { sc.value = st.size; fire(sc, 'input'); }
    const c = styleColor(); if (c && st.colour) { c.value = st.colour; fire(c, 'input', 'change'); }
    if (st.mode) modeButtons().find(b => b.dataset.mode === st.mode)?.click();
    const sw = lyricsSwitch(); if (sw && st.lyrics != null && (sw.getAttribute('aria-checked') !== 'false') !== st.lyrics) sw.click();
    requestAnimationFrame(sync);
    setTimeout(() => { hist.last = JSON.stringify(snap()); hist.busy = false; sync(); updateHistoryButtons(); }, 450);
  }
  function stepHistory(from, to) {
    if (!from.length || hist.busy) return;
    to.push(hist.last); hist.last = from.pop();
    updateHistoryButtons(); applySnap(JSON.parse(hist.last));
  }
  undoBtn.addEventListener('click', () => { stepHistory(hist.past, hist.future); emit('undo', true); });
  redoBtn.addEventListener('click', () => { stepHistory(hist.future, hist.past); emit('redo', true); });
  const seedHistory = () => { if (!hist.past.length && !hist.busy) hist.last = JSON.stringify(snap()); };
  window.addEventListener('load', () => setTimeout(seedHistory, 400));
  window.addEventListener('kefe-shell-ready', () => setTimeout(seedHistory, 400));

  sync();
  seedHistory();
  setOpen(isOpen);
  mountRoot();
  if (!root.isConnected) document.body.appendChild(root);
  emit('ready', true);
})();
