/* Static legal text remains present without JavaScript. Hydration adds the
   shadcn components without rewriting the legal copy or replacing its nodes. */
import * as React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Card } from '../components/ui/card.js';
import { Alert } from '../components/ui/alert.js';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table.js';
const h = React.createElement;
function mount() {
  const main = document.querySelector('body.kefe-legal-page > main');
  const card = main?.querySelector(':scope > .kefe-legal-card');
  if (!card || card.dataset.hydrated) return;
  [...main.childNodes].forEach(node => { if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) node.remove(); });
  const cardClass = card.className.replace(/\s+/g, ' ').trim();
  card.className = `shad-card ${cardClass}`.replace(/\s+/g, ' ').trim();
  card.dataset.slot = 'card';
  flushSync(() => hydrateRoot(main, h(Card, { className: cardClass, dangerouslySetInnerHTML: { __html: card.innerHTML } })));
  const alertHost = card.querySelector('.kefe-legal-alert-mount');
  const alert = alertHost?.querySelector(':scope > .draft');
  if (alert) {
    alert.className = 'shad-alert shad-alert--default draft';
    alert.dataset.slot = 'alert';
    alert.setAttribute('role', 'note');
    flushSync(() => hydrateRoot(alertHost, h(Alert, { className: 'draft', role: 'note', dangerouslySetInnerHTML: { __html: alert.innerHTML } })));
  }
  const tableHost = card.querySelector('.kefe-legal-table-mount');
  const table = tableHost?.querySelector(':scope > table');
  if (table) {
    [...tableHost.childNodes].forEach(node => { if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) node.remove(); });
    const container = document.createElement('div');
    container.className = 'shad-table-container'; container.dataset.slot = 'table-container';
    tableHost.insertBefore(container, table); container.appendChild(table);
    table.className = 'shad-table'; table.dataset.slot = 'table';
    const convert = (node, key) => {
      const types = { THEAD: [TableHeader, 'table-header'], TBODY: [TableBody, 'table-body'], TR: [TableRow, 'table-row'], TH: [TableHead, 'table-head'], TD: [TableCell, 'table-cell'] };
      const [Component, slot] = types[node.tagName];
      node.className = `shad-${slot}`; node.dataset.slot = slot;
      const props = { key };
      if (node.hasAttribute('scope')) props.scope = node.getAttribute('scope');
      if (node.tagName === 'TH' || node.tagName === 'TD') props.dangerouslySetInnerHTML = { __html: node.innerHTML };
      else props.children = [...node.children].map(convert);
      return h(Component, props);
    };
    const children = [...table.children].map(convert);
    // HTML whitespace is not represented in React's element-only table tree.
    [table, ...table.querySelectorAll('thead,tbody,tr')].forEach(node => {
      [...node.childNodes].forEach(child => { if (child.nodeType === Node.TEXT_NODE && !child.textContent.trim()) child.remove(); });
    });
    flushSync(() => hydrateRoot(tableHost, h(Table, null, ...children)));
  }
  card.dataset.hydrated = 'true';
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
else mount();
