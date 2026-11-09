/* Hydrate each dynamically rebuilt lyric timing row as one React tree. The
   existing controls, listeners, selection and details state remain native;
   detached rows are unmounted rather than retaining a root for every button. */
import * as React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';

const h = React.createElement;
const roots = new Map();
const attributeNames = { class: 'className', tabindex: 'tabIndex', inputmode: 'inputMode', spellcheck: 'spellCheck' };
const booleanAttributes = new Set(['disabled', 'hidden', 'open']);
function propsFor(node) {
  const props = {};
  for (const attribute of node.attributes) {
    const name = attributeNames[attribute.name] || attribute.name;
    props[name] = booleanAttributes.has(name) ? true : attribute.value;
  }
  if (node.hasAttribute('spellcheck')) props.spellCheck = node.spellcheck;
  return props;
}
function nodeTree(node, key) {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const props = propsFor(node);
  props.key = key;
  if (node instanceof HTMLInputElement && (node.classList.contains('kefe-time-input') || node.classList.contains('kefe-line-text'))) {
    const className = node.className;
    node.className = `shad-input ${className}`;
    node.dataset.slot = 'input';
    delete props['data-slot'];
    props.className = className;
    props.defaultValue = node.value;
    return h(Input, props);
  }
  if (node instanceof HTMLButtonElement) {
    const className = node.className;
    const variant = node.classList.contains('primary') ? 'default' : 'outline';
    node.className = `shad-btn shad-btn--${variant === 'outline' ? 'outline' : 'primary'} ${className}`;
    node.dataset.slot = 'button'; node.dataset.variant = variant; node.dataset.size = 'default';
    delete props['data-slot']; delete props['data-variant']; delete props['data-size'];
    props.className = className; props.variant = variant;
    return h(Button, props, ...Array.from(node.childNodes, nodeTree));
  }
  return h(node.tagName.toLowerCase(), props, ...Array.from(node.childNodes, nodeTree));
}
function mount(row) {
  if (roots.has(row) || !row.isConnected) return;
  const focused = row.contains(document.activeElement) ? document.activeElement : null;
  const selection = focused instanceof HTMLInputElement ? [focused.selectionStart, focused.selectionEnd, focused.selectionDirection] : null;
  const tree = Array.from(row.childNodes, nodeTree);
  let root;
  flushSync(() => { root = hydrateRoot(row, h(React.Fragment, null, ...tree)); });
  roots.set(row, root);
  row.querySelectorAll('.shad-input, .shad-btn').forEach(node => { node.dataset.shadcnHydrated = 'true'; });
  if (focused && focused.isConnected && document.activeElement !== focused) {
    focused.focus({ preventScroll: true });
    if (selection && selection[0] !== null) focused.setSelectionRange(...selection);
  }
}
function scan(list) {
  for (const [row, root] of roots) {
    if (!row.isConnected) { root.unmount(); roots.delete(row); }
  }
  list.querySelectorAll(':scope > .kefe-line').forEach(mount);
}
function start() {
  const list = document.querySelector('#kefeTimingEditor .kefe-line-list');
  if (!list) return;
  scan(list);
  new MutationObserver(() => scan(list)).observe(list, { childList: true, subtree: true });
}
if (document.readyState === 'complete') start();
else window.addEventListener('load', start, { once: true });
