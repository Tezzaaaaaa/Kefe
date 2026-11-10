/* Hydrate stable lyric/export actions as shadcn Buttons. Native buttons remain
   the editor's event and disabled-state source; dynamic timing-row actions and
   the Find Your Song carousel are deliberately outside this bridge. */
import * as React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Button } from '../components/ui/button.js';

const selectors = [
  '#kefeAutoSync .kefe-download-row > button',
  '#kefeTimingEditor .kefe-timing-editor-actions > button',
  '#kefeTimingEditor > .kefe-download-row > button',
  '#kefeExportExtras .kefe-download-row > button',
  '#kefeExportExtras .kefe-review > button',
];
function mount(button) {
  if (button.dataset.shadcnHydrated || !button.parentNode) return;
  const variant = button.classList.contains('primary') ? 'default' : 'outline';
  const className = button.className.replace(/\s+/g, ' ').trim();
  const host = document.createElement('span');
  host.className = 'shad-lyric-action-host';
  button.parentNode.insertBefore(host, button);
  host.appendChild(button);
  button.className = `shad-btn shad-btn--${variant === 'outline' ? 'outline' : 'primary'} ${className}`.replace(/\s+/g, ' ').trim();
  button.dataset.slot = 'button'; button.dataset.variant = variant; button.dataset.size = 'default';
  const props = {};
  for (const attribute of button.attributes) {
    if (['class', 'data-slot', 'data-variant', 'data-size'].includes(attribute.name)) continue;
    props[attribute.name] = attribute.name === 'disabled' || attribute.name === 'hidden' ? true : attribute.value;
  }
  flushSync(() => hydrateRoot(host, React.createElement(Button, {
    variant, className, ...props, dangerouslySetInnerHTML: { __html: button.innerHTML },
  })));
  button.dataset.shadcnHydrated = 'true';
}
function start() { document.querySelectorAll(selectors.join(',')).forEach(mount); }
if (document.readyState === 'complete') start();
else window.addEventListener('load', start, { once: true });
