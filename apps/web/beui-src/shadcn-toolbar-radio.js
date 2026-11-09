/* Segmented toolbar choices are backed by the original buttons, which still
   drive the editor. The visible control is a shadcn/Radix RadioGroup. */
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group.js';
const h = React.createElement;
const mounted = new WeakSet();
function mount(source) {
  if (mounted.has(source) || !source.parentNode) return;
  const buttons = [...source.querySelectorAll(':scope > button')];
  if (!buttons.length) return;
  mounted.add(source);
  source.dataset.shadcnBacking = 'true'; source.hidden = true;
  const host = document.createElement('div'); host.className = 'kft-shad-seg-host'; source.after(host);
  const root = createRoot(host);
  function render() {
    const selected = buttons.find(button => button.getAttribute('aria-checked') === 'true')?.dataset.value;
    root.render(h(RadioGroup, { className: 'kft-seg kft-shad-seg', 'aria-label': source.getAttribute('aria-label'), value: selected,
      onValueChange: value => buttons.find(button => button.dataset.value === value && !button.disabled)?.click(),
      onKeyDownCapture: event => {
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
        const items = [...event.currentTarget.querySelectorAll('[role="radio"]:not(:disabled)')];
        const current = items.indexOf(event.target);
        if (current < 0 || !items.length) return;
        const index = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 :
          (current + (event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
        event.preventDefault(); event.stopPropagation(); items[index].focus(); items[index].click();
      },
    }, buttons.map(button => h(RadioGroupItem, { key: button.dataset.value, value: button.dataset.value,
      className: 'kft-seg__item kft-shad-seg-item', disabled: button.disabled }, button.textContent.trim()))));
  }
  flushSync(render);
  new MutationObserver(render).observe(source, { subtree: true, attributes: true, attributeFilter: ['aria-checked','disabled'] });
}
function scan(panel) {
  if (!(panel instanceof Element) || !panel.matches('.kft-panel:not(.kft-context-popover)')) return;
  panel.querySelectorAll('.kft-seg[role="radiogroup"]').forEach(mount);
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
