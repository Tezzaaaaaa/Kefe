/* Upgrade visualiser segmented controls, mode selectors, and preset grids to
   genuine Radix ToggleGroup components, standalone visualiser actions to shadcn
   Buttons, and visualiser control groups to Card surfaces while preserving the
   backing controls' native handlers and state. */
import * as React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { ToggleGroup, ToggleGroupItem } from '../components/ui/toggle-group.js';
import { Button } from '../components/ui/button.js';

const h = React.createElement;
const toggleRoots = new Map();

function itemValue(button, index) {
  return (
    button.dataset.preset ||
    button.dataset.fluidPreset ||
    button.dataset.mode ||
    button.dataset.scene ||
    button.dataset.value ||
    String(index)
  );
}

function isPressed(button) {
  return button.getAttribute('aria-pressed') === 'true' || button.classList.contains('primary');
}

function mountToggleGroup(native) {
  if (!(native instanceof HTMLElement) || !native.isConnected || native.dataset.shadcnToggleGroup) return;
  const buttons = Array.from(native.children).filter(node => node instanceof HTMLButtonElement);
  if (!buttons.length) return;

  const host = document.createElement('div');
  host.className = `shad-vis-toggle-host ${native.className}`.trim();
  host.dataset.shadcnVisToggleHost = 'true';
  native.after(host);
  native.hidden = true;
  native.dataset.shadcnBacking = 'true';
  native.dataset.shadcnToggleGroup = 'true';

  function VisualiserToggleGroup() {
    const [, redraw] = React.useReducer(v => v + 1, 0);

    React.useEffect(() => {
      const observer = new MutationObserver(redraw);
      observer.observe(native, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['aria-pressed', 'class', 'disabled', 'hidden'],
      });
      return () => observer.disconnect();
    }, []);

    const activeIdx = buttons.findIndex(isPressed);
    const value = activeIdx >= 0 ? itemValue(buttons[activeIdx], activeIdx) : '';

    return h(
      ToggleGroup,
      {
        type: 'single',
        variant: 'outline',
        size: 'sm',
        value,
        className: 'shad-visualiser-toggle-group',
        'aria-label': native.getAttribute('aria-label') || 'Visualiser options',
        onValueChange: next => {
          if (!next) return;
          const match = buttons.find((btn, idx) => itemValue(btn, idx) === next);
          if (match && !match.disabled) match.click();
        },
      },
      buttons.map((btn, idx) => {
        const val = itemValue(btn, idx);
        const pressed = isPressed(btn);
        const itemProps = {
          key: val,
          value: val,
          disabled: btn.disabled,
          'aria-pressed': String(pressed),
        };
        if (btn.dataset.preset) itemProps['data-preset'] = btn.dataset.preset;
        if (btn.dataset.scene) itemProps['data-scene'] = btn.dataset.scene;
        if (btn.dataset.value) itemProps['data-value'] = btn.dataset.value;
        return h(ToggleGroupItem, itemProps, btn.textContent.trim());
      })
    );
  }

  let root;
  flushSync(() => {
    root = createRoot(host);
    root.render(h(VisualiserToggleGroup));
  });
  toggleRoots.set(host, root);
}

function hydrateStandaloneButton(button) {
  if (!(button instanceof HTMLButtonElement) || !button.parentNode || button.dataset.shadcnHydrated || button.hasAttribute('data-slot')) return;
  if (button.closest('[data-shadcn-backing], [data-shadcn-vis-toggle-host], .kefe-vis-tabs, .kefe-fluid-palettes, .kefe-gradient-palettes, .shad-select-host, .kefe-select-host, .kefe-switch-host, .shad-slider-host, .kefe-dd, .shad-btn-host')) return;
  if (button.classList.contains('kefe-vis-option-power') || button.classList.contains('kefe-gradient-chip') || button.getAttribute('role') === 'switch') return;

  const host = document.createElement('span');
  host.className = 'shad-btn-host';
  button.parentNode.insertBefore(host, button);
  host.appendChild(button);

  const className = button.className.replace(/\bshad-btn(?:--\S+)?\b/g, '').replace(/\s+/g, ' ').trim();
  const variant = button.classList.contains('primary') ? 'default' : 'outline';
  button.className = `shad-btn shad-btn--${variant === 'outline' ? 'outline' : 'primary'} shad-btn--sm ${className}`.replace(/\s+/g, ' ').trim();
  button.dataset.slot = 'button';
  button.dataset.variant = variant;
  button.dataset.size = 'sm';

  const props = {};
  for (const attr of button.attributes) {
    if (['class', 'data-slot', 'data-variant', 'data-size'].includes(attr.name)) continue;
    props[attr.name] = attr.name === 'disabled' || attr.name === 'hidden' ? true : attr.value;
  }

  flushSync(() => {
    hydrateRoot(host, h(Button, {
      variant,
      size: 'sm',
      className,
      ...props,
      dangerouslySetInnerHTML: { __html: button.innerHTML },
    }));
  });
  button.dataset.shadcnHydrated = 'true';
}

function scan() {
  for (const [host, root] of toggleRoots) {
    if (!host.isConnected) {
      root.unmount();
      toggleRoots.delete(host);
    }
  }

  const visPanel = document.querySelector('[data-panel-view="visualiser"]');
  if (!visPanel) return;

  visPanel.querySelectorAll('.kefe-visualiser-control-group').forEach(group => {
    if (!group.dataset.shadcnCardMounted) {
      group.classList.add('shad-card');
      group.dataset.slot = 'card';
      group.dataset.shadcnCardMounted = 'true';
    }
  });

  visPanel.querySelectorAll(
    '.kefe-vis-view .kefe-seg, .kefe-fluted-modes, .kefe-liquid-glass-modes, .kefe-slow-light-scenes, .kefe-fluid-presets, .kefe-shader-vis-presets'
  ).forEach(mountToggleGroup);

  visPanel.querySelectorAll('.kefe-vis-view button').forEach(hydrateStandaloneButton);
}

function start() {
  scan();
  const visPanel = document.querySelector('[data-panel-view="visualiser"]');
  if (visPanel && typeof MutationObserver !== 'undefined') {
    new MutationObserver(scan).observe(visPanel, { childList: true, subtree: true });
  }
}

if (document.readyState === 'complete') start();
else window.addEventListener('load', start, { once: true });
