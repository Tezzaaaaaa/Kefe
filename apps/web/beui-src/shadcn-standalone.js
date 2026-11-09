/* Hydrate the demo's persistent controls in place. Its own playback engine,
   rendering nodes, native event handlers and file inputs stay authoritative. */
// Production uses the editor's shared CSS bundle. The development page has
// its own entry, so load the bridge styles explicitly there.
if (import.meta.env.DEV) import('./legacy-bridge.css');
import * as React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { Textarea } from '../components/ui/textarea.js';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../components/ui/accordion.js';
const h = React.createElement;
function mount(element) {
  if (!element || element.dataset.shadcnHydrated || !element.parentNode) return;
  const isButton = element instanceof HTMLButtonElement;
  const isTextarea = element instanceof HTMLTextAreaElement;
  const name = element.className;
  const variant = element.closest('#pcs') ? 'ghost' : 'outline';
  const host = document.createElement('span'); host.className = 'standalone-control-host';
  element.parentNode.insertBefore(host, element); host.appendChild(element);
  element.className = isButton ? `shad-btn shad-btn--${variant} ${name}`.trim() : `${isTextarea ? 'shad-textarea' : 'shad-input'} ${name}`.trim();
  element.dataset.slot = isButton ? 'button' : isTextarea ? 'textarea' : 'input';
  if (isButton) { element.dataset.variant = variant; element.dataset.size = 'default'; }
  const props = { className: name };
  for (const { name: attr, value } of element.attributes) {
    if (['class','style','value','data-slot','data-variant','data-size'].includes(attr)) continue;
    const prop = { tabindex:'tabIndex', spellcheck:'spellCheck' }[attr] || attr;
    props[prop] = ['disabled', 'hidden', 'multiple'].includes(prop) ? true : value;
  }
  if (element.style.flex) { props.style = { flex: element.style.flex }; element.setAttribute('style', `flex:${element.style.flex}`); }
  if (isButton) { props.variant = variant; props.dangerouslySetInnerHTML = { __html: element.innerHTML }; }
  else if (element.type !== 'file') props.defaultValue = isTextarea ? element.defaultValue : element.value;
  flushSync(() => hydrateRoot(host, h(isButton ? Button : isTextarea ? Textarea : Input, props)));
  element.dataset.shadcnHydrated = 'true';
}
function mountAccordion() {
  const ui = document.getElementById('ui');
  const details = [...(ui?.querySelectorAll(':scope > details') || [])];
  if (details.length !== 2 || ui.dataset.shadcnAccordion) return;
  const entries = details.map((detail, index) => ({
    value: index ? 'lyrics' : 'look', title: detail.querySelector(':scope > summary')?.textContent.trim(),
    open: detail.open, nodes: [...detail.childNodes].filter(node => node !== detail.querySelector(':scope > summary')),
  }));
  if (entries.some(entry => !entry.title)) return;
  const host = document.createElement('div'); host.className = 'standalone-accordion-host';
  ui.insertBefore(host, details[0]);
  const root = createRoot(host);
  flushSync(() => root.render(h(Accordion, { type: 'multiple', defaultValue: entries.filter(entry => entry.open).map(entry => entry.value) },
    entries.map(entry => h(AccordionItem, { key: entry.value, value: entry.value },
      h(AccordionTrigger, null, entry.title), h(AccordionContent, { forceMount: true }))))));
  const bodies = host.querySelectorAll('[data-slot="accordion-content"] .shad-accordion-body');
  entries.forEach((entry, index) => bodies[index].append(...entry.nodes));
  details.forEach(detail => detail.remove());
  ui.dataset.shadcnAccordion = 'true';
}
function start() {
  mountAccordion();
  ['pp','ap','rs','pcv','pcp','pcn','tin','ain','tx','af','lf','cf'].forEach(id => mount(document.getElementById(id)));
}
if (document.readyState === 'complete') start();
else window.addEventListener('load', start, { once: true });
