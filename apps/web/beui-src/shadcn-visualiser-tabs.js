/* The shadcn Tabs, Card and Switch gallery delegates to the original
   visualiser engines, including engines that register after the gallery mounts. */
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs.js';
import { Card, CardFooter } from '../components/ui/card.js';
import { Switch } from '../components/ui/switch.js';
const h = React.createElement;

const VISUALISER_PRESENTATION = {
  gradient: {
    name: "Fluid Ink",
    icon: "≈",
    art: "fluid",
    order: 0,
    description: "Ink blooms, swirls and folds through the frame with the track.",
  },
  "liquid-glass": {
    name: "Liquid Glass",
    icon: "◌",
    art: "liquid-glass",
    order: 1,
    description: "A frosted glass layer that breathes with bass and transparency.",
  },
  fluted: {
    name: "Glass Lens",
    icon: "◇",
    art: "glass-lens",
    order: 2,
    description: "A refracted glass lens over your artwork or background video.",
  },
  "slow-light": {
    name: "Slow Light",
    icon: "☼",
    art: "slow-light",
    order: 3,
    description: "Slow, grainy light fields that drift between cinematic scenes.",
  },
  "silk-road": {
    name: "Silk Road",
    icon: "≋",
    art: "silk-road",
    order: 4,
    description: "Volumetric silk folds moving through a deep, fogged space.",
  },
  "visuals-mix": {
    name: "Visuals Mix",
    icon: "❖",
    art: "visuals-mix",
    order: 5,
    description: "Seven visual scenes and four finishes, mixed with the audio.",
  },
  "apple-fx": {
    name: "Apple FX",
    icon: "◐",
    art: "apple-fx",
    order: 6,
    description: "Apple-event light trails and glass renders that move with the music.",
  },
};

/* After choosing an engine, bring its settings into view so the choice visibly does something. */
function revealSettings() {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const head = document.querySelector(".kefe-vis-settings-head");
    if (!head) return;
    const top = head.getBoundingClientRect().top;
    if (top > window.innerHeight * 0.6 || top < 60) head.scrollIntoView({ behavior: "smooth", block: "start" });
  }));
}

function cleanVisualiserLabel(button, fallback) {
  const raw =
    button.querySelector(".kefe-visualiser-tab-label")?.textContent ||
    button.textContent ||
    button.getAttribute("aria-label") ||
    button.title ||
    fallback;
  return (
    raw
      .replace(/^[^\p{L}\p{N}]+/u, "")
      .replace(/\s+visuali[sz]er$/i, "")
      .trim() || fallback
  );
}

function findNativePowerSwitch(backingButton) {
  return backingButton?.closest(".kefe-vis-option")?.querySelector(".kefe-switch") || null;
}

function mountVisualiserTabs() {
  const nav = document.querySelector('.kefe-vis-tabs');
  if (!nav || nav.dataset.shadMounted === 'true') return;
  const backingButtons = new Map();
  nav.querySelectorAll('button[role="tab"][data-visualiser]').forEach(button => {
    if (!button.classList.contains('kv-tab') && button.dataset.visualiser) backingButtons.set(button.dataset.visualiser, button);
  });
  if (!backingButtons.size) return;
  nav.dataset.shadMounted = 'true';
  nav.removeAttribute('role');

  const backingHost = document.createElement('div');
  backingHost.className = 'shad-vis-backing-controls';
  backingHost.hidden = true;
  backingHost.setAttribute('aria-hidden', 'true');
  const host = document.createElement('div');
  host.className = 'shad-vis-tabs-host';
  const root = createRoot(host);
  let activeValue = '', activating = false, pointerStartValue = null;
  const cards = new Map();

  function registerCard(backing, value) {
    if (!value || cards.has(value)) return false;
    backingButtons.set(value, backing);
    const option = backing.closest('.kefe-vis-option');
    if ((option || backing).parentNode !== backingHost) backingHost.appendChild(option || backing);
    const meta = VISUALISER_PRESENTATION[value] || {};
    const label = meta.name || cleanVisualiserLabel(backing, value);
    cards.set(value, {
      backing, label, description: meta.description || `${label} visualiser`,
      icon: meta.icon || backing.dataset.icon || '', art: meta.art || 'generic', order: meta.order ?? 99,
    });
    return true;
  }
  function activate(value) {
    const entry = cards.get(value);
    if (!entry) return;
    activeValue = value;
    activating = true;
    try {
      entry.backing.click();
      const power = findNativePowerSwitch(entry.backing);
      if (power && power.getAttribute('aria-checked') !== 'true') power.click();
    } finally { activating = false; }
    render();
    revealSettings();
  }
  function togglePower(value) {
    const entry = cards.get(value);
    const power = entry && findNativePowerSwitch(entry.backing);
    if (!power) return;
    activating = true;
    try {
      if (power.getAttribute('aria-checked') !== 'true') {
        activeValue = value;
        if (entry.backing.getAttribute('aria-selected') !== 'true') entry.backing.click();
      }
      power.click();
    } finally { activating = false; }
    render();
  }
  function render() {
    root.render(h(Tabs, { value: activeValue, activationMode: 'manual', onValueChange: activate, style: { display: 'contents' } },
      h(TabsList, { className: 'kv-grid kv-gallery', 'aria-label': 'Choose visualiser',
        onKeyDown: event => {
          if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
          const buttons = [...host.querySelectorAll('.kv-tab')];
          const index = buttons.indexOf(document.activeElement);
          if (index < 0) return;
          event.preventDefault();
          buttons[Math.max(0, Math.min(buttons.length - 1, index + (event.key === 'ArrowUp' ? -1 : 1)))]?.focus();
        },
      }, [...cards.entries()].map(([value, entry]) => {
        const selected = activeValue === value;
        const power = findNativePowerSwitch(entry.backing);
        const enabled = power?.getAttribute('aria-checked') === 'true';
        const action = `Turn ${entry.label} ${enabled ? 'off' : 'on'}`;
        return h(Card, { key: value, className: `kv-card${selected ? ' is-active' : ''}`, role: 'presentation',
          'data-visualiser': value, 'data-label': entry.label, 'data-state': selected ? 'active' : 'inactive', hidden: entry.backing.hidden, style: { order: String(entry.order) } },
          h(TabsTrigger, { value, className: 'kv-tab', disabled: entry.backing.disabled, 'data-visualiser': value, title: `${entry.label} visualiser`,
            'aria-label': entry.label, 'aria-controls': entry.backing.getAttribute('aria-controls') || undefined,
            onMouseDown: () => { pointerStartValue = activeValue; },
            // A selected card may have its power switched off; selecting it
            // again must turn it back on without double-activating a new card.
            onClick: event => {
              event.stopPropagation();
              if (event.detail === 0 || pointerStartValue === value) activate(value);
              pointerStartValue = null;
            },
          }, h('span', { className: 'kv-preview', 'data-art': entry.art, 'aria-hidden': 'true' }, h('span', { className: 'kv-preview-icon' }, entry.icon)),
          h('span', { className: 'kv-body' }, h('span', { className: 'kv-label' }, entry.label), h('span', { className: 'kv-desc' }, entry.description))),
          h(CardFooter, { className: 'kv-card-foot' },
            h('span', { className: 'kv-card-status' }, enabled ? 'On' : 'Off'),
            h(Switch, { checked: enabled, disabled: !power || power.disabled || entry.backing.disabled, 'aria-label': action, title: action, onCheckedChange: () => togglePower(value) })));
      }))));
  }
  backingButtons.forEach((backing, value) => registerCard(backing, value));
  flushSync(render);
  nav.prepend(host);
  nav.appendChild(backingHost);

  document.addEventListener('click', event => {
    if (activating) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest('.kv-tab')) return;
    const backingTab = target.closest('.shad-vis-backing-controls [role="tab"][data-visualiser]');
    if (backingTab) {
      if (backingTab.dataset.visualiser) activeValue = backingTab.dataset.visualiser;
      const power = findNativePowerSwitch(backingTab);
      if (power && power.getAttribute('aria-checked') !== 'true') queueMicrotask(() => {
        if (power.isConnected && power.getAttribute('aria-checked') !== 'true') {
          activating = true;
          try { power.click(); } finally { activating = false; }
        }
      });
      render();
      return;
    }
    const power = target.closest('.shad-vis-backing-controls .kefe-switch');
    if (power && power.getAttribute('aria-checked') !== 'true') {
      const tab = power.closest('.kefe-vis-option')?.querySelector('[role="tab"][data-visualiser]');
      if (tab && tab.getAttribute('aria-selected') !== 'true') {
        activating = true;
        try { tab.click(); } finally { activating = false; }
      }
    }
  }, true);

  const lateObserver = new MutationObserver(() => {
    let changed = false;
    nav.querySelectorAll('button[role="tab"][data-visualiser]').forEach(button => {
      if (button.classList.contains('kv-tab') || !button.dataset.visualiser) return;
      const option = button.closest('.kefe-vis-option');
      if (!cards.has(button.dataset.visualiser)) changed = registerCard(button, button.dataset.visualiser) || changed;
      else if (option && option.parentNode !== backingHost) backingHost.appendChild(option);
    });
    if (changed) render();
  });
  lateObserver.observe(nav, { childList: true });
  const syncBacking = () => {
    const selected = [...backingButtons.entries()].find(([, button]) => button.getAttribute('aria-selected') === 'true');
    if (selected) activeValue = selected[0];
    render();
  };
  new MutationObserver(syncBacking).observe(backingHost, { subtree: true, attributes: true, attributeFilter: ['aria-selected', 'aria-checked', 'class', 'disabled', 'hidden'] });
  // Autosave can restore an engine before this gallery is mounted. Preserve
  // the intentionally empty initial gallery when there is no saved project.
  window.kefeProjectAutosave?.ready?.then(() => {
    try {
      const snapshot = JSON.parse(localStorage.getItem('kefe.project.autosave.v1') || 'null');
      if (snapshot?.selections?.visualiser) syncBacking();
    } catch (_) { /* Storage may be unavailable. */ }
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('load', mountVisualiserTabs, { once: true });
  document.addEventListener('click', event => {
    if (event.target instanceof Element && event.target.closest('[data-shell-panel="visualiser"], .kefe-section[data-panel="visualiser"]')) {
      window.setTimeout(mountVisualiserTabs, 0);
    }
  });
  if (document.readyState === 'complete') mountVisualiserTabs();
}
