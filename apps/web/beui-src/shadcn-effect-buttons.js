/* Hydrate lyric and background effect choices in place as shadcn Buttons.
   Preserve their native handlers, preview canvases and the existing galleries.
   The unrelated Find Your Song carousel is not selected or modified. */
import * as React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Button } from '../components/ui/button.js';
function mount(group) {
  if (!group || group.dataset.shadcnHydrated) return;
  const buttons = [...group.children];
  if (!buttons.length || buttons.some(button => !(button instanceof HTMLButtonElement) || !button.classList.contains('kefe-lyric-effect-option'))) return;
  const children = buttons.map(button => {
    const className = button.className;
    button.className = `shad-btn shad-btn--outline ${className}`;
    button.dataset.slot = 'button'; button.dataset.variant = 'outline'; button.dataset.size = 'default';
    const attributes = {};
    for (const attr of button.attributes) {
      if (['class', 'data-slot', 'data-variant', 'data-size'].includes(attr.name)) continue;
      attributes[attr.name] = attr.name === 'disabled' || attr.name === 'hidden' ? true : attr.value;
    }
    return React.createElement(Button, { key: button.dataset.effect || button.dataset.backgroundMode, variant: 'outline', className, ...attributes,
      dangerouslySetInnerHTML: { __html: button.innerHTML } });
  });
  Array.from(group.childNodes).forEach(node => {
    if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) node.remove();
  });
  flushSync(() => hydrateRoot(group, React.createElement(React.Fragment, null, ...children)));
  group.dataset.shadcnHydrated = 'true';
}
function start() { mount(document.getElementById('lyricEffectOptions')); mount(document.getElementById('kefeBackgroundEffectOptions')); }
if (document.readyState === 'complete') start();
else window.addEventListener('load', start, { once: true });
