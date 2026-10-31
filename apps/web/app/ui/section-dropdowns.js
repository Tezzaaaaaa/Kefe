/* KEFE section dropdowns (shadcn/ui DropdownMenu look: radio items with a check, compact 32px rows).
   Each listed native <select> inside an editor panel stays the source of truth: the menu reads its options, writes
   its value and dispatches input/change, so presets, saved defaults and export keep working untouched. */
(() => {
  'use strict';
  const IDS = ['fontOverride', 'lyricCase', 'exportFormat', 'exportResolution'];
  let open = null, seq = 0;
  const chevron = '<svg class="kefe-dd-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  const check = '<svg class="kefe-dd-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
  const host = () => document.fullscreenElement || document.body;

  function close(focus) {
    if (!open) return;
    const { menu, trigger, onDoc } = open; open = null;
    menu.remove(); trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', onDoc, true);
    if (focus) trigger.focus({ preventScroll: true });
  }

  function enhance(select) {
    if (select.dataset.kefeDd === 'true' || !select.closest('.kefe-panel')) return;
    select.dataset.kefeDd = 'true';
    select.classList.add('kefe-dd-native');
    select.tabIndex = -1;
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'kefe-dd-trigger';
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-expanded', 'false');
    const text = document.createElement('span'); text.className = 'kefe-dd-text';
    trigger.append(text); trigger.insertAdjacentHTML('beforeend', chevron);
    // One wrapper keeps the select and its trigger together, so panel grouping (which sorts direct children) moves them as a unit.
    const wrap = document.createElement('div');
    wrap.className = 'kefe-dd';
    select.replaceWith(wrap);
    wrap.append(select, trigger);
    const label = () => select.getAttribute('aria-label') || select.labels?.[0]?.textContent?.trim() || select.id;
    const options = () => Array.from(select.options).filter(o => !o.disabled && !o.hidden);
    const refresh = () => {
      const o = select.selectedOptions[0];
      text.textContent = o ? o.textContent.trim() : 'Choose';
      trigger.setAttribute('aria-label', label() + ': ' + text.textContent);
      trigger.disabled = select.disabled;
    };

    function openMenu() {
      close(false);
      const list = options();
      const menu = document.createElement('div');
      menu.className = 'kefe-dd-menu'; menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', label()); menu.tabIndex = -1;
      let active = Math.max(0, list.findIndex(o => o.value === select.value));
      const items = list.map((o, i) => {
        const it = document.createElement('div');
        it.className = 'kefe-dd-item'; it.setAttribute('role', 'menuitemradio'); it.dataset.value = o.value;
        it.setAttribute('aria-checked', String(o.value === select.value));
        const t = document.createElement('span'); t.textContent = o.textContent.trim();
        it.append(t); it.insertAdjacentHTML('beforeend', check);
        it.addEventListener('pointermove', () => setActive(i));
        it.addEventListener('click', () => choose(i));
        menu.append(it); return it;
      });
      function setActive(i) { active = Math.max(0, Math.min(items.length - 1, i)); items.forEach((n, k) => n.classList.toggle('is-active', k === active)); items[active]?.scrollIntoView({ block: 'nearest' }); }
      function choose(i) {
        const o = list[i]; close(true);
        if (o && select.value !== o.value) { select.value = o.value; select.dispatchEvent(new Event('input', { bubbles: true })); select.dispatchEvent(new Event('change', { bubbles: true })); }
        refresh();
      }
      menu.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
        else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
        else if (e.key === 'End') { e.preventDefault(); setActive(items.length - 1); }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(active); }
        else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); close(true); }
      });
      host().appendChild(menu);
      const r = trigger.getBoundingClientRect(), vw = innerWidth, vh = innerHeight;
      const w = Math.max(r.width, 160);
      menu.style.width = w + 'px';
      menu.style.left = Math.max(8, Math.min(r.left, vw - w - 8)) + 'px';
      const below = vh - r.bottom - 10, above = r.top - 10, h = Math.min(menu.scrollHeight + 2, 320);
      const down = below >= Math.min(h, 180) || below >= above;
      menu.style.maxHeight = Math.max(120, Math.min(320, down ? below : above)) + 'px';
      menu.style[down ? 'top' : 'bottom'] = (down ? r.bottom + 6 : vh - r.top + 6) + 'px';
      const onDoc = e => { if (!menu.contains(e.target) && !trigger.contains(e.target)) close(false); };
      document.addEventListener('pointerdown', onDoc, true);
      open = { menu, trigger, onDoc };
      trigger.setAttribute('aria-expanded', 'true');
      setActive(active); menu.focus({ preventScroll: true });
    }
    trigger.addEventListener('click', () => { if (open && open.trigger === trigger) close(false); else openMenu(); });
    trigger.addEventListener('keydown', e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); openMenu(); } });
    select.addEventListener('change', refresh);
    new MutationObserver(refresh).observe(select, { childList: true, subtree: true, attributes: true });
    refresh();
  }

  const scan = () => IDS.forEach(id => { const s = document.getElementById(id); if (s) enhance(s); });
  window.addEventListener('resize', () => close(false));
  window.addEventListener('scroll', () => close(false), true);
  scan();
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
})();
