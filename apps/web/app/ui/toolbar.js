/* KEFE default floating lyric toolbar. Bridges existing editor controls rather than duplicating editor state. */
(() => {
  'use strict';
  const stage = document.querySelector('.kefe-stage');
  if (!stage || document.getElementById('kefeFloatingToolbar')) return;

  const svg = {
    grip: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="16" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="8" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="16" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="8" cy="18" r="1" fill="currentColor" stroke="none"/><circle cx="16" cy="18" r="1" fill="currentColor" stroke="none"/></svg>',
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
    reset: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11a9 9 0 1 1 2.6 6.4M3 4v7h7"/></svg>',
    full: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M21 16v5h-5"/></svg>',
    lyrics: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h11M4 18h8"/></svg>'
  };
  const el = (tag, cls, label) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (label) node.setAttribute('aria-label', label);
    return node;
  };
  const button = (name, icon, title) => {
    const node = el('button', 'kefe-floating-toolbar__button', title);
    node.type = 'button'; node.title = title; node.innerHTML = icon;
    return node;
  };
  const divider = () => el('span', 'kefe-floating-toolbar__divider');
  const toolbar = el('div', 'kefe-floating-toolbar');
  toolbar.id = 'kefeFloatingToolbar';
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', 'Floating lyric editor toolbar');
  toolbar.addEventListener('pointerdown', event => {
    if (!event.target.closest?.('.kefe-floating-toolbar__popover, .kefe-floating-toolbar__menu-trigger')) closePopovers();
    event.stopPropagation();
  });

  const grip = button('drag', svg.grip, 'Drag toolbar to reposition');
  grip.className = 'kefe-floating-toolbar__grip';
  grip.setAttribute('aria-label', 'Drag toolbar to reposition');
  grip.innerHTML = svg.grip + '<span>DRAG</span>';
  grip.setAttribute('aria-describedby', 'kefeToolbarHelp');
  const help = el('span', 'kefe-floating-toolbar__status');
  help.id = 'kefeToolbarHelp'; help.textContent = 'Drag to move. Use arrow keys to nudge.';

  const effect = el('select', 'kefe-floating-toolbar__control kefe-floating-toolbar__select', 'Lyric effect');
  effect.setAttribute('aria-label', 'Lyric effect');
  effect.add(new Option('Effect', ''));
  const font = el('select', 'kefe-floating-toolbar__control kefe-floating-toolbar__select', 'Lyric font');
  font.setAttribute('aria-label', 'Lyric font');
  font.add(new Option('Effect font', ''));
  const aspect = el('select', 'kefe-floating-toolbar__control kefe-floating-toolbar__select', 'Canvas ratio');
  aspect.setAttribute('aria-label', 'Canvas ratio');
  [['16:9','16:9'],['9:16','9:16'],['1:1','1:1']].forEach(([label,value]) => aspect.add(new Option(label,value)));
  const color = el('input', 'kefe-floating-toolbar__color', 'Lyric text colour');
  color.type = 'color'; color.value = '#ffffff'; color.setAttribute('aria-label', 'Lyric text colour');
  const colorValue = el('output', 'kefe-floating-toolbar__color-value');
  colorValue.textContent = color.value.toUpperCase();
  const colorField = el('label', 'kefe-floating-toolbar__color-field', 'Text colour');
  const colorName = el('span', 'kefe-floating-toolbar__color-name');
  colorName.textContent = 'Text';
  colorField.append(colorName, color, colorValue);
  const sizeLabel = el('label', 'kefe-floating-toolbar__label', 'Size');
  const size = el('input', 'kefe-floating-toolbar__size');
  size.type = 'range'; size.min = '50'; size.max = '160'; size.step = '1'; size.value = '100';
  size.setAttribute('aria-label', 'Lyric text size');
  sizeLabel.appendChild(size);
  const lyrics = button('lyrics', svg.lyrics, 'Toggle lyrics');
  lyrics.setAttribute('aria-pressed', 'true');
  const locked = button('lock', svg.lock, 'Lock toolbar position');
  locked.setAttribute('aria-pressed', 'false');
  const status = el('span', 'kefe-floating-toolbar__status');
  status.setAttribute('role','status'); status.setAttribute('aria-live','polite');

  const layerTargetLabel = el('label', 'kefe-floating-toolbar__layer-label');
  layerTargetLabel.append(document.createTextNode('Adjust '));
  const layerTarget = el('select', 'kefe-floating-toolbar__control kefe-floating-toolbar__select');
  layerTarget.setAttribute('data-layout-target', '');
  layerTarget.setAttribute('aria-label', 'Adjust selected layer');
  layerTarget.add(new Option('Lyrics', 'lyrics'));
  layerTarget.add(new Option('Album artwork + title', 'card'));
  layerTargetLabel.appendChild(layerTarget);
  const layerScaleLabel = el('label', 'kefe-floating-toolbar__layer-label');
  layerScaleLabel.append(document.createTextNode('Layer size '));
  const layerScale = el('input', 'kefe-floating-toolbar__layer-size');
  layerScale.type = 'range'; layerScale.min = '50'; layerScale.max = '200'; layerScale.step = '1'; layerScale.value = '100';
  layerScale.setAttribute('data-layout-scale', '');
  layerScale.setAttribute('aria-label', 'Selected layer size');
  layerScaleLabel.appendChild(layerScale);
  const layerMove = button('move-layer', '', 'Move selected layer in preview');
  layerMove.textContent = 'Move layer'; layerMove.classList.add('kefe-floating-toolbar__text-button');
  layerMove.setAttribute('data-layout-move', ''); layerMove.setAttribute('aria-pressed', 'false');
  const layerReset = button('reset-layer', svg.reset, 'Reset selected layer');
  layerReset.classList.add('kefe-floating-toolbar__text-button'); layerReset.setAttribute('data-layout-reset', '');
  const saveDefault = button('save-default', '', 'Save current effect look and behaviour as default');
  saveDefault.textContent = 'Lock as default'; saveDefault.classList.add('kefe-floating-toolbar__text-button'); saveDefault.setAttribute('data-effect-default', '');
  const clearDefault = button('clear-default', '', 'Clear saved default for current effect');
  clearDefault.textContent = 'Unlock default'; clearDefault.classList.add('kefe-floating-toolbar__text-button'); clearDefault.setAttribute('data-effect-default-clear', '');
  const layerHint = el('span', 'kefe-floating-toolbar__hint');
  layerHint.setAttribute('data-layout-hint', ''); layerHint.setAttribute('role', 'status');
  layerHint.textContent = 'Move a layer, adjust size, then lock this effect’s defaults';

  const primary = el('div', 'kefe-floating-toolbar__primary');
  const advanced = el('div', 'kefe-floating-toolbar__advanced');
  advanced.id = 'kefeToolbarAdvanced';
  advanced.hidden = true;
  const more = el('button', 'kefe-floating-toolbar__button kefe-floating-toolbar__more', 'Show more toolbar controls');
  more.type = 'button';
  more.textContent = 'See more';
  more.setAttribute('aria-expanded', 'false');
  more.setAttribute('aria-controls', advanced.id);
  const moreIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>';
  more.innerHTML = 'See more ' + moreIcon;

  const menuTrigger = (label, key) => {
    const node = el('button', 'kefe-floating-toolbar__button kefe-floating-toolbar__menu-trigger', label);
    node.type = 'button'; node.textContent = label; node.setAttribute('aria-expanded', 'false');
    node.setAttribute('aria-controls', 'kefeToolbar' + key + 'Popover'); return node;
  };
  const colorTrigger = menuTrigger('Colour', 'Colour');
  colorTrigger.classList.add('kefe-floating-toolbar__color-trigger');
  colorTrigger.innerHTML = '<span class="kefe-floating-toolbar__color-chip" aria-hidden="true"></span>';
  colorTrigger.setAttribute('aria-label', 'Colour');
  const makePopover = (key, title) => {
    const pop = el('section', 'kefe-floating-toolbar__popover'); pop.id = 'kefeToolbar' + key + 'Popover'; pop.hidden = true;
    pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', title);
    const head = el('div', 'kefe-floating-toolbar__popover-head'); head.appendChild(el('strong', '', title));
    const close = el('button', 'kefe-floating-toolbar__popover-close', 'Close ' + title); close.type = 'button'; close.textContent = '×';
    close.addEventListener('click', () => closePopover(pop, true)); head.appendChild(close); pop.appendChild(head); return pop;
  };
  const colorPopover = makePopover('Colour', 'Text colour');
  colorPopover.appendChild(colorField);
  const hexField = el('label', 'kefe-floating-toolbar__hex-field', 'Hex');
  const hexInput = el('input', 'kefe-floating-toolbar__hex-input');
  hexInput.type = 'text'; hexInput.value = color.value.toUpperCase(); hexInput.maxLength = 7; hexInput.autocomplete = 'off'; hexInput.spellcheck = false;
  hexInput.setAttribute('aria-label', 'Text colour hex value'); hexField.appendChild(hexInput); colorPopover.appendChild(hexField);
  const palette = el('div', 'kefe-floating-toolbar__palette'); palette.setAttribute('role', 'group'); palette.setAttribute('aria-label', 'Preset text colours');
  [['#FFFFFF','White'],['#B9A5FF','Lavender'],['#FFB7D5','Rose'],['#A7E7FF','Ice blue'],['#C8F7B8','Mint'],['#FFD58A','Amber'],['#F3A5FF','Orchid'],['#171719','Near black']].forEach(([value, label]) => {
    const swatch = el('button', 'kefe-floating-toolbar__swatch', label); swatch.type = 'button';
    swatch.style.setProperty('--swatch-color', value); swatch.setAttribute('aria-label', label + ' ' + value);
    swatch.setAttribute('aria-pressed', String(color.value.toUpperCase() === value));
    swatch.addEventListener('click', () => { color.value = value.toLowerCase(); color.dispatchEvent(new Event('input', { bubbles: true })); hexInput.value = value; });
    palette.appendChild(swatch);
  });
  colorPopover.appendChild(palette);
  const moveIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20M2 12h20M8 6l4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4M18 8l4 4-4 4"/></svg>';
  const visualiserIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12h2l2-6 4 12 4-12 2 6h6"/></svg>';
  layerMove.innerHTML = moveIcon;
  layerMove.classList.remove('kefe-floating-toolbar__text-button');
  layerReset.innerHTML = svg.reset;
  layerReset.classList.remove('kefe-floating-toolbar__text-button');
  const timing = el('div', 'kefe-floating-toolbar__timing');
  const timingEarlier = button('timing-earlier', '', 'Move lyrics 0.10 seconds earlier');
  timingEarlier.textContent = '−';
  const timingValue = el('output', 'kefe-floating-toolbar__timing-value');
  timingValue.setAttribute('aria-live', 'polite');
  const timingLater = button('timing-later', '', 'Move lyrics 0.10 seconds later');
  timingLater.textContent = '+';
  timing.append(timingEarlier, timingValue, timingLater);
  const visualiser = button('visualiser', visualiserIcon, 'Open visualiser controls');
  visualiser.setAttribute('aria-label', 'Open visualiser controls');
  const advancedGroups = el('div', 'kefe-floating-toolbar__advanced-grid');
  const group = (title, ...children) => {
    const node = el('section', 'kefe-floating-toolbar__group');
    const heading = el('h3', 'kefe-floating-toolbar__group-title');
    heading.textContent = title;
    node.appendChild(heading);
    children.forEach(child => node.appendChild(child));
    return node;
  };
  const styleGroup = group('Text style', sizeLabel, lyrics, saveDefault, clearDefault);
  const layerGroup = group('Layer', layerTargetLabel, layerScaleLabel, layerHint);
  const ratioGroup = group('Canvas ratio', aspect);
  advancedGroups.append(styleGroup, layerGroup, ratioGroup);
  primary.append(grip, divider(), layerMove, layerReset, locked, divider(), font, colorTrigger, effect, divider(), timing, divider(), visualiser, divider(), more);
  advanced.append(advancedGroups, help, status);
  toolbar.replaceChildren(primary, advanced);
  const popoverPairs = [[colorTrigger, colorPopover]];
  function closePopover(pop, restoreFocus) {
    if (!pop || pop.hidden) return; pop.hidden = true;
    const pair = popoverPairs.find(item => item[1] === pop);
    if (pair) { pair[0].setAttribute('aria-expanded', 'false'); if (restoreFocus) pair[0].focus({ preventScroll: true }); }
  }
  function closePopovers() { popoverPairs.forEach(([, pop]) => closePopover(pop, false)); }
  function placePopover(pop, trigger) {
    pop.style.visibility = 'hidden'; pop.hidden = false;
    const tr = trigger.getBoundingClientRect(), pr = pop.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
    const maxLeft = Math.max(8, viewportWidth - pr.width - 8);
    const left = Math.max(8, Math.min(maxLeft, tr.left));
    const below = tr.bottom + 8;
    const preferredTop = below + pr.height <= viewportHeight - 8 ? below : tr.top - pr.height - 8;
    const maxTop = Math.max(8, viewportHeight - pr.height - 8);
    const top = Math.max(8, Math.min(maxTop, preferredTop));
    pop.style.left = left + 'px'; pop.style.top = top + 'px'; pop.style.visibility = '';
  }
  popoverPairs.forEach(([trigger, pop]) => trigger.addEventListener('click', () => {
    const opening = pop.hidden; closePopovers(); if (!opening) return;
    if (pop === colorPopover) {
      const style = styleState();
      if (style && /^#[0-9a-f]{6}$/i.test(style.textColor || '')) color.value = style.textColor;
      colorValue.textContent = color.value.toUpperCase();
      hexInput.value = color.value.toUpperCase();
      palette.querySelectorAll('.kefe-floating-toolbar__swatch').forEach(swatch => swatch.setAttribute('aria-pressed', String(swatch.style.getPropertyValue('--swatch-color').toUpperCase() === color.value.toUpperCase())));
    }
    trigger.setAttribute('aria-expanded', 'true'); placePopover(pop, trigger);
    pop.querySelector('input, select, button')?.focus({ preventScroll: true });
  }));
  document.addEventListener('pointerdown', event => {
    if (event.target.closest?.('.kefe-floating-toolbar__popover, .kefe-floating-toolbar__menu-trigger, #kefeFloatingToolbar')) return;
    closePopovers();
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return; const open = popoverPairs.find(([, pop]) => !pop.hidden); if (!open) return;
    event.preventDefault(); closePopover(open[1], true);
  });
  window.addEventListener('resize', () => { const open = popoverPairs.find(([, pop]) => !pop.hidden); if (open) placePopover(open[1], open[0]); });
  more.addEventListener('click', () => {
    const expanded = more.getAttribute('aria-expanded') !== 'true';
    advanced.hidden = !expanded;
    more.setAttribute('aria-expanded', String(expanded));
    more.innerHTML = (expanded ? 'See less ' : 'See more ') + moreIcon;
    more.setAttribute('aria-label', expanded ? 'Show fewer toolbar controls' : 'Show more toolbar controls');
    applyPosition();
  });

  document.body.appendChild(toolbar);
  document.body.appendChild(colorPopover);
  document.dispatchEvent(new Event('kefe-layout-controls-ready'));

  const existingEffectGallery = document.getElementById('lyricEffectOptions');
  const existingFont = document.getElementById('fontOverride');
  const existingAspect = document.getElementById('kefeAspect');
  const existingFullscreen = document.getElementById('previewFullscreen');
  const existingLyrics = document.getElementById('lyricsEnabledToggle');
  const styleState = () => window.kefeStyle?.state?.() || null;
  const applyStyleState = patch => {
    const current = styleState();
    if (!current || typeof window.kefeStyle?.applyState !== 'function') return false;
    window.kefeStyle.applyState({ ...current, ...patch });
    return true;
  };

  function emit(action, value) {
    window.dispatchEvent(new CustomEvent('kefe-toolbar-change', { detail: { action, value, source: 'floating-toolbar' } }));
  }
  function fillOptions() {
    if (existingEffectGallery) {
      existingEffectGallery.querySelectorAll('[data-effect]').forEach(item => {
        if (!effect.querySelector('option[value="' + CSS.escape(item.dataset.effect) + '"]')) {
          effect.add(new Option(item.querySelector('.kefe-lyric-effect-name')?.textContent.trim() || item.dataset.effect, item.dataset.effect));
        }
      });
      const active = existingEffectGallery.querySelector('[data-effect].active');
      if (active) effect.value = active.dataset.effect;
    }
    if (existingFont) {
      font.replaceChildren(new Option('Effect font', ''));
      Array.from(existingFont.options).forEach(option => {
        if (!Array.from(font.options).some(candidate => candidate.value === option.value)) font.add(new Option(option.textContent, option.value));
      });
      font.value = existingFont.value;
    }
    if (existingAspect) aspect.value = existingAspect.value;
    const style = styleState();
    if (style) {
      color.value = /^#[0-9a-f]{6}$/i.test(style.textColor || '') ? style.textColor : '#ffffff';
      colorValue.textContent = color.value.toUpperCase();
      size.value = String(Number(style.scale) || 100);
    }
    const swatch = colorTrigger.querySelector('.kefe-floating-toolbar__color-chip');
    if (swatch) swatch.style.background = color.value;
    timingValue.textContent = document.getElementById('lyricsTimingValue')?.textContent?.trim() || ((Number(window.kefeSettings?.get('lyricOffset')) || 0).toFixed(2) + 's');
  }
  fillOptions();
  document.addEventListener('DOMContentLoaded', fillOptions, { once: true });

  effect.addEventListener('change', () => {
    const target = existingEffectGallery?.querySelector('[data-effect="' + CSS.escape(effect.value) + '"]');
    if (target) target.click();
    emit('effect', effect.value);
  });
  font.addEventListener('change', () => {
    if (!existingFont) return;
    existingFont.value = font.value;
    existingFont.dispatchEvent(new Event('change', { bubbles: true }));
    emit('font', font.value);
  });
  aspect.addEventListener('change', () => {
    if (!existingAspect) return;
    existingAspect.value = aspect.value;
    existingAspect.dispatchEvent(new Event('change', { bubbles: true }));
    emit('aspect', aspect.value);
  });
  color.addEventListener('input', () => {
    if (!applyStyleState({ textColor: color.value })) { status.textContent = 'Lyric style controls are still loading.'; return; }
    colorValue.textContent = color.value.toUpperCase();
    const swatch = colorTrigger.querySelector('.kefe-floating-toolbar__color-chip');
    if (swatch) swatch.style.background = color.value;
    hexInput.value = color.value.toUpperCase();
    palette.querySelectorAll('.kefe-floating-toolbar__swatch').forEach(swatch => swatch.setAttribute('aria-pressed', String(swatch.style.getPropertyValue('--swatch-color').toUpperCase() === color.value.toUpperCase())));
    emit('text-colour', color.value);
  });
  hexInput.addEventListener('change', () => {
    const value = hexInput.value.trim();
    if (!/^#[0-9a-f]{6}$/i.test(value)) { hexInput.value = color.value.toUpperCase(); status.textContent = 'Enter a valid six-digit hex colour, such as #B9A5FF.'; return; }
    color.value = value.toLowerCase(); color.dispatchEvent(new Event('input', { bubbles: true }));
  });
  size.addEventListener('input', () => {
    if (!applyStyleState({ scale: Number(size.value) })) { status.textContent = 'Lyric style controls are still loading.'; return; }
    emit('text-size', Number(size.value));
  });
  lyrics.addEventListener('click', () => {
    if (!existingLyrics) return;
    existingLyrics.click();
    const on = existingLyrics.getAttribute('aria-checked') === 'true';
    lyrics.setAttribute('aria-pressed', String(on));
    lyrics.title = on ? 'Turn lyrics off' : 'Turn lyrics on';
    emit('lyrics', on);
  });
  timingEarlier.addEventListener('click', () => {
    document.getElementById('lyricsTimingEarlier')?.click();
    window.setTimeout(() => { timingValue.textContent = document.getElementById('lyricsTimingValue')?.textContent?.trim() || ((Number(window.kefeSettings?.get('lyricOffset')) || 0).toFixed(2) + 's'); }, 0);
  });
  timingLater.addEventListener('click', () => {
    document.getElementById('lyricsTimingLater')?.click();
    window.setTimeout(() => { timingValue.textContent = document.getElementById('lyricsTimingValue')?.textContent?.trim() || ((Number(window.kefeSettings?.get('lyricOffset')) || 0).toFixed(2) + 's'); }, 0);
  });
  visualiser.addEventListener('click', () => {
    const nav = Array.from(document.querySelectorAll('.beui-sidebar-nav-host button, .kefe-sidebar-nav button, [data-panel]'))
      .find(node => /visualisers/i.test((node.textContent || '') + ' ' + (node.getAttribute('aria-label') || '') + ' ' + (node.getAttribute('data-panel') || '')));
    nav?.click();
  });
  locked.addEventListener('click', () => {
    const on = locked.getAttribute('aria-pressed') !== 'true';
    locked.setAttribute('aria-pressed', String(on));
    toolbar.classList.toggle('is-locked', on);
    locked.title = on ? 'Unlock toolbar position' : 'Lock toolbar position';
    locked.setAttribute('aria-label', locked.title);
    emit('lock', on);
  });

  const STORE = 'kefe.floating-toolbar.position.v2';
  const mobileViewport = window.matchMedia('(max-width: 760px)');
  const stageBounds = () => stage.getBoundingClientRect();
  const stageRect = stageBounds();
  const defaultPosition = {
    x: Math.max(8, stageRect.left + 12),
    y: Math.max(8, stageRect.top + 12)
  };
  let position = mobileViewport.matches
    ? { x: Math.max(8, stageRect.left + 8), y: Math.max(stageRect.top + 8, Math.min(stageRect.bottom - toolbar.offsetHeight - 8, window.innerHeight - toolbar.offsetHeight - 8)) }
    : { ...defaultPosition };
  let dragging = null;
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) position = saved;
  } catch (_) {}
  function clampPosition(x, y) {
    const maxX = Math.max(8, window.innerWidth - toolbar.offsetWidth - 8);
    const maxY = Math.max(8, window.innerHeight - toolbar.offsetHeight - 8);
    return { x: Math.max(8, Math.min(maxX, x)), y: Math.max(8, Math.min(maxY, y)) };
  }
  function applyPosition() {
    const p = clampPosition(position.x, position.y);
    position = p;
    toolbar.style.left = p.x + 'px'; toolbar.style.top = p.y + 'px';
    toolbar.style.right = 'auto'; toolbar.style.bottom = 'auto';
  }
  function savePosition() { try { localStorage.setItem(STORE, JSON.stringify(position)); } catch (_) {} }
  grip.addEventListener('pointerdown', event => {
    if (locked.getAttribute('aria-pressed') === 'true' || event.button !== 0) return;
    event.preventDefault();
    const rect = toolbar.getBoundingClientRect();
    dragging = { id: event.pointerId, dx: event.clientX - rect.left, dy: event.clientY - rect.top };
    grip.setPointerCapture?.(event.pointerId);
  });
  grip.addEventListener('pointermove', event => {
    if (!dragging || event.pointerId !== dragging.id) return;
    position = clampPosition(event.clientX - dragging.dx, event.clientY - dragging.dy);
    toolbar.style.left = position.x + 'px'; toolbar.style.top = position.y + 'px';
  });
  function stopDrag(event) {
    if (!dragging || (event && event.pointerId !== dragging.id)) return;
    dragging = null; savePosition(); emit('position', position);
  }
  grip.addEventListener('pointerup', stopDrag);
  grip.addEventListener('pointercancel', stopDrag);
  grip.addEventListener('lostpointercapture', stopDrag);
  grip.addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(event.key)) return;
    event.preventDefault();
    const step = event.shiftKey ? 20 : 5;
    if (event.key === 'Home') position = { ...defaultPosition };
    else { position.x += event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0; position.y += event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0; }
    applyPosition(); savePosition(); emit('position', position);
  });
  window.addEventListener('resize', () => {
    const bounds = stageBounds();
    if (mobileViewport.matches && (position.y < bounds.top || position.y > bounds.bottom)) {
      position.y = Math.max(bounds.top + 8, Math.min(bounds.bottom - toolbar.offsetHeight - 8, window.innerHeight - toolbar.offsetHeight - 8));
    }
    applyPosition();
  });
  document.addEventListener('kefe-effect-change', event => { if (event.detail?.effect) effect.value = event.detail.effect; });
  window.addEventListener('kefe-settings-change', () => { timingValue.textContent = document.getElementById('lyricsTimingValue')?.textContent?.trim() || ((Number(window.kefeSettings?.get('lyricOffset')) || 0).toFixed(2) + 's'); });
  existingFont?.addEventListener('change', () => { font.value = existingFont.value; });
  existingAspect?.addEventListener('change', () => { aspect.value = existingAspect.value; });
  existingLyrics?.addEventListener('click', () => lyrics.setAttribute('aria-pressed', existingLyrics.getAttribute('aria-checked') === 'true' ? 'true' : 'false'));
  window.addEventListener('kefe-style-change', fillOptions);
  applyPosition();
  emit('ready', true);
})();