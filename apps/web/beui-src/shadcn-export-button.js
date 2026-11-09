/* Hydrate the original export action so the recorder and focus restoration
   continue to use the same native button and listeners. */
import * as React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Button } from '../components/ui/button.js';
function mount() {
  const button = document.getElementById('exportButton');
  if (!button || !button.parentNode || button.dataset.shadcnHydrated) return;
  const className = button.className;
  const host = document.createElement('span');
  host.className = 'shad-export-button-host';
  button.parentNode.insertBefore(host, button);
  host.appendChild(button);
  button.className = `shad-btn shad-btn--primary ${className}`;
  button.dataset.slot = 'button'; button.dataset.variant = 'default'; button.dataset.size = 'default';
  flushSync(() => hydrateRoot(host, React.createElement(Button, {
    id: button.id, type: button.type, className,
    dangerouslySetInnerHTML: { __html: button.innerHTML },
  })));
  button.dataset.shadcnHydrated = 'true';
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
else mount();
