/* Hydrate the volume trigger in place. The original popover, slider bridge,
   native handlers and DOM identities remain owned by the existing editor. */
import * as React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Button } from '../components/ui/button.js';
function mount() {
  const group = document.querySelector('.kefe-volume-control');
  const button = document.getElementById('kefeMuteToggle');
  const popover = document.getElementById('kefeVolumePopover');
  if (!group || group.dataset.shadcnHydrated || group.children.length !== 2 || group.children[0] !== button || group.children[1] !== popover) return;
  const className = button.className;
  button.className = `shad-btn shad-btn--ghost ${className}`.trim();
  button.dataset.slot = 'button'; button.dataset.variant = 'ghost'; button.dataset.size = 'icon';
  const attributes = {};
  for (const attr of button.attributes) {
    if (!['class', 'data-slot', 'data-variant', 'data-size'].includes(attr.name)) attributes[attr.name] = attr.value;
  }
  const children = [
    React.createElement(Button, { key: 'button', variant: 'ghost', size: 'icon', className, ...attributes,
      dangerouslySetInnerHTML: { __html: button.innerHTML } }),
    React.createElement('div', { key: 'popover', id: popover.id, className: popover.className, hidden: popover.hidden,
      dangerouslySetInnerHTML: { __html: popover.innerHTML } }),
  ];
  Array.from(group.childNodes).forEach(node => {
    if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) node.remove();
  });
  flushSync(() => hydrateRoot(group, React.createElement(React.Fragment, null, ...children)));
  group.dataset.shadcnHydrated = 'true';
}
if (document.readyState === 'complete') mount();
else window.addEventListener('load', mount, { once: true });
