/* Hydrate the toolbar's stable button clusters in place. The toolbar continues
   to own its drag, history, popover, focus and editor-state logic. */
import * as React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Button } from '../components/ui/button.js';
function mount(group) {
  if (group.dataset.shadcnHydrated) return;
  const buttons = [...group.children];
  if (!buttons.length || buttons.some(button => !(button instanceof HTMLButtonElement))) return;
  const elements = buttons.map((button, key) => {
    const className = button.className;
    button.className = `shad-btn shad-btn--ghost ${className}`;
    button.dataset.slot = 'button'; button.dataset.variant = 'ghost'; button.dataset.size = 'icon';
    const props = {};
    for (const { name, value } of button.attributes) {
      if (['class', 'data-slot', 'data-variant', 'data-size'].includes(name)) continue;
      props[name] = name === 'disabled' || name === 'hidden' ? true : value;
    }
    return React.createElement(Button, { key, variant: 'ghost', size: 'icon', className, ...props,
      dangerouslySetInnerHTML: { __html: button.innerHTML } });
  });
  [...group.childNodes].forEach(node => { if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) node.remove(); });
  flushSync(() => hydrateRoot(group, React.createElement(React.Fragment, null, ...elements)));
  group.dataset.shadcnHydrated = 'true';
}
function mountLauncher() {
  const toolbar = document.getElementById('kefeFloatingToolbar');
  const bar = toolbar?.querySelector(':scope > .kft-bar');
  const launch = toolbar?.querySelector(':scope > button.kft-launch');
  if (!bar || !launch || toolbar.children.length !== 2 || toolbar.dataset.shadcnLauncher) return;
  const className = launch.className;
  launch.className = `shad-btn shad-btn--ghost ${className}`;
  launch.dataset.slot = 'button'; launch.dataset.variant = 'ghost'; launch.dataset.size = 'icon';
  const props = {};
  for (const { name, value } of launch.attributes) {
    if (!['class', 'data-slot', 'data-variant', 'data-size'].includes(name)) props[name] = name === 'disabled' || name === 'hidden' ? true : value;
  }
  const barProps = {};
  for (const { name, value } of bar.attributes) barProps[name === 'class' ? 'className' : name] = value;
  [...toolbar.childNodes].forEach(node => { if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) node.remove(); });
  flushSync(() => hydrateRoot(toolbar, React.createElement(React.Fragment, null,
    React.createElement('div', { ...barProps, dangerouslySetInnerHTML: { __html: bar.innerHTML } }),
    React.createElement(Button, { variant: 'ghost', size: 'icon', className, ...props, dangerouslySetInnerHTML: { __html: launch.innerHTML } }))));
  toolbar.dataset.shadcnLauncher = 'true';
}
function start() { mountLauncher(); document.querySelectorAll('#kefeFloatingToolbar .kft-main > .kft-cluster').forEach(mount); }
if (document.readyState === 'complete') start();
else window.addEventListener('load', start, { once: true });
