/* shadcn/Radix Select for toolbar menus, backed by the existing live option
   providers and selection handlers. The classic menu remains an early fallback. */
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/select.js';
const h = React.createElement;
const mounted = new WeakSet();

function ToolbarSelect({ source, api }) {
  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState(() => api.getOptions());
  React.useEffect(() => {
    const refresh = () => setOptions(api.getOptions());
    const close = () => setOpen(false);
    const panel = source.closest('.kft-panel');
    source.addEventListener('kefe-menu-refresh', refresh);
    panel?.addEventListener('kefe-panel-close', close);
    const observer = new MutationObserver(refresh);
    observer.observe(source, { attributes: true, attributeFilter: ['aria-label', 'disabled'] });
    return () => {
      source.removeEventListener('kefe-menu-refresh', refresh);
      panel?.removeEventListener('kefe-panel-close', close);
      observer.disconnect();
    };
  }, [source, api]);
  const current = options.findIndex(option => option.value === api.getValue());
  return h(Select, {
    value: current < 0 ? '' : `item-${current}`,
    disabled: source.disabled,
    open,
    onOpenChange: setOpen,
    onValueChange(next) {
      const index = Number(next.slice(5));
      const option = options[index];
      if (option) api.choose(option.value);
    },
  },
    h(SelectTrigger, {
      className: 'kft-trigger kft-trigger--field kft-shad-select-trigger',
      'aria-label': source.getAttribute('aria-label'),
    }, h(SelectValue, { placeholder: source.textContent.trim() || 'Choose' })),
    h(SelectContent, {
      className: 'kft-select-content',
      container: document.fullscreenElement || document.body,
    }, options.map((option, index) => h(SelectItem, {
      value: `item-${index}`, key: index,
    }, option.label || ' '))));
}

function mount(source) {
  const api = source.kefeMenuBridge;
  if (mounted.has(source) || !source.parentNode || !api) return;
  mounted.add(source);
  source.dataset.shadcnBacking = 'true';
  source.hidden = true;
  const host = document.createElement('div');
  host.className = 'kft-shad-select-host';
  source.after(host);
  const root = createRoot(host);
  flushSync(() => root.render(h(ToolbarSelect, { source, api })));
}
function scan(panel) {
  if (!(panel instanceof Element) || !panel.matches('.kft-panel:not(.kft-context-popover)')) return;
  panel.querySelectorAll('button.kft-trigger').forEach(mount);
}
function start() {
  document.querySelectorAll('.kft-panel').forEach(scan);
  new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
    if (!(node instanceof Element)) return;
    scan(node);
    node.querySelectorAll('.kft-panel').forEach(scan);
  }))).observe(document.body, { childList: true, subtree: true });
}
if (document.readyState === 'complete') start();
else window.addEventListener('load', start, { once: true });
