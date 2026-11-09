/* shadcn/ui Tabs for the editor's existing workspace panels. The adapter keeps
   ownership of panel visibility and selection; Radix owns tab interaction. */
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs.js';

export function mountWorkspaceTabs(host, { items, value, onValueChange, listClass, label, dataset, count }) {
  const root = createRoot(host);
  let current = value;
  const render = () => root.render(React.createElement(Tabs, {
    value: current, onValueChange, style: { display: 'contents' },
  }, React.createElement(TabsList, {
    className: listClass, 'aria-label': label, ...dataset,
    ...(count ? { style: { '--kefe-subtab-count': count } } : {}),
  }, items.map(item => React.createElement(TabsTrigger, {
    key: item.value, value: item.value, id: item.id, className: item.className,
    'aria-controls': item.controls, ...item.dataset,
    // Legacy navigation APIs also invoke element.click() without pointer events.
    onClick: () => { if (current !== item.value) onValueChange(item.value); },
  }, item.label)))));
  flushSync(render);
  return {
    setValue(next) { current = next; render(); },
    destroy() { root.unmount(); },
  };
}
