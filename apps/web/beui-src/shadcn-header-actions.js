/* Hydrate header actions as shadcn Buttons where a wrapper is structurally safe.
   The stage fullscreen control stays in its canonical direct-child position. */
import * as React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Button } from '../components/ui/button.js';

function mountStandaloneButton(button, variant = 'ghost', size = 'default') {
  if (!button || button.dataset.shadcnHydrated || !button.parentNode) return;
  const className = button.className;
  const buttonVariant = variant === 'outline' ? 'outline' : variant === 'default' ? 'primary' : 'ghost';
  button.className = `shad-btn shad-btn--${buttonVariant} ${className}`.trim();
  button.dataset.slot = 'button';
  button.dataset.variant = variant;
  button.dataset.size = size;
  const host = document.createElement('span');
  host.className = 'shad-header-control-host';
  host.style.display = 'contents';
  button.parentNode.insertBefore(host, button);
  host.appendChild(button);
  const props = {};
  for (const attribute of button.attributes) {
    if (['class', 'data-slot', 'data-variant', 'data-size', 'data-shadcn-hydrated'].includes(attribute.name)) continue;
    const name = attribute.name === 'tabindex' ? 'tabIndex' : attribute.name;
    props[name] = ['disabled', 'hidden'].includes(name) ? true : attribute.value;
  }
  flushSync(() => hydrateRoot(host, React.createElement(Button, {
    variant, size, className, ...props,
    dangerouslySetInnerHTML: { __html: button.innerHTML },
  })));
  button.dataset.shadcnHydrated = 'true';
}

function mountHeaderActions() {
  const group = document.querySelector('.kefe-sidebar-bottom');
  if (group && !group.dataset.shadcnHydrated) {
    const buttons = Array.from(group.children);
    const ids = ['kefeResetButton', 'kefeSaveButton', 'kefeThemeToggle'];
    if (buttons.length === ids.length && buttons.every((button, index) => button.id === ids[index])) {
      const elements = buttons.map(button => {
        const className = button.className;
        button.className = `shad-btn shad-btn--ghost ${className}`;
        button.dataset.slot = 'button';
        button.dataset.variant = 'ghost';
        button.dataset.size = 'icon';
        const attributes = {};
        for (const attribute of button.attributes) {
          if (['class', 'data-slot', 'data-variant', 'data-size'].includes(attribute.name)) continue;
          attributes[attribute.name] = attribute.value;
        }
        return React.createElement(Button, {
          key: button.id, variant: 'ghost', size: 'icon', className, ...attributes,
          dangerouslySetInnerHTML: { __html: button.innerHTML },
        });
      });
      Array.from(group.childNodes).forEach(node => {
        if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) node.remove();
      });
      flushSync(() => hydrateRoot(group, React.createElement(React.Fragment, null, ...elements)));
      group.dataset.shadcnHydrated = 'true';
    }
  }
  mountStandaloneButton(document.querySelector('.kefe-header-settings[data-top-panel="settings"]'));
  const fullscreen = document.getElementById('previewFullscreen');
  if (fullscreen && !fullscreen.dataset.shadcnHydrated) {
    fullscreen.classList.add('shad-btn', 'shad-btn--ghost');
    fullscreen.dataset.slot = 'button';
    fullscreen.dataset.variant = 'ghost';
    fullscreen.dataset.size = 'icon';
    fullscreen.dataset.shadcnHydrated = 'true';
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountHeaderActions, { once: true });
else mountHeaderActions();
