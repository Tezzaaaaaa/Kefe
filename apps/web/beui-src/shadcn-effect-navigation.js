/* The preview's effect arrows become shadcn Buttons without replacing nodes.
   This is separate from the protected Find Your Song carousel. */
import * as React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Button } from '../components/ui/button.js';

function start() {
  const nav = document.querySelector('.kefe-lyric-effect-preview-nav');
  if (!nav || nav.dataset.shadcnHydrated || nav.children.length !== 3) return;
  const [previous, status, next] = nav.children;
  if (!previous.matches('button.kefe-lyric-effect-preview-button') || !status.matches('span.kefe-lyric-effect-preview-count') || !next.matches('button.kefe-lyric-effect-preview-button')) return;
  const arrow = (button, key) => {
    const className = button.className;
    button.className = `shad-btn shad-btn--ghost shad-btn--icon ${className}`.replace(/\s+/g, ' ').trim();
    button.dataset.slot = 'button'; button.dataset.variant = 'ghost'; button.dataset.size = 'icon';
    const props = {};
    for (const { name, value } of button.attributes) {
      if (!['class', 'data-slot', 'data-variant', 'data-size'].includes(name)) props[name] = name === 'disabled' || name === 'hidden' ? true : value;
    }
    return React.createElement(Button, { key, variant: 'ghost', size: 'icon', className, ...props }, button.textContent);
  };
  const children = [arrow(previous, 'previous'), React.createElement('span', {
    key: 'status', className: status.className, 'aria-live': status.getAttribute('aria-live'),
  }, status.textContent), arrow(next, 'next')];
  flushSync(() => hydrateRoot(nav, React.createElement(React.Fragment, null, ...children)));
  nav.dataset.shadcnHydrated = 'true';
}
if (document.readyState === 'complete') start();
else window.addEventListener('load', start, { once: true });
