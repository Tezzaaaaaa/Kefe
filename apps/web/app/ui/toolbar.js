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
  toolbar.addEventListener('pointerdown', event => event.stopPropagation());
  toolbar.addEventListener('click', event => event.stopPropagation());

  const grip = button('drag', svg.grip, 'Drag toolbar to reposition');
  grip.className = 'kefe-floating-toolbar__grip';
  grip.setAttribute('aria-label', 'Drag toolbar to reposition');
  grip.innerHTML = svg.grip;
  grip.setAttribute('aria-describedby', 'kefeToolbarHelp');
  const help = el('span', 'kefe-floating-toolbar__status');
  help.id = 'kefeToolbarHelp'; help.textContent = 'Drag to move. Use arrow keys to nudge.';

  const effect = el('select', 'kefe-floating-toolbar__control kefe-floating-toolbar__select', 'Lyric effect');
  effect.setAttribute('aria-label', 'Lyric effect');
  effect.add(new Option('Lyric effect', ''));
  const font = el('select', 'kefe-floating-toolbar__control kefe-floating-toolbar__select', 'Lyric font');
  font.setAttribute('aria-label', 'Lyric font');
  font.add(new Option('Effect font', ''));
  const aspect = el('select', 'kefe-floating-toolbar__control kefe-floating-toolbar__select', 'Canvas ratio');
  aspect.setAttribute('aria-label', 'Canvas ratio');
  [['16:9','16:9'],['9:16','9:16'],['1:1','1:1']].forEach(([label,value]) => aspect.add(new Option(label,value)));
  const color = el('input', 'kefe-floating-toolbar__color', 'Lyric text colour');
  color.type = 'color'; color.value = '#ffffff'; color.setAttribute('aria-label', 'Lyric text colour');
  const sizeLabel = el('label', 'kefe-floating-toolbar__label', 'Size');
  const size = el('input', 'kefe-floating-toolbar__size');
  size.type = 'range'; size.min = '50'; size.max = '160'; size.step = '1'; size.value = '100';
  size.setAttribute('aria-label', 'Lyric text size');
  sizeLabel.appendChild(size);
  const lyrics = button('lyrics', svg.lyrics, 'Toggle lyrics');
  lyrics.setAttribute('aria-pressed', 'true');
  const fullscreen = button('fullscreen', svg.full, 'Toggle preview fullscreen');
  const locked = button('lock', svg.lock, 'Lock toolbar position');
  locked.setAttribute('aria-pressed', 'false');
  const reset = button('reset', svg.reset, 'Reset toolbar position');
  const status = el('span', 'kefe-floating-toolbar__status');
  status.setAttribute('role','status'); status.setAttribute('aria-live','polite');

  toolbar.append(grip, divider(), effect, font, color, sizeLabel, divider(), aspect, lyrics, fullscreen, locked, reset, help, status);
  stage.appendChild(toolbar);

  const existingEffectGallery = document.getElementById('lyricEffectOptions');
  const existingFont = document.getElementById('fontOverride');
  const existingAspect = document.getElementById('kefeAspect');
  const existingFullscreen = document.getElementById('previewFullscreen');
  const existingLyrics = document.getElementById('lyricsEnabledToggle');
  const styleColor = () => document.querySelector('#kefeStyleGroup input[type="color"]');
  const styleScale = () => document.querySelector('#kefeStyleGroup input[type="range"]');

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
    const colorInput = styleColor();
    if (colorInput) color.value = colorInput.value;
    const rangeInput = styleScale();
    if (rangeInput) size.value = rangeInput.value;
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
    const target = styleColor();
    if (!target) { status.textContent = 'Open Effects → Lyric style → Colour to enable custom text colour.'; return; }
    target.value = color.value;
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
    emit('text-colour', color.value);
  });
  size.addEventListener('input', () => {
    const target = styleScale();
    if (!target) { status.textContent = 'Open Effects → Lyric style → Size and placement to enable text sizing.'; return; }
    target.value = size.value;
    target.dispatchEvent(new Event('input', { bubbles: true }));
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
  fullscreen.addEventListener('click', () => existingFullscreen?.click());
  locked.addEventListener('click', () => {
    const on = locked.getAttribute('aria-pressed') !== 'true';
    locked.setAttribute('aria-pressed', String(on));
    toolbar.classList.toggle('is-locked', on);
    locked.title = on ? 'Unlock toolbar position' : 'Lock toolbar position';
    locked.setAttribute('aria-label', locked.title);
    emit('lock', on);
  });

  const STORE = 'kefe.floating-toolbar.position.v1';
  let position = { x: 12, y: 12 }, dragging = null;
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) position = saved;
  } catch (_) {}
  function clampPosition(x, y) {
    const stageRect = stage.getBoundingClientRect();
    const toolbarRect = toolbar.getBoundingClientRect();
    const maxX = Math.max(0, stageRect.width - toolbarRect.width - 8);
    const maxY = Math.max(0, stageRect.height - Math.min(toolbarRect.height, stageRect.height) - 8);
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
    const rect = stage.getBoundingClientRect();
    position = clampPosition(event.clientX - rect.left - dragging.dx, event.clientY - rect.top - dragging.dy);
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
    if (event.key === 'Home') position = { x: 12, y: 12 };
    else { position.x += event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0; position.y += event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0; }
    applyPosition(); savePosition(); emit('position', position);
  });
  reset.addEventListener('click', () => {
    position = { x: 12, y: 12 }; applyPosition(); savePosition(); emit('reset-position', position);
  });
  window.addEventListener('resize', applyPosition);
  document.addEventListener('kefe-effect-change', event => { if (event.detail?.effect) effect.value = event.detail.effect; });
  existingFont?.addEventListener('change', () => { font.value = existingFont.value; });
  existingAspect?.addEventListener('change', () => { aspect.value = existingAspect.value; });
  existingLyrics?.addEventListener('click', () => lyrics.setAttribute('aria-pressed', existingLyrics.getAttribute('aria-checked') === 'true' ? 'true' : 'false'));
  window.addEventListener('kefe-style-change', fillOptions);
  applyPosition();
  emit('ready', true);
})();