/* Radix sliders for the toolbar's persistent popover scrubbers. The original
   scrubber stays as the source of bounds, formatting, disabled state and the
   existing commit/onInput path. Context proxy popovers are intentionally separate. */
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Slider } from '../components/ui/slider.js';
const h = React.createElement;
const mounted = new WeakSet();
function mount(source) {
  if (mounted.has(source) || !source.parentNode) return;
  mounted.add(source);
  source.dataset.shadcnBacking = 'true'; source.setAttribute('aria-hidden', 'true'); source.tabIndex = -1;
  const host = document.createElement('div'); host.className = 'kft-shad-scrub'; source.after(host);
  const root = createRoot(host);
  function render() {
    const min = Number(source.getAttribute('aria-valuemin')), max = Number(source.getAttribute('aria-valuemax'));
    const value = Number(source.getAttribute('aria-valuenow')), step = Number(source.dataset.kftStep);
    const formatted = source.getAttribute('aria-valuetext') || String(value);
    root.render(h(React.Fragment, null,
      h(Slider, { min, max, value, step, label: source.getAttribute('aria-label'), valueText: formatted,
        disabled: source.getAttribute('aria-disabled') === 'true',
        onValueChange: ([next]) => source.dispatchEvent(new CustomEvent('kefe-scrub-set', { detail: next })) }),
      h('span', { className: 'kft-shad-scrub-value', 'aria-hidden': true }, formatted)));
  }
  flushSync(render);
  new MutationObserver(render).observe(source, { attributes: true, attributeFilter: ['aria-valuemin','aria-valuemax','aria-valuenow','aria-valuetext','aria-label','aria-disabled'] });
}
function scan(panel) {
  if (!(panel instanceof Element) || !panel.matches('.kft-panel:not(.kft-context-popover)')) return;
  panel.querySelectorAll('.kft-scrub[role="slider"]').forEach(mount);
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
