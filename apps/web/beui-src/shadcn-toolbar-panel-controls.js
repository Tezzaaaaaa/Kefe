/* The classic toolbar keeps its popover lifetime and native event handlers.
   Hydrate only its own panel actions and colour inputs, not editor/carousel
   content or the temporary context proxies. */
import * as React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
const h = React.createElement;
function attrs(node) {
  const result = {};
  for (const { name, value } of node.attributes) {
    if (['class', 'style', 'value', 'data-slot', 'data-variant', 'data-size'].includes(name)) continue;
    result[{ tabindex: 'tabIndex', spellcheck: 'spellCheck', maxlength: 'maxLength' }[name] || name] =
      ['disabled', 'hidden'].includes(name) ? true : name === 'spellcheck' ? node.spellcheck : value;
  }
  return result;
}
function buttonTree(button, key) {
  const name = button.className;
  button.className = `shad-btn shad-btn--ghost ${name}`;
  button.dataset.slot = 'button'; button.dataset.variant = 'ghost'; button.dataset.size = 'default';
  const style = button.style.length ? Object.fromEntries([...button.style].map(key => [key, button.style.getPropertyValue(key)])) : undefined;
  if (style) button.setAttribute('style', Object.entries(style).map(([name, value]) => `${name}:${value}`).join(';'));
  return h(Button, { key, variant: 'ghost', className: name, ...attrs(button), style, dangerouslySetInnerHTML: { __html: button.innerHTML } });
}
function mountGroup(group) {
  if (group.dataset.shadcnHydrated) return;
  const buttons = [...group.children];
  if (!buttons.length || buttons.some(button => !(button instanceof HTMLButtonElement))) return;
  const elements = buttons.map(buttonTree);
  [...group.childNodes].forEach(node => { if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) node.remove(); });
  flushSync(() => hydrateRoot(group, h(React.Fragment, null, ...elements)));
  group.dataset.shadcnHydrated = 'true';
}
function mountSingle(node, kind) {
  if (node.dataset.shadcnHydrated || !node.parentNode) return;
  const host = document.createElement('span'); host.className = 'kft-shad-control-host';
  node.parentNode.insertBefore(host, node); host.appendChild(node);
  let tree;
  if (kind === 'button') tree = buttonTree(node);
  else {
    const name = node.className;
    node.className = `shad-input ${name}`.trim(); node.dataset.slot = 'input';
    tree = h(Input, { className: name, ...attrs(node), defaultValue: node.value });
  }
  flushSync(() => hydrateRoot(host, tree));
  node.dataset.shadcnHydrated = 'true';
}
function scan(panel) {
  if (!(panel instanceof Element) || !panel.matches('.kft-panel:not(.kft-context-popover)')) return;
  panel.querySelectorAll('.kft-pad, .kft-presets').forEach(mountGroup);
  panel.querySelectorAll('button.kft-chip').forEach(button => mountSingle(button, 'button'));
  panel.querySelectorAll('.kft-hexrow input, .kft-pref--colour input[type="color"]').forEach(input => mountSingle(input, 'input'));
}
function start() {
  document.querySelectorAll('.kft-panel').forEach(scan);
  new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
    if (!(node instanceof Element)) return;
    scan(node); node.querySelectorAll('.kft-panel').forEach(scan);
  }))).observe(document.body, { childList: true, subtree: true });
}
if (document.readyState === 'complete') start();
else window.addEventListener('load', start, { once: true });
