/* Convert remaining editor-panel actions to real shadcn Buttons while
   preserving each original button node and its native event listeners. */
import * as React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Button } from '../components/ui/button.js';

function mount(button) {
  if (!(button instanceof HTMLButtonElement) || !button.isConnected || button.dataset.shadcnHydrated) return;
  if (!button.classList.contains('kefe-panel-action')) return;
  const variant = button.classList.contains('primary') ? 'default' : 'outline';
  const size = button.textContent.trim() ? 'default' : 'icon';
  const className = button.className;
  const host = document.createElement('span');
  host.className = 'shad-panel-action-host';
  button.parentNode.insertBefore(host, button);
  host.appendChild(button);
  button.className = `shad-btn shad-btn--${variant === 'default' ? 'primary' : 'outline'} ${className}`.trim();
  button.dataset.slot = 'button';
  button.dataset.variant = variant;
  button.dataset.size = size;
  const props = {};
  for (const { name, value } of button.attributes) {
    if (['class', 'data-slot', 'data-variant', 'data-size', 'data-shadcn-hydrated'].includes(name)) continue;
    props[name] = ['disabled', 'hidden'].includes(name) ? true : value;
  }
  flushSync(() => hydrateRoot(host, React.createElement(Button, {
    variant, size, className, ...props,
    dangerouslySetInnerHTML: { __html: button.innerHTML },
  })));
  button.dataset.shadcnHydrated = 'true';
}
function scan(root = document) {
  if (root instanceof HTMLButtonElement) mount(root);
  root.querySelectorAll?.('.kefe-panel button.kefe-panel-action').forEach(mount);
}
window.kefeHydratePanelAction = mount;
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => scan(), { once: true });
else scan();
