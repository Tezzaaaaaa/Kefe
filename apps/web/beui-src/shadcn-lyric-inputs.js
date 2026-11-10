/* Hydrate each dynamically rebuilt lyric timing row's inputs and buttons as
   shadcn Input and Button components while leaving <details class="kefe-more">
   separate so shadcn-lyric-disclosures.js can upgrade it to Radix Collapsible
   with zero shared React roots or hydration conflicts. */
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
  if (node.hasAttribute('spellcheck')) props.spellCheck = node.getAttribute('spellcheck') !== 'false';
  return props;
}

function stripWhitespace(el) {
  Array.from(el.childNodes).forEach(node => {
    if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) node.remove();
  });
}

function nodeTree(node, key) {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  stripWhitespace(node);
  const props = propsFor(node);
  props.key = key;
  if (node instanceof HTMLInputElement && (node.classList.contains('kefe-time-input') || node.classList.contains('kefe-line-text'))) {
    const className = node.className.replace(/\bshad-input\b/g, '').replace(/\s+/g, ' ').trim();
    node.className = `shad-input ${className}`.replace(/\s+/g, ' ').trim();
    node.dataset.slot = 'input';
    delete props['data-slot'];
    delete props.value;
    props.className = className;
    props.defaultValue = node.value;
    return h(Input, props);
  }
  if (node instanceof HTMLButtonElement) {
    const className = node.className.replace(/\bshad-btn(?:--\S+)?\b/g, '').replace(/\s+/g, ' ').trim();
    const variant = node.classList.contains('primary') ? 'default' : 'outline';
    node.className = `shad-btn shad-btn--${variant === 'outline' ? 'outline' : 'primary'} ${className}`.replace(/\s+/g, ' ').trim();
    node.dataset.slot = 'button';
    node.dataset.variant = variant;
    node.dataset.size = 'default';
    delete props['data-slot'];
    delete props['data-variant'];
    delete props['data-size'];
    props.className = className;
    props.variant = variant;
    return h(Button, props, ...Array.from(node.childNodes, nodeTree));
  }
  const children = Array.from(node.childNodes, nodeTree);
  return children.length
    ? h(node.tagName.toLowerCase(), props, ...children)
    : h(node.tagName.toLowerCase(), props);
}

function hydrateContainer(container, rowRoots) {
  if (!container || !container.isConnected || container.dataset.shadcnContainerHydrated) return;
  stripWhitespace(container);
  const tree = Array.from(container.childNodes, nodeTree);
  let root;
  flushSync(() => { root = hydrateRoot(container, h(React.Fragment, null, ...tree)); });
  container.dataset.shadcnContainerHydrated = 'true';
  container.querySelectorAll('.shad-input, .shad-btn').forEach(node => { node.dataset.shadcnHydrated = 'true'; });
  rowRoots.push(root);
}

function hydrateStandaloneButton(button, rowRoots) {
  if (!button || !button.parentNode || button.dataset.shadcnHydrated) return;
  const host = document.createElement('span');
  host.className = 'shad-btn-host';
  button.parentNode.insertBefore(host, button);
  host.appendChild(button);
  const className = button.className.replace(/\bshad-btn(?:--\S+)?\b/g, '').replace(/\s+/g, ' ').trim();
  const variant = button.classList.contains('primary') ? 'default' : 'outline';
  button.className = `shad-btn shad-btn--${variant === 'outline' ? 'outline' : 'primary'} ${className}`.replace(/\s+/g, ' ').trim();
  button.dataset.slot = 'button';
  button.dataset.variant = variant;
  button.dataset.size = 'default';
  const props = propsFor(button);
  delete props['data-slot'];
  delete props['data-variant'];
  delete props['data-size'];
  props.className = className;
  props.variant = variant;
  let root;
  flushSync(() => {
    root = hydrateRoot(host, h(Button, { ...props, dangerouslySetInnerHTML: { __html: button.innerHTML } }));
  });
  button.dataset.shadcnHydrated = 'true';
  rowRoots.push(root);
}

function mount(row) {
  if (roots.has(row) || !row.isConnected) return;
  const focused = row.contains(document.activeElement) ? document.activeElement : null;
  const selection = focused instanceof HTMLInputElement ? [focused.selectionStart, focused.selectionEnd, focused.selectionDirection] : null;
  const rowRoots = [];

  hydrateContainer(row.querySelector(':scope > .kefe-line-main'), rowRoots);
  const tools = row.querySelector(':scope > .kefe-line-tools');
  if (tools) {
    Array.from(tools.children).forEach(child => {
      if (child instanceof HTMLButtonElement) hydrateStandaloneButton(child, rowRoots);
    });
    hydrateContainer(row.querySelector('.kefe-line-more-tools'), rowRoots);
  } else {
    hydrateContainer(row.querySelector('.kefe-line-more-tools'), rowRoots);
  }
  hydrateContainer(row.querySelector('.kefe-words'), rowRoots);

  roots.set(row, rowRoots);
  if (focused && focused.isConnected && document.activeElement !== focused) {
    focused.focus({ preventScroll: true });
    if (selection && selection[0] !== null) focused.setSelectionRange(...selection);
  }
}

function scan(root) {
  for (const [row, rowRoots] of roots) {
    if (!row.isConnected) {
      rowRoots.forEach(root => root.unmount());
      roots.delete(row);
    }
  }
  root.querySelectorAll('.kefe-line').forEach(mount);
}

function start() {
  const editor = document.getElementById('kefeTimingEditor');
  if (!editor) return;
  scan(editor);
  new MutationObserver(() => scan(editor)).observe(editor, { childList: true, subtree: true });
}

if (document.readyState === 'complete') start();
else window.addEventListener('load', start, { once: true });
