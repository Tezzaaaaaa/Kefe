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

function mountPanelCard(section) {
  if (!section || !section.parentNode || section.dataset.shadcnHydrated) return;
  const host = document.createElement('span');
  host.className = 'shad-panel-card-host';
  section.parentNode.insertBefore(host, section);
  host.appendChild(section);
  section.dataset.slot = 'card';
  const attributes = {};
  for (const { name, value } of section.attributes) {
    if (['data-slot', 'data-shadcn-hydrated'].includes(name)) continue;
    attributes[name === 'class' ? 'className' : name] = name === 'hidden' ? true : value;
  }
  attributes.dangerouslySetInnerHTML = { __html: section.innerHTML };
  flushSync(() => hydrateRoot(host, React.createElement(Card, {
    asChild: true,
  }, React.createElement('section', attributes))));
  section.dataset.shadcnHydrated = 'true';
}

function scan(root = document) {
  const candidates = [];
  if (root instanceof HTMLElement && root.matches('#kefeTimingEditor, #kefeMediaTrack, .kefe-upload-card')) candidates.push(root);
  root.querySelectorAll?.('#kefeTimingEditor, #kefeMediaTrack, .kefe-upload-card').forEach(card => candidates.push(card));
  candidates.forEach(mountCard);
}
function scanPanelCards(root = document) {
  const panels = [];
  if (root instanceof HTMLElement && root.matches('.kefe-panel[data-panel-view]')) panels.push(root);
  root.querySelectorAll?.('.kefe-panel[data-panel-view]').forEach(panel => panels.push(panel));
  panels.forEach(mountPanelCard);
}
window.kefeHydratePanelCard = mountCard;
window.kefeHydrateEditorPanelCard = mountPanelCard;
document.addEventListener('kefe:settings-panel-mounted', () => scanPanelCards());
function start() { scan(); }
if (document.readyState === 'complete') start();
else window.addEventListener('load', start, { once: true });
