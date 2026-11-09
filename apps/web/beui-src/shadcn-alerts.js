/* Accessible editor notifications built from shadcn Alert and Button. Preserve
   the synchronous window.kefeAlert API, including element and dismiss handles. */
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { renderKefeIcon } from '../app/ui/icons.js';
import { Alert, AlertTitle, AlertDescription } from '../components/ui/alert.js';
import { Button } from '../components/ui/button.js';
const h = React.createElement;
const icons = { default: 'info', info: 'info', success: 'check-circle', warning: 'alert-triangle', destructive: 'x-circle' };
function icon(name) { return renderKefeIcon(name, '', 18, 1.8); }
function mount() {
  if (window.kefeAlert?.shadcn) return;
  const show = (message, options = {}) => {
    const variant = Object.hasOwn(icons, options.variant) ? options.variant : 'info';
    let host = document.querySelector('.kefe-alert-stack');
    if (!host) {
      host = document.createElement('div'); host.className = 'kefe-alert-stack';
      host.setAttribute('aria-label', 'Notifications'); document.body.appendChild(host);
    }
    const mountPoint = document.createElement('div'); mountPoint.className = 'shad-alert-mount'; host.appendChild(mountPoint);
    const root = createRoot(mountPoint);
    let item, timer, closed = false;
    const dismiss = () => {
      if (closed) return;
      closed = true; clearTimeout(timer);
      item.classList.remove('is-visible'); item.setAttribute('aria-hidden', 'true');
      window.setTimeout(() => {
        // Callers receive the element and may have removed or moved it before
        // dismissing; restore it to its React root so unmount remains safe.
        if (item.parentNode !== mountPoint) mountPoint.appendChild(item);
        root.unmount(); mountPoint.remove();
      }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220);
    };
    const assertive = variant === 'warning' || variant === 'destructive';
    flushSync(() => root.render(h(Alert, {
      variant: variant === 'destructive' ? 'destructive' : 'default',
      className: `kefe-alert kefe-alert-${variant}`, role: assertive ? 'alert' : 'status',
      'aria-live': assertive ? 'assertive' : 'polite',
    },
      h('span', { className: 'kefe-alert-icon', 'aria-hidden': true, dangerouslySetInnerHTML: { __html: icon(icons[variant]) } }),
      h('div', { className: 'kefe-alert-content' },
        options.title ? h(AlertTitle, { className: 'kefe-alert-title' }, String(options.title)) : null,
        h(AlertDescription, { className: 'kefe-alert-description' }, String(message ?? ''))),
      h(Button, { type: 'button', variant: 'ghost', size: 'icon', className: 'kefe-alert-close',
        'aria-label': 'Dismiss notification', onClick: dismiss, dangerouslySetInnerHTML: { __html: icon('close') } }))));
    item = mountPoint.firstElementChild;
    requestAnimationFrame(() => { if (!closed) item.classList.add('is-visible'); });
    if (options.duration !== 0) timer = window.setTimeout(dismiss, Math.max(2500, Number(options.duration) || 6000));
    return { dismiss, element: item };
  };
  show.shadcn = true;
  window.kefeAlert = show;
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
else mount();
