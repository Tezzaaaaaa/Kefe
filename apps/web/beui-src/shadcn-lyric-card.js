/* Hydrate the existing timing editor as a shadcn Card. Its dynamic contents
   continue to be owned by the lyric studio and their own component bridges. */
import * as React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Card } from '../components/ui/card.js';
function mount() {
  const card = document.getElementById('kefeTimingEditor');
  if (!card || !card.parentNode || card.dataset.shadcnHydrated) return;
  const host = document.createElement('span');
  host.className = 'shad-lyric-card-host';
  card.parentNode.insertBefore(host, card);
  host.appendChild(card);
  const className = `${card.className} shad-lyric-card`.replace(/\s+/g, ' ').trim();
  card.className = `shad-card ${className}`.replace(/\s+/g, ' ').trim();
  card.dataset.slot = 'card';
  flushSync(() => hydrateRoot(host, React.createElement(Card, {
    id: card.id, className,
    dangerouslySetInnerHTML: { __html: card.innerHTML },
  })));
  card.dataset.shadcnHydrated = 'true';
}
if (document.readyState === 'complete') mount();
else window.addEventListener('load', mount, { once: true });
