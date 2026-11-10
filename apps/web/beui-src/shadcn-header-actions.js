/* The header actions are real shadcn Buttons with Radix Tooltips, hydrated in
   place so delegated save/reset handlers and theme control keep their DOM nodes
   and live icon/label mutations (e.g. sun/moon toggle) are never clobbered. */
import * as React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Button } from '../components/ui/button.js';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '../components/ui/tooltip.js';

const h = React.createElement;
const SKIP_ATTRS = new Set(['class', 'data-slot', 'data-variant', 'data-size', 'data-state', 'aria-describedby']);

function readProps(button) {
  const attributes = {};
  for (const attribute of button.attributes) {
    if (SKIP_ATTRS.has(attribute.name)) continue;
    attributes[attribute.name] = attribute.name === 'disabled' || attribute.name === 'hidden' ? true : attribute.value;
  }
  return {
    className: button.className.replace(/\bshad-btn(?:--\S+)?\b/g, '').replace(/\s+/g, ' ').trim(),
    tip: button.getAttribute('aria-label') || button.getAttribute('title') || '',
    html: button.innerHTML,
    attributes,
  };
}

function HeaderActionButton({ button, initial }) {
  const mountedRef = React.useRef(false);
  const htmlRef = React.useRef({ __html: initial.html });
  const [, redraw] = React.useReducer(v => v + 1, 0);

  React.useLayoutEffect(() => {
    mountedRef.current = true;
    const observer = new MutationObserver(() => redraw());
    observer.observe(button, { attributes: true, childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [button]);

  const snap = mountedRef.current ? readProps(button) : initial;
  if (htmlRef.current.__html !== snap.html) {
    htmlRef.current = { __html: snap.html };
  }

  const btnEl = h(Button, {
    variant: 'ghost',
    size: 'icon',
    className: snap.className,
    ...snap.attributes,
    dangerouslySetInnerHTML: htmlRef.current,
  });

  if (!snap.tip) return btnEl;
  return h(
    Tooltip,
    null,
    h(TooltipTrigger, { asChild: true }, btnEl),
    h(TooltipContent, null, snap.tip)
  );
}

function mountHeaderActions() {
  const group = document.querySelector('.kefe-sidebar-bottom');
  if (!group || group.dataset.shadcnHydrated) return;
  const buttons = Array.from(group.children);
  const ids = ['kefeResetButton', 'kefeSaveButton', 'kefeThemeToggle'];
  if (buttons.length !== ids.length || buttons.some((button, index) => button.id !== ids[index])) return;

  const elements = buttons.map(button => {
    const initial = readProps(button);
    button.className = `shad-btn shad-btn--ghost shad-btn--icon ${initial.className}`.replace(/\s+/g, ' ').trim();
    button.dataset.slot = 'button';
    button.dataset.variant = 'ghost';
    button.dataset.size = 'icon';
    if (initial.tip) button.dataset.state = 'closed';
    return h(HeaderActionButton, { key: button.id, button, initial });
  });

  Array.from(group.childNodes).forEach(node => {
    if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) node.remove();
  });
  flushSync(() => hydrateRoot(group, h(TooltipProvider, null, ...elements)));
  group.dataset.shadcnHydrated = 'true';
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountHeaderActions, { once: true });
else mountHeaderActions();
