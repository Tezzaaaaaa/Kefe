/* KEFE editor toolbar (beUI compact toolbar, wired to KEFE).
   Every control here writes through to the editor's existing native controls, so presets, saved defaults and
   exports behave exactly as before: lyric effect gallery, #fontOverride, style colour/size, lyric display mode,
   #lyricCase, lyrics timing, #kefeAspect, #visualiserBackground, #backgroundTransparency, the visualiser tabs,
   the lyrics switch, fullscreen, and the "Adjust layer" controls created by editor.js (kept in a hidden host). */
(() => {
  'use strict';
  const stage = document.querySelector('.kefe-stage');
  if (!stage || document.getElementById('kefeFloatingToolbar')) return;

  const ICON = {
    grip: '<circle cx="9" cy="5" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="9" cy="19" r="2"/><circle cx="15" cy="5" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="15" cy="19" r="2"/>',
    move: '<path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    unlock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
    lyrics: '<path d="M4 6h16M4 12h11M4 18h8"/>',
    full: '<path d="M8 3H3v5M16 3h5v5M8 21H3v-5M21 16v5h-5"/>',
    chevron: '<polyline points="6 9 12 15 18 9"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    reset: '<path d="M3 11a9 9 0 1 1 2.6 6.4M3 4v7h7"/>'
  };
  const icon = (name, cls) => '<svg class="kft-icon' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + ICON[name] + '</svg>';
  const h = (tag, cls, attrs) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (attrs) for (const key of Object.keys(attrs)) node.setAttribute(key, attrs[key]);
    return node;
  };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const emit = (action, value) => window.dispatchEvent(new CustomEvent('kefe-toolbar-change', { detail: { action, value, source: 'editor-toolbar' } }));
  const fire = (node, ...types) => types.forEach(type => node.dispatchEvent(new Event(type, { bubbles: true })));
  const mirror = (node, fn, opts) => { if (!node) return; new MutationObserver(fn).observe(node, opts); fn(); };

  /* ───────── Existing editor controls (source of truth) ───────── */
  const $ = id => document.getElementById(id);
  const gallery = () => $('lyricEffectOptions');
  const fontSelect = () => $('fontOverride');
  const aspectSelect = () => $('kefeAspect');
  const lyricsSwitch = () => $('lyricsEnabledToggle');
  const fullscreenButton = () => $('previewFullscreen');
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

  /* ───────── Popover manager (one open at a time, portaled to <body>) ───────── */
  let current = null;
  function closePopover(restoreFocus) {
    if (!current) return;
    const { pop, trigger, onDoc } = current;
    current = null;
    pop.remove();
    trigger.setAttribute('aria-expanded', 'false');
    trigger.removeAttribute('aria-activedescendant');
    document.removeEventListener('pointerdown', onDoc, true);
    if (restoreFocus) trigger.focus({ preventScroll: true });
  }
  function placePopover(pop, trigger, width) {
    const r = trigger.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const w = Math.min(width || Math.max(r.width, 140), vw - 16);
    pop.style.width = w + 'px';
    pop.style.left = clamp(r.left + (width ? (r.width - w) / 2 : 0), 8, vw - w - 8) + 'px';
    const below = vh - r.bottom - 12, above = r.top - 12;
    const natural = Math.min(pop.scrollHeight + 2, 320);
    const placeBelow = below >= Math.min(natural, 200) || below >= above;
    pop.style.maxHeight = Math.max(120, Math.min(320, placeBelow ? below : above)) + 'px';
    pop.style.top = placeBelow ? (r.bottom + 6) + 'px' : 'auto';
    pop.style.bottom = placeBelow ? 'auto' : (vh - r.top + 6) + 'px';
  }
  function openPopover(pop, trigger, width) {
    closePopover(false);
    document.body.appendChild(pop);
    placePopover(pop, trigger, width);
    const onDoc = e => { if (!pop.contains(e.target) && !trigger.contains(e.target)) closePopover(false); };
    document.addEventListener('pointerdown', onDoc, true);
    current = { pop, trigger, onDoc };
    trigger.setAttribute('aria-expanded', 'true');
  }
  window.addEventListener('resize', () => closePopover(false));

  let menuSeq = 0;
  function createMenu({ label, getOptions, getValue, onSelect, variant, fallback, width }) {
    const trigger = h('button', 'kft-trigger kft-trigger--' + variant, { type: 'button', 'aria-haspopup': 'listbox', 'aria-expanded': 'false', 'aria-label': label });
    const text = h('span', 'kft-trigger__text');
    trigger.appendChild(text);
    trigger.insertAdjacentHTML('beforeend', icon('chevron', 'kft-trigger__chev'));
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
        closePopover(true);
        if (option) { onSelect(option.value); refresh(); }
      }
      pop._ctl = { setActive, choose, count: () => items.length, active: () => active, options };
      openPopover(pop, trigger, width);
      setActive(active);
    }
    trigger.addEventListener('click', () => { if (current && current.trigger === trigger) closePopover(false); else open(); });
    trigger.addEventListener('keydown', e => {
      const isOpen = current && current.trigger === trigger;
      if (!isOpen) { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(); } return; }
      const ctl = current.pop._ctl;
      if (e.key === 'ArrowDown') { e.preventDefault(); ctl.setActive(ctl.active() + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); ctl.setActive(ctl.active() - 1); }
      else if (e.key === 'Home') { e.preventDefault(); ctl.setActive(0); }
      else if (e.key === 'End') { e.preventDefault(); ctl.setActive(ctl.count() - 1); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ctl.choose(ctl.active()); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePopover(true); }
      else if (e.key === 'Tab') closePopover(false);
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
        if (current || dragging) return;
        tip.textContent = node.dataset.tip || text;
        tip.hidden = false;
        if (!tip.isConnected) document.body.appendChild(tip);
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
  const root = h('div', 'kefe-floating-toolbar', { id: 'kefeFloatingToolbar', role: 'toolbar', 'aria-label': 'KEFE editor toolbar' });
  root.addEventListener('pointerdown', e => e.stopPropagation());
  root.addEventListener('click', e => e.stopPropagation());
  const bar = h('div', 'kft-bar');
  const main = h('div', 'kft-main');
  const divider = () => h('span', 'kft-divider kft-hide-sm');

  const grip = h('button', 'kft-grip', { type: 'button' });
  grip.innerHTML = icon('grip');
  bindTip(grip, 'Drag to reposition · double-click to re-dock');
  grip.setAttribute('aria-label', 'Move toolbar. Drag, or use arrow keys to nudge. Double-click to re-dock.');

  const moveBtn = iconBtn('move', 'Move layer in preview', 'kft-btn--toggle');
  moveBtn.setAttribute('aria-pressed', 'false');
  const lockBtn = iconBtn('lock', 'Lock this look as the effect default', 'kft-hide-sm');

  const effectMenu = createMenu({
    label: 'Lyric effect', variant: 'bar', fallback: 'Lyric effect',
    getOptions: () => Array.from(gallery()?.querySelectorAll('[data-effect]') || []).map(item => ({
      value: item.dataset.effect,
      label: item.querySelector('.kefe-lyric-effect-name')?.textContent.trim() || item.dataset.effect
    })),
    getValue: () => gallery()?.querySelector('[data-effect].active')?.dataset.effect || '',
    onSelect: value => { gallery()?.querySelector('[data-effect="' + CSS.escape(value) + '"]')?.click(); emit('effect', value); }
  });
  const fontMenu = createMenu({
    label: 'Lyric font', variant: 'bar', fallback: 'Effect font',
    getOptions: () => Array.from(fontSelect()?.options || []).map(o => ({ value: o.value, label: o.value === '' ? 'Effect font' : o.textContent.trim() })),
    getValue: () => fontSelect()?.value ?? '',
    onSelect: value => { const s = fontSelect(); if (!s) return; s.value = value; fire(s, 'change'); emit('font', value); }
  });

  fontMenu.trigger.classList.add('kft-hide-sm');

  /* Colour popover: presets + native picker + hex */
  const swatchBtn = h('button', 'kft-btn kft-swatch-btn', { type: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': 'false' });
  const swatch = h('span', 'kft-swatch');
  swatchBtn.appendChild(swatch);
  bindTip(swatchBtn, 'Lyric text colour');
  const PRESETS = ['#ffffff', '#ef4444', '#22c55e', '#06b6d4', '#a855f7', '#f59e0b', '#ec4899', '#14b8a6', '#111113', '#8b8b9a'];
  const colourPop = h('div', 'kft-popover kft-colour', { role: 'dialog', 'aria-label': 'Lyric text colour' });
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
  colourPop.append(presetsEl, hexRow);
  let colourValue = '#ffffff';
  function paintColour(hex) {
    colourValue = hex;
    swatch.style.setProperty('--kt-swatch', hex);
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
  colourPop.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePopover(true); } });
  swatchBtn.addEventListener('click', () => {
    if (current && current.trigger === swatchBtn) { closePopover(false); return; }
    openPopover(colourPop, swatchBtn, 208);
  });

  /* Timing nudge: drives the Lyrics timing controls */
  const nudge = h('div', 'kft-nudge', { role: 'group', 'aria-label': 'Lyrics timing offset' });
  const nudgeLess = h('button', '', { type: 'button', 'aria-label': 'Lyrics 0.1 seconds earlier' }); nudgeLess.textContent = '−';
  const nudgeMore = h('button', '', { type: 'button', 'aria-label': 'Lyrics 0.1 seconds later' }); nudgeMore.textContent = '+';
  const nudgeVal = h('span', 'kft-nudge__val'); nudgeVal.textContent = '0.0s';
  nudge.append(nudgeLess, nudgeVal, nudgeMore);
  nudge.title = 'Lyrics timing offset';
  nudge.classList.add('kft-hide-sm');
  nudgeLess.addEventListener('click', () => { $('lyricsTimingEarlier')?.click(); requestAnimationFrame(syncTiming); emit('timing', -0.1); });
  nudgeMore.addEventListener('click', () => { $('lyricsTimingLater')?.click(); requestAnimationFrame(syncTiming); emit('timing', 0.1); });
  function syncTiming() {
    const t = $('lyricsTimingValue')?.textContent.trim() || '0.00s';
    const n = parseFloat(t);
    nudgeVal.textContent = nVal.textContent = Number.isFinite(n) ? (n > 0 ? '+' : '') + n.toFixed(1) + 's' : t;
  }

  const lyricsBtn = iconBtn('lyrics', 'Lyrics on or off', 'kft-btn--toggle');
  const fullBtn = iconBtn('full', 'Fullscreen preview');
  const expandBtn = h('button', 'kft-btn kft-btn--icon', { type: 'button', 'aria-expanded': 'false', 'aria-controls': 'kefeToolbarTray' });
  expandBtn.innerHTML = icon('chevron');
  bindTip(expandBtn, 'More tools');

  main.append(grip, moveBtn, lockBtn, divider(), effectMenu.trigger, fontMenu.trigger, swatchBtn, divider(), nudge, divider(), lyricsBtn, fullBtn);

  /* Expanded tray */
  const tray = h('div', 'kft-tray', { id: 'kefeToolbarTray', role: 'group', 'aria-label': 'More toolbar tools' });
  tray.hidden = true;
  const grid = h('div', 'kft-tray__grid');
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

  // Lyrics & timing
  const modeSeg = createSegmented({
    label: 'Lyric display mode',
    options: [{ value: 'line', label: 'Line' }, { value: 'word', label: 'Word' }, { value: 'chunk', label: 'Chunk' }],
    onChange: value => { modeButtons().find(b => b.dataset.mode === value)?.click(); emit('lyric-mode', value); }
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
  const fontMenuTray = createMenu({
    label: 'Lyric font', variant: 'field', fallback: 'Effect font',
    getOptions: () => Array.from(fontSelect()?.options || []).map(o => ({ value: o.value, label: o.value === '' ? 'Effect font' : o.textContent.trim() })),
    getValue: () => fontSelect()?.value ?? '',
    onSelect: value => { const s = fontSelect(); if (!s) return; s.value = value; fire(s, 'change'); emit('font', value); }
  });
  const nudgeTray = h('div', 'kft-nudge kft-nudge--tray', { role: 'group', 'aria-label': 'Lyrics timing offset' });
  const nLess = h('button', '', { type: 'button', 'aria-label': 'Lyrics 0.1 seconds earlier' }); nLess.textContent = '−';
  const nMore = h('button', '', { type: 'button', 'aria-label': 'Lyrics 0.1 seconds later' }); nMore.textContent = '+';
  const nVal = h('span', 'kft-nudge__val'); nVal.textContent = '0.0s';
  nudgeTray.append(nLess, nVal, nMore);
  nLess.addEventListener('click', () => nudgeLess.click());
  nMore.addEventListener('click', () => nudgeMore.click());
  const timingReset = chip('reset', 'Reset timing', () => { $('lyricsTimingReset')?.click(); requestAnimationFrame(syncTiming); });
  const timingField = field('Timing', nudgeTray); timingField.classList.add('kft-only-sm');
  grid.append(group('Lyrics', field('Display', modeSeg.el), field('Font', fontMenuTray.trigger), field('Text case', caseMenu.trigger), field('Text size', sizeScrub.el), timingField, timingReset));

  // Layer
  let layerMenu = null, layerSizeScrub = null, moveChip = null;
  if (adjustUi && layerTarget && layerScale) {
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
    moveChip = chip('move', 'Move layer', () => { layerMove?.click(); requestAnimationFrame(syncMove); });
    moveChip.setAttribute('aria-pressed', 'false');
    const resetChip = chip('reset', 'Reset', () => { layerReset?.click(); requestAnimationFrame(syncLayer); });
    const lockChip = chip('lock', 'Lock default', () => layerDefault?.click());
    const clearChip = chip('unlock', 'Unlock', () => layerDefaultClear?.click());
    const a = h('div', 'kft-grid-2'); a.append(moveChip, resetChip);
    const b = h('div', 'kft-grid-2'); b.append(lockChip, clearChip);
    grid.append(group('Layer', field('Adjust', layerMenu.trigger), field('Scale', layerSizeScrub.el), a, b));
  }

  // Canvas, background, visualiser
  const aspectSeg = createSegmented({
    label: 'Canvas ratio',
    options: [{ value: '16:9', label: '16:9' }, { value: '9:16', label: '9:16' }, { value: '1:1', label: '1:1' }],
    onChange: value => { const s = aspectSelect(); if (!s) return; s.value = value; fire(s, 'change'); emit('aspect', value); }
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
    getOptions: () => visTabs().map(tab => ({ value: visKey(tab), label: visLabel(tab) })),
    getValue: () => { const on = visTabs().find(t => t.getAttribute('aria-selected') === 'true' || t.classList.contains('primary')); return on ? visKey(on) : ''; },
    onSelect: value => { visTabs().find(t => visKey(t) === value)?.click(); emit('visualiser', value); }
  });
  const darkScrub = createScrubber({
    label: 'Background darkness', bare: true, min: 0, max: 100, step: 1,
    onInput: v => { const t = bgDarkness(); if (!t) return; t.value = String(v); fire(t, 'input', 'change'); emit('background-darkness', v); }
  });
  aspectSeg.el.classList.add('kft-aspect-control');
  main.append(divider(), aspectSeg.el, divider(), expandBtn);
  grid.append(group('Canvas & background', field('Background', bgMenu.trigger), field('Visualiser', visMenu.trigger), field('Darkness', darkScrub.el)));

  tray.appendChild(grid);
  const foot = h('div', 'kft-tray__foot');
  const lockPos = chip('unlock', 'Lock position', () => {
    const on = lockPos.getAttribute('aria-pressed') !== 'true';
    lockPos.setAttribute('aria-pressed', String(on));
    root.classList.toggle('is-locked', on);
    lockPos.innerHTML = icon(on ? 'lock' : 'unlock') + '<span>' + (on ? 'Position locked' : 'Lock position') + '</span>';
    emit('lock', on);
  }, 'kft-chip--quiet');
  lockPos.setAttribute('aria-pressed', 'false');
  const resetPos = chip('reset', 'Re-dock', () => redock(), 'kft-chip--quiet');
  const hint = h('p', 'kft-hint', { role: 'status', 'aria-live': 'polite' });
  function setHint(text) { hint.textContent = text || ''; }
  foot.append(lockPos, resetPos, hint);
  tray.appendChild(foot);

  bar.append(main, tray);
  root.appendChild(bar);
  document.body.appendChild(root);

  /* ───────── Sync with the editor ───────── */
  function syncLayer() {
    if (!layerScale) return;
    layerSizeScrub?.set(layerScale.value, Number(layerScale.min) || 50, Number(layerScale.max) || 200);
    layerMenu?.refresh();
  }
  function syncMove() {
    const pressed = layerMove?.getAttribute('aria-pressed') === 'true';
    moveBtn.setAttribute('aria-pressed', String(pressed));
    if (moveChip) { moveChip.setAttribute('aria-pressed', String(pressed)); moveChip.querySelector('span').textContent = pressed ? 'Done moving' : 'Move layer'; }
  }
  function sync() {
    effectMenu.refresh(); fontMenu.refresh(); fontMenuTray.refresh(); caseMenu.refresh(); bgMenu.refresh(); visMenu.refresh();
    const a = aspectSelect(); if (a) aspectSeg.set(a.value);
    const active = modeButtons().find(b => b.getAttribute('aria-checked') === 'true' || b.classList.contains('active'));
    modeSeg.set(active ? active.dataset.mode : 'line');
    const c = styleColor();
    if (c && /^#[0-9a-f]{6}$/i.test(c.value)) paintColour(c.value.toLowerCase()); else paintColour(colourValue);
    const s = styleScale(); sizeScrub.disable(!s); sizeScrub.set(s ? s.value : 100);
    const d = bgDarkness(); darkScrub.disable(!d); darkScrub.set(d ? d.value : 0, Number(d?.min) || 0, Number(d?.max) || 100);
    const on = lyricsSwitch()?.getAttribute('aria-checked') !== 'false';
    lyricsBtn.setAttribute('aria-pressed', String(on));
    lyricsBtn.dataset.tip = on ? 'Lyrics on · click to hide' : 'Lyrics off · click to show';
    syncTiming(); syncLayer(); syncMove();
  }
  let syncQueued = 0;
  const queueSync = () => { if (syncQueued) return; syncQueued = requestAnimationFrame(() => { syncQueued = 0; if (!current) sync(); }); };
  ['input', 'change', 'click'].forEach(type => document.addEventListener(type, e => { if (!root.contains(e.target)) queueSync(); }, true));
  mirror(layerHint, () => { const t = layerHint?.textContent.trim(); if (t) setHint(t); }, { childList: true, characterData: true, subtree: true });
  mirror(layerMove, syncMove, { attributes: true, attributeFilter: ['aria-pressed'] });
  mirror($('lyricsTimingValue'), syncTiming, { childList: true, characterData: true, subtree: true });
  mirror(gallery(), effectMenu.refresh, { attributes: true, attributeFilter: ['class'], subtree: true, childList: true });
  window.addEventListener('kefe-style-change', sync);
  document.addEventListener('kefe-effect-change', sync);
  document.addEventListener('DOMContentLoaded', sync, { once: true });
  window.addEventListener('kefe-shell-ready', () => { sync(); queueDock(); });
  window.addEventListener('load', () => { sync(); queueDock(); });

  moveBtn.addEventListener('click', () => { layerMove?.click(); requestAnimationFrame(syncMove); emit('move-tool', true); });
  lockBtn.addEventListener('click', () => { layerDefault?.click(); flash(lockBtn); emit('lock-default', true); });
  lyricsBtn.addEventListener('click', () => {
    const s = lyricsSwitch(); if (!s) return;
    s.click();
    const on = s.getAttribute('aria-checked') !== 'false';
    lyricsBtn.setAttribute('aria-pressed', String(on));
    lyricsBtn.dataset.tip = on ? 'Lyrics on · click to hide' : 'Lyrics off · click to show';
    emit('lyrics', on);
  });
  fullBtn.addEventListener('click', () => fullscreenButton()?.click());
  expandBtn.addEventListener('click', () => {
    const open = tray.hidden;
    closePopover(false);
    tray.hidden = !open;
    expandBtn.setAttribute('aria-expanded', String(open));
    expandBtn.querySelector('svg').style.transform = open ? 'rotate(180deg)' : '';
    if (open) sync();
    queueDock(true);
  });
  root.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !current && !tray.hidden) { expandBtn.click(); expandBtn.focus({ preventScroll: true }); }
  });

  /* ───────── Position, docking, dragging ───────── */
  const STORE = 'kefe.floating-toolbar.position.v4';
  const mobile = window.matchMedia('(max-width: 760px)');
  let pos = { x: 12, y: 12 }, custom = false, dragging = null;
  try {
    ['kefe.floating-toolbar.position.v1', 'kefe.floating-toolbar.position.v2', 'kefe.floating-toolbar.position.v3'].forEach(k => localStorage.removeItem(k));
    const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) { pos = saved; custom = true; }
  } catch (_) {}
  const clampPos = (x, y) => ({
    x: clamp(x, 8, Math.max(8, window.innerWidth - root.offsetWidth - 8)),
    y: clamp(y, 8, Math.max(8, window.innerHeight - root.offsetHeight - 8))
  });
  function defaultPos() {
    const w = root.offsetWidth, hgt = root.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
    const dockEl = document.querySelector('.kefe-workspace-dock');
    let dockTop = vh;
    if (dockEl && getComputedStyle(dockEl).display !== 'none') {
      const d = dockEl.getBoundingClientRect();
      if (d.height > 0 && d.top > vh * 0.5) dockTop = d.top;
    }
    const s = stage.getBoundingClientRect();
    if (!s.width || !s.height) return { x: (vw - w) / 2, y: 8 };
    return { x: s.left + (s.width - w) / 2, y: s.top - hgt - 10 };
  }
  function apply() {
    tray.style.maxHeight = Math.max(160, window.innerHeight - main.offsetHeight - 28) + 'px';
    pos = clampPos(pos.x, pos.y);
    root.style.left = pos.x + 'px'; root.style.top = pos.y + 'px';
  }
  function dock(keepBottom) {
    if (!custom) pos = defaultPos();
    apply();
    // Expanding must never push the tray off-screen: apply() already clamps; also leave room for the bar itself.
    if (keepBottom) apply();
  }
  let dockQueued = 0;
  function queueDock(keepBottom) { if (dockQueued) return; dockQueued = requestAnimationFrame(() => { dockQueued = 0; dock(keepBottom); }); }

  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(pos)); } catch (_) {} };
  grip.addEventListener('pointerdown', e => {
    if (lockPos.getAttribute('aria-pressed') === 'true' || (e.button !== 0 && e.pointerType === 'mouse')) return;
    e.preventDefault();
    closePopover(false); tip.hidden = true;
    const r = root.getBoundingClientRect();
    dragging = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top };
    grip.setPointerCapture?.(e.pointerId);
    root.classList.add('is-dragging');
  });
  grip.addEventListener('pointermove', e => {
    if (!dragging || e.pointerId !== dragging.id) return;
    custom = true;
    pos = clampPos(e.clientX - dragging.dx, e.clientY - dragging.dy);
    root.style.left = pos.x + 'px'; root.style.top = pos.y + 'px';
  });
  const stopDrag = e => {
    if (!dragging || (e && e.pointerId !== dragging.id)) return;
    dragging = null; root.classList.remove('is-dragging');
    if (custom) { save(); emit('position', pos); }
  };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => grip.addEventListener(t, stopDrag));
  grip.addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(e.key) || lockPos.getAttribute('aria-pressed') === 'true') return;
    e.preventDefault();
    if (e.key === 'Home') { redock(); return; }
    const step = e.shiftKey ? 24 : 6;
    custom = true;
    pos = { x: pos.x + (e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0), y: pos.y + (e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0) };
    apply(); save(); emit('position', pos);
  });
  function redock() {
    custom = false;
    try { localStorage.removeItem(STORE); } catch (_) {}
    dock(); emit('reset-position', pos);
  }
  grip.addEventListener('dblclick', redock);

  window.addEventListener('resize', () => queueDock());
  if (window.ResizeObserver) { const ro = new ResizeObserver(() => queueDock()); ro.observe(stage); ro.observe(document.documentElement); ro.observe(root); }
  mobile.addEventListener?.('change', () => queueDock());

  sync();
  dock();
  emit('ready', true);
})();
