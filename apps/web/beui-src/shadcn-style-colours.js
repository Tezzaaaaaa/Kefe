/* Hydrate the lyric-style colour controls without replacing the native nodes.
   The classic style layer owns their values, handlers and persistence. */
import * as React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';

const h = React.createElement;
function attrs(node, ignored = []) {
  const props = {};
  for (const { name, value } of node.attributes) {
    if (['class', 'style', 'data-slot', 'data-variant', 'data-size', ...ignored].includes(name)) continue;
    props[name] = ['disabled', 'hidden'].includes(name) ? true : value;
  }
  return props;
}
function buttonTree(button, key) {
  const className = button.className;
  button.className = `shad-btn shad-btn--outline ${className}`;
  button.dataset.slot = 'button'; button.dataset.variant = 'outline'; button.dataset.size = 'default';
  const style = button.style.length ? Object.fromEntries(Array.from(button.style, name => [name, button.style.getPropertyValue(name)])) : undefined;
  // React's hydration style serialization omits spaces and the trailing semicolon.
  if (style) button.setAttribute('style', Object.entries(style).map(([name, value]) => `${name}:${value}`).join(';'));
  return h(Button, { key, variant: 'outline', className, ...attrs(button), style }, button.textContent || null);
}
function mount(row) {
  const wrap = row.querySelector(':scope > .kefe-style-color-wrap');
  const palette = row.querySelector(':scope > .kefe-style-color-swatches');
  const input = wrap?.querySelector(':scope > input[type="color"]');
  if (!input || !palette || row.dataset.shadcnHydrated) return;
  const className = input.className;
  input.className = `shad-input ${className}`;
  input.dataset.slot = 'input';
  const controls = Array.from(wrap.children, (node, key) => node === input
    ? h(Input, { key, className, ...attrs(input, ['value']), defaultValue: input.value })
    : buttonTree(node, key));
  const swatches = Array.from(palette.children, buttonTree);
  flushSync(() => {
    hydrateRoot(wrap, h(React.Fragment, null, ...controls));
    hydrateRoot(palette, h(React.Fragment, null, ...swatches));
  });
  row.dataset.shadcnHydrated = 'true';
}
function start() {
  document.querySelectorAll('#kefeStyleGroup .kefe-style-color-row').forEach(mount);
}
if (document.readyState === 'complete') start();
else window.addEventListener('load', start, { once: true });
