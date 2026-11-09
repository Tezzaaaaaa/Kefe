/* Hydrate the existing playback buttons with shadcn Button. The actual button
   elements are retained so the classic editor's listeners and references keep
   working, including while the transport moves into fullscreen. */
import * as React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Button } from '../components/ui/button.js';

function mountTransport() {
  const transport = document.querySelector('.kefe-transport');
  if (!transport || transport.dataset.shadcnHydrated || transport.children.length !== 2) return;
  const buttons = Array.from(transport.children);
  if (buttons[0].id !== 'playButton' || buttons[1].id !== 'restartButton') return;
  const elements = buttons.map((button, index) => {
    const variant = index === 0 ? 'default' : 'outline';
    const className = button.className;
    button.className = `shad-btn shad-btn--${variant === 'outline' ? 'outline' : 'primary'} ${className}`;
    button.dataset.slot = 'button';
    button.dataset.variant = variant;
    button.dataset.size = 'icon';
    return React.createElement(Button, {
      key: button.id, id: button.id, type: button.type, variant, size: 'icon', className,
      'aria-label': button.getAttribute('aria-label'), title: button.getAttribute('title'),
      dangerouslySetInnerHTML: { __html: button.innerHTML },
    });
  });
  // React hydration requires exact children; discard only formatting whitespace.
  Array.from(transport.childNodes).forEach(node => {
    if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) node.remove();
  });
  flushSync(() => hydrateRoot(transport, React.createElement(React.Fragment, null, ...elements)));
  transport.dataset.shadcnHydrated = 'true';
}
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountTransport, { once: true });
  else mountTransport();
}
