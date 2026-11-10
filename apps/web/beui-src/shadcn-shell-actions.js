/* Hydrate KEFE's shell navigation, workspace dock + separator, top-nav controls,
   and preview fullscreen trigger as shadcn Buttons, Separator, and Tooltips while
   retaining every original DOM node and direct-child selector (.kefe-stage > #previewFullscreen). */
import * as React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Button } from '../components/ui/button.js';
import { Separator } from '../components/ui/separator.js';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '../components/ui/tooltip.js';

const h = React.createElement;
const ATTR_MAP = { class: 'className', tabindex: 'tabIndex', 'aria-hidden': 'aria-hidden' };
const BOOL_ATTRS = new Set(['disabled', 'hidden']);
const DOCK_SKIP = ['class', 'data-slot', 'data-variant', 'data-size', 'data-state', 'aria-describedby'];

function readStyle(node) {
  if (!node.style || !node.style.length) return undefined;
  const out = {};
  for (let i = 0; i < node.style.length; i++) {
    const prop = node.style[i];
    const key = prop.startsWith('--') ? prop : prop.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
    out[key] = node.style.getPropertyValue(prop);
  }
  return out;
}

function readAttrs(node, skip = []) {
  const props = {};
  for (const attr of node.attributes) {
    if (attr.name === 'style' || skip.includes(attr.name)) continue;
    const key = ATTR_MAP[attr.name] || attr.name;
    props[key] = BOOL_ATTRS.has(key) ? true : attr.value;
  }
  const style = readStyle(node);
  if (style) props.style = style;
  return props;
}

function DockTooltipButton({ button, initial }) {
  const mountedRef = React.useRef(false);
  const htmlRef = React.useRef({ __html: initial.html });
  const [, redraw] = React.useReducer(v => v + 1, 0);

  React.useLayoutEffect(() => {
    mountedRef.current = true;
    const observer = new MutationObserver(() => redraw());
    observer.observe(button, { attributes: true, childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [button]);

  const snap = mountedRef.current
    ? {
        className: button.className.replace(/\bshad-btn(?:--\S+)?\b/g, '').replace(/\s+/g, ' ').trim(),
        tip: button.getAttribute('aria-label') || button.getAttribute('title') || '',
        html: button.innerHTML,
        props: readAttrs(button, DOCK_SKIP),
      }
    : initial;

  if (htmlRef.current.__html !== snap.html) {
    htmlRef.current = { __html: snap.html };
  }

  const btnEl = h(Button, {
    variant: 'ghost',
    size: 'icon',
    className: snap.className,
    ...snap.props,
    dangerouslySetInnerHTML: htmlRef.current,
  });

  if (!snap.tip) return btnEl;
  return h(
    Tooltip,
    null,
    h(TooltipTrigger, { asChild: true }, btnEl),
    h(TooltipContent, { side: 'top' }, snap.tip)
  );
}

function stripWhitespace(el) {
  Array.from(el.childNodes).forEach(node => {
    if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) node.remove();
  });
}

function wrapSingleControl(node, element) {
  if (!node || !node.parentNode || node.dataset.shadcnHydrated) return;
  const host = document.createElement('span');
  host.className = 'shad-btn-host';
  node.parentNode.insertBefore(host, node);
  host.appendChild(node);
  flushSync(() => hydrateRoot(host, element));
  node.dataset.shadcnHydrated = 'true';
}

function mountTabs() {
  const nav = document.querySelector('.kefe-tabs');
  if (!nav || nav.dataset.shadcnHydrated) return;
  const buttons = Array.from(nav.children).filter(node => node instanceof HTMLButtonElement);
  if (!buttons.length || buttons.length !== nav.children.length) return;
  stripWhitespace(nav);

  const items = buttons.map((button, index) => {
    const className = button.className;
    button.className = `shad-btn shad-btn--ghost ${className}`.replace(/\s+/g, ' ').trim();
    button.dataset.slot = 'button';
    button.dataset.variant = 'ghost';
    button.dataset.size = 'default';
    const props = readAttrs(button, ['class', 'data-slot', 'data-variant', 'data-size']);
    return h(Button, {
      key: button.dataset.panel || index,
      variant: 'ghost',
      size: 'default',
      className,
      ...props,
      dangerouslySetInnerHTML: { __html: button.innerHTML },
    });
  });

  flushSync(() => hydrateRoot(nav, h(React.Fragment, null, ...items)));
  nav.dataset.shadcnHydrated = 'true';
}

function mountDock() {
  const dock = document.querySelector('.kefe-workspace-dock');
  if (!dock || dock.dataset.shadcnHydrated) return;
  stripWhitespace(dock);

  // Align separator tag/attributes before hydrating so Radix Separator matches 1:1.
  const oldSep = dock.querySelector(':scope > .kefe-dock-separator');
  if (oldSep && oldSep.tagName !== 'DIV') {
    const div = document.createElement('div');
    div.className = 'shad-separator shad-separator--vertical kefe-dock-separator';
    div.setAttribute('role', 'none');
    div.dataset.slot = 'separator';
    div.dataset.orientation = 'vertical';
    oldSep.replaceWith(div);
  }

  const children = Array.from(dock.children).map((node, index) => {
    if (node.classList.contains('kefe-dock-separator')) {
      return h(Separator, {
        key: `sep-${index}`,
        orientation: 'vertical',
        decorative: true,
        className: 'kefe-dock-separator',
      });
    }
    if (!(node instanceof HTMLButtonElement)) {
      return h(node.tagName.toLowerCase(), {
        key: index,
        ...readAttrs(node),
        dangerouslySetInnerHTML: { __html: node.innerHTML },
      });
    }
    const className = node.className.replace(/\bshad-btn(?:--\S+)?\b/g, '').replace(/\s+/g, ' ').trim();
    const tip = node.getAttribute('aria-label') || node.getAttribute('title') || '';
    const initial = {
      className,
      tip,
      html: node.innerHTML,
      props: readAttrs(node, tip ? DOCK_SKIP : ['class', 'data-slot', 'data-variant', 'data-size']),
    };
    node.className = `shad-btn shad-btn--ghost shad-btn--icon ${className}`.replace(/\s+/g, ' ').trim();
    node.dataset.slot = 'button';
    node.dataset.variant = 'ghost';
    node.dataset.size = 'icon';
    if (tip) node.dataset.state = 'closed';
    return h(DockTooltipButton, { key: node.id || index, button: node, initial });
  });

  flushSync(() => hydrateRoot(dock, h(TooltipProvider, null, ...children)));
  dock.dataset.shadcnHydrated = 'true';
}

function mountTopNavControls() {
  const editorLink = document.querySelector('.kefe-sidebar-group-editor > a[data-editor-tab]');
  if (editorLink && !editorLink.dataset.shadcnHydrated) {
    const className = editorLink.className;
    editorLink.className = `shad-btn shad-btn--ghost ${className}`.replace(/\s+/g, ' ').trim();
    editorLink.dataset.slot = 'button';
    editorLink.dataset.variant = 'ghost';
    editorLink.dataset.size = 'default';
    const props = readAttrs(editorLink, ['class', 'data-slot', 'data-variant', 'data-size']);
    wrapSingleControl(
      editorLink,
      h(
        Button,
        { asChild: true, variant: 'ghost', size: 'default', className },
        h('a', { ...props, dangerouslySetInnerHTML: { __html: editorLink.innerHTML } })
      )
    );
  }

  const settingsBtn = document.querySelector('.kefe-sidebar-group-editor > button.kefe-header-settings');
  if (settingsBtn && !settingsBtn.dataset.shadcnHydrated) {
    const className = settingsBtn.className;
    settingsBtn.className = `shad-btn shad-btn--ghost ${className}`.replace(/\s+/g, ' ').trim();
    settingsBtn.dataset.slot = 'button';
    settingsBtn.dataset.variant = 'ghost';
    settingsBtn.dataset.size = 'default';
    const props = readAttrs(settingsBtn, ['class', 'data-slot', 'data-variant', 'data-size']);
    wrapSingleControl(
      settingsBtn,
      h(Button, {
        variant: 'ghost',
        size: 'default',
        className,
        ...props,
        dangerouslySetInnerHTML: { __html: settingsBtn.innerHTML },
      })
    );
  }
}

function mountFullscreenButton() {
  const button = document.getElementById('previewFullscreen');
  if (!button || button.dataset.shadcnHydrated) return;
  const stage = button.parentElement;
  if (!stage) return;

  const className = button.className;
  button.className = `shad-btn shad-btn--ghost shad-btn--icon ${className}`.replace(/\s+/g, ' ').trim();
  button.dataset.slot = 'button';
  button.dataset.variant = 'ghost';
  button.dataset.size = 'icon';

  // Keep .kefe-stage > #previewFullscreen intact without claiming dynamic canvas siblings in React.
  if (stage.classList.contains('kefe-stage')) {
    button.dataset.shadcnHydrated = 'true';
    return;
  }

  const btnProps = readAttrs(button, ['class', 'data-slot', 'data-variant', 'data-size']);
  wrapSingleControl(
    button,
    h(Button, {
      variant: 'ghost',
      size: 'icon',
      className,
      ...btnProps,
      dangerouslySetInnerHTML: { __html: button.innerHTML },
    })
  );
}

function start() {
  mountTabs();
  mountDock();
  mountTopNavControls();
  mountFullscreenButton();
}

if (document.readyState === 'complete') start();
else window.addEventListener('load', start, { once: true });
