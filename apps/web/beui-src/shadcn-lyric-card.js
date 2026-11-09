/* Hydrate the editor's non-gallery cards as shadcn Card components. Their
   original nodes and dynamic content updates remain owned by KEFE. */
import * as React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Card } from '../components/ui/card.js';

function mountCard(card) {
  if (!card || !card.parentNode || card.dataset.shadcnHydrated) return;
  const host = document.createElement('span');
  host.className = 'shad-lyric-card-host';
  card.parentNode.insertBefore(host, card);
  host.appendChild(card);
  const className = card.className;
  card.classList.add('shad-lyric-card');
  card.dataset.slot = 'card';
  const props = {};
  for (const { name, value } of card.attributes) {
    if (['class', 'data-slot', 'data-shadcn-hydrated'].includes(name)) continue;
    props[name === 'class' ? 'className' : name] = name === 'hidden' ? true : value;
  }
  props.className = card.className;
  props.dangerouslySetInnerHTML = { __html: card.innerHTML };
  flushSync(() => hydrateRoot(host, React.createElement(Card, props)));
  card.dataset.shadcnHydrated = 'true';
}
function scan(root = document) {
  const candidates = [];
  if (root instanceof HTMLElement && root.matches('#kefeTimingEditor, #kefeMediaTrack, .kefe-upload-card')) candidates.push(root);
  root.querySelectorAll?.('#kefeTimingEditor, #kefeMediaTrack, .kefe-upload-card').forEach(card => candidates.push(card));
  candidates.forEach(mountCard);
}
window.kefeHydratePanelCard = mountCard;
function start() { scan(); }
if (document.readyState === 'complete') start();
else window.addEventListener('load', start, { once: true });
