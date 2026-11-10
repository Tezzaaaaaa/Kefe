/* Upgrade KEFE's lyric/style <details> disclosures to Radix Collapsible while
   keeping every inner control DOM node intact and connected, and upgrade
   #kefeSyncGuide action buttons to shadcn Buttons. */
import * as React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../components/ui/collapsible.js';
import { Button } from '../components/ui/button.js';

const h = React.createElement;
const collapsibleRoots = new Map();

function mountCollapsible(detail) {
  if (!(detail instanceof HTMLElement) || !detail.isConnected || detail.dataset.shadcnCollapsible) return;
  const summary = detail.querySelector(':scope > summary');
  if (!summary) return;

  const parent = detail.parentNode;
  if (!parent) return;

  const isStyleDisclosure = detail.classList.contains('kefe-style-disclosure');
  const defaultOpen = detail.hasAttribute('open');
  const className = detail.className;
  const triggerText = summary.textContent.trim();
  const bodyNodes = Array.from(detail.childNodes).filter(node => node !== summary);

  const host = document.createElement('div');
  host.className = 'shad-collapsible-host';
  host.style.display = 'contents';
  detail.dataset.shadcnCollapsible = 'true';
  parent.insertBefore(host, detail);
  detail.remove();

  function Disclosure() {
    const [open, setOpen] = React.useState(defaultOpen);
    const bodyRef = React.useRef(null);

    React.useLayoutEffect(() => {
      const target = bodyRef.current;
      if (!target) return;
      for (const node of bodyNodes) {
        if (node.parentNode !== target) target.appendChild(node);
      }
    }, []);

    return h(
      Collapsible,
      { open, onOpenChange: setOpen, className },
      h(CollapsibleTrigger, { chevron: true }, triggerText),
      h(CollapsibleContent, { forceMount: true, ref: bodyRef })
    );
  }

  let root;
  flushSync(() => {
    root = createRoot(host);
    root.render(h(Disclosure));
  });
  collapsibleRoots.set(host, root);
}

function mountSyncGuideButtons() {
  const actions = document.querySelector('#kefeSyncGuide .kefe-sync-guide-actions');
  if (!actions || actions.dataset.shadcnHydrated) return;
  const buttons = Array.from(actions.children).filter(node => node instanceof HTMLButtonElement);
  if (!buttons.length || buttons.length !== actions.children.length) return;

  const elements = buttons.map((button, index) => {
    const className = button.className.replace(/\bshad-btn(?:--\S+)?\b/g, '').replace(/\s+/g, ' ').trim();
    const variant = button.classList.contains('primary') ? 'default' : 'outline';
    button.className = `shad-btn shad-btn--${variant === 'outline' ? 'outline' : 'primary'} shad-btn--sm ${className}`.replace(/\s+/g, ' ').trim();
    button.dataset.slot = 'button';
    button.dataset.variant = variant;
    button.dataset.size = 'sm';
    const props = {};
    for (const attr of button.attributes) {
      if (['class', 'data-slot', 'data-variant', 'data-size'].includes(attr.name)) continue;
      props[attr.name] = attr.name === 'disabled' || attr.name === 'hidden' ? true : attr.value;
    }
    return h(Button, {
      key: index,
      variant,
      size: 'sm',
      className,
      ...props,
      dangerouslySetInnerHTML: { __html: button.innerHTML },
    });
  });

  Array.from(actions.childNodes).forEach(node => {
    if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) node.remove();
  });
  flushSync(() => hydrateRoot(actions, h(React.Fragment, null, ...elements)));
  actions.dataset.shadcnHydrated = 'true';
}

function scanAll() {
  for (const [host, root] of collapsibleRoots) {
    if (!host.isConnected) {
      root.unmount();
      collapsibleRoots.delete(host);
    }
  }
  document.querySelectorAll('#kefeStyleGroup > details.kefe-style-disclosure, #kefeAutoSync details.kefe-more, #kefeTimingEditor .kefe-line details.kefe-more').forEach(mountCollapsible);
  mountSyncGuideButtons();
}

function start() {
  scanAll();
  for (const id of ['kefeTimingEditor', 'kefeStyleGroup', 'kefeAutoSync']) {
    const target = document.getElementById(id);
    if (target && typeof MutationObserver !== 'undefined') {
      new MutationObserver(() => scanAll()).observe(target, { childList: true, subtree: true });
    }
  }
}

if (document.readyState === 'complete') start();
else window.addEventListener('load', start, { once: true });
