/* Hydrate KEFE's Media & Alert surfaces in place using genuine shadcn
   Input, Label, Dropzone, Card, Badge, Button, and Alert components while
   preserving every original DOM node and event listener. */
import * as React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { Card } from '../components/ui/card.js';
import { Badge } from '../components/ui/badge.js';
import { Button } from '../components/ui/button.js';
import { Dropzone } from '../components/ui/dropzone.js';
import { Alert, AlertDescription } from '../components/ui/alert.js';

const h = React.createElement;
const ATTR_MAP = { class: 'className', for: 'htmlFor', tabindex: 'tabIndex', spellcheck: 'spellCheck' };
const BOOL_ATTRS = new Set(['disabled', 'hidden', 'readOnly', 'required']);

function stripWhitespace(el) {
  Array.from(el.childNodes).forEach(node => {
    if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) node.remove();
  });
}

function readAttrs(node, skip = []) {
  const props = {};
  for (const attr of node.attributes) {
    if (skip.includes(attr.name)) continue;
    const key = ATTR_MAP[attr.name] || attr.name;
    props[key] = BOOL_ATTRS.has(key) ? true : key === 'spellCheck' ? attr.value !== 'false' : attr.value;
  }
  return props;
}

const stripPrefix = (cls, rx) => cls.replace(rx, '').replace(/\s+/g, ' ').trim();

function nodeTree(node, key) {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  stripWhitespace(node);

  if (node.tagName === 'LABEL' && node.classList.contains('shad-dropzone')) {
    const className = stripPrefix(node.className, /\bshad-dropzone\b/g);
    node.className = `shad-dropzone ${className}`.replace(/\s+/g, ' ').trim();
    node.dataset.slot = 'dropzone';
    const props = readAttrs(node, ['class', 'data-slot']);
    return h(Dropzone, { key, className, ...props }, ...Array.from(node.childNodes, nodeTree));
  }

  if (node.classList.contains('kefe-upload-card')) {
    const className = stripPrefix(node.className, /\bshad-card\b/g);
    node.className = `shad-card ${className}`.replace(/\s+/g, ' ').trim();
    node.dataset.slot = 'card';
    const props = readAttrs(node, ['class', 'data-slot']);
    return h(Card, { key, className, ...props }, ...Array.from(node.childNodes, nodeTree));
  }

  if (node.classList.contains('shad-upload-browse')) {
    const className = stripPrefix(node.className, /\bshad-btn(?:--\S+)?\b/g);
    node.className = `shad-btn shad-btn--outline shad-btn--sm ${className}`.replace(/\s+/g, ' ').trim();
    node.dataset.slot = 'button';
    node.dataset.variant = 'outline';
    node.dataset.size = 'sm';
    const props = readAttrs(node, ['class', 'data-slot', 'data-variant', 'data-size']);
    return h(
      Button,
      { key, asChild: true, variant: 'outline', size: 'sm', className },
      h('span', props, ...Array.from(node.childNodes, nodeTree))
    );
  }

  if (node.classList.contains('shad-upload-file-status')) {
    const className = stripPrefix(node.className, /\bshad-badge(?:--\S+)?\b/g);
    node.className = `shad-badge shad-badge--secondary ${className}`.replace(/\s+/g, ' ').trim();
    node.dataset.slot = 'badge';
    node.dataset.variant = 'secondary';
    const props = readAttrs(node, ['class', 'data-slot', 'data-variant']);
    return h(Badge, { key, variant: 'secondary', className, ...props }, ...Array.from(node.childNodes, nodeTree));
  }

  if (node.tagName === 'BUTTON' && node.id === 'bgVideoRemove') {
    const className = stripPrefix(node.className, /\bshad-btn(?:--\S+)?\b/g);
    node.className = `shad-btn shad-btn--outline shad-btn--sm ${className}`.replace(/\s+/g, ' ').trim();
    node.dataset.slot = 'button';
    node.dataset.variant = 'outline';
    node.dataset.size = 'sm';
    const props = readAttrs(node, ['class', 'data-slot', 'data-variant', 'data-size']);
    return h(Button, { key, variant: 'outline', size: 'sm', className, ...props }, ...Array.from(node.childNodes, nodeTree));
  }

  if (
    node.classList.contains('shad-upload-symbol') ||
    node.classList.contains('shad-upload-file-icon') ||
    node.classList.contains('shad-manual-notice-icon')
  ) {
    const props = readAttrs(node);
    props.key = key;
    return h(node.tagName.toLowerCase(), { ...props, dangerouslySetInnerHTML: { __html: node.innerHTML } });
  }

  const props = readAttrs(node);
  props.key = key;
  const children = Array.from(node.childNodes, nodeTree);
  return children.length
    ? h(node.tagName.toLowerCase(), props, ...children)
    : h(node.tagName.toLowerCase(), props);
}

function mountMediaFields() {
  for (const id of ['songTitle', 'songArtist', 'songAlbum', 'songYear']) {
    const input = document.getElementById(id);
    const field = input?.parentElement;
    if (!input || !field || input.dataset.shadcnHydrated) continue;
    const label = field.querySelector('label[for="' + id + '"]');
    if (!label) continue;
    stripWhitespace(field);

    const labelClass = stripPrefix(label.className, /\bshad-label\b/g);
    label.className = `shad-label ${labelClass}`.replace(/\s+/g, ' ').trim();
    label.dataset.slot = 'label';
    const labelProps = readAttrs(label, ['class', 'data-slot']);

    const inputClass = stripPrefix(input.className, /\bshad-input\b/g);
    input.className = `shad-input ${inputClass}`.replace(/\s+/g, ' ').trim();
    input.dataset.slot = 'input';
    const inputProps = readAttrs(input, ['class', 'data-slot', 'value']);
    inputProps.defaultValue = input.value;

    const children = Array.from(field.childNodes).map((child, index) => {
      if (child === label) {
        return h(Label, { key: `lbl-${index}`, className: labelClass, ...labelProps }, ...Array.from(label.childNodes, nodeTree));
      }
      if (child === input) {
        return h(Input, { key: `inp-${index}`, className: inputClass, ...inputProps });
      }
      return nodeTree(child, index);
    });

    flushSync(() => hydrateRoot(field, h(React.Fragment, null, ...children)));
    input.dataset.shadcnHydrated = 'true';
    label.dataset.shadcnHydrated = 'true';
  }
}

function mountUploads() {
  const row = document.querySelector('.kefe-panel[data-panel-view="media"] .kefe-media-upload-row');
  if (row && !row.dataset.shadcnHydrated) {
    stripWhitespace(row);
    const tree = Array.from(row.childNodes, nodeTree);
    flushSync(() => hydrateRoot(row, h(React.Fragment, null, ...tree)));
    row.dataset.shadcnHydrated = 'true';
    row.querySelectorAll('#kefeUploadZone, #kefeBgVideoZone, #bgVideoRemove').forEach(node => {
      node.dataset.shadcnHydrated = 'true';
    });
    return;
  }

  for (const id of ['kefeUploadZone', 'kefeBgVideoZone']) {
    const zone = document.getElementById(id);
    if (!zone || !zone.parentNode || zone.dataset.shadcnHydrated) continue;
    stripWhitespace(zone);
    const className = stripPrefix(zone.className, /\bshad-dropzone\b/g);
    zone.className = `shad-dropzone ${className}`.replace(/\s+/g, ' ').trim();
    zone.dataset.slot = 'dropzone';
    const host = document.createElement('span');
    host.className = 'shad-media-card-host';
    zone.parentNode.insertBefore(host, zone);
    host.appendChild(zone);
    const props = readAttrs(zone, ['class', 'data-slot']);
    flushSync(() => hydrateRoot(host, h(Dropzone, { className, ...props }, ...Array.from(zone.childNodes, nodeTree))));
    zone.dataset.shadcnHydrated = 'true';
  }
}

function mountCardSurface(el) {
  if (!el || !el.parentNode || el.dataset.shadcnCardMounted) return;
  el.classList.add('shad-card');
  el.dataset.slot = 'card';
  el.dataset.shadcnCardMounted = 'true';
}

function mountMediaCardsAndBadges() {
  // Apply shadcn Card semantics directly on mutable card surfaces so live progress,
  // suggestion lists, and nested React controls retain exact node identities.
  mountCardSurface(document.getElementById('kefeMediaTrack'));
  mountCardSurface(document.getElementById('kefeSuggestions'));
  mountCardSurface(document.getElementById('kefeDisplayGroup'));
  mountCardSurface(document.getElementById('kefeAutoSync'));
  mountCardSurface(document.getElementById('kefeSyncGuide'));
  document.querySelectorAll('#kefeExportExtras .kefe-review').forEach(mountCardSurface);

  const carBadge = document.getElementById('kefeCarBadge');
  if (carBadge && carBadge.parentNode && !carBadge.dataset.shadcnHydrated) {
    const host = document.createElement('span');
    host.className = 'shad-btn-host';
    carBadge.parentNode.insertBefore(host, carBadge);
    host.appendChild(carBadge);
    const className = carBadge.className;
    carBadge.className = `shad-badge shad-badge--secondary ${className}`.replace(/\s+/g, ' ').trim();
    carBadge.dataset.slot = 'badge';
    carBadge.dataset.variant = 'secondary';
    const props = readAttrs(carBadge, ['class', 'data-slot', 'data-variant']);
    flushSync(() => hydrateRoot(host, h(Badge, { variant: 'secondary', className, ...props }, carBadge.textContent)));
    carBadge.dataset.shadcnHydrated = 'true';
  }
}

function mountManualNotice(node) {
  if (!node || !node.parentNode || node.dataset.shadcnHydrated) return;
  const host = document.createElement('span');
  host.className = 'shad-media-card-host';
  node.parentNode.insertBefore(host, node);
  host.appendChild(node);
  const className = stripPrefix(node.className, /\bshad-alert(?:--\S+)?\b/g);
  node.className = `shad-alert shad-alert--default ${className}`.replace(/\s+/g, ' ').trim();
  node.dataset.slot = 'alert';
  node.setAttribute('role', 'alert');
  const props = readAttrs(node, ['class', 'data-slot', 'role']);
  const children = Array.from(node.childNodes).map((child, idx) => {
    if (child.nodeType === Node.ELEMENT_NODE && child.dataset.slot === 'alert-description') {
      if (child.tagName !== 'DIV') {
        const div = document.createElement('div');
        for (const attr of child.attributes) div.setAttribute(attr.name, attr.value);
        div.innerHTML = child.innerHTML;
        child.replaceWith(div);
        child = div;
      }
      const descClass = stripPrefix(child.className, /\bshad-alert-description\b/g);
      child.className = `shad-alert-description ${descClass}`.replace(/\s+/g, ' ').trim();
      const descProps = readAttrs(child, ['class', 'data-slot']);
      return h(AlertDescription, { key: idx, className: descClass, ...descProps }, child.textContent);
    }
    return nodeTree(child, idx);
  });
  flushSync(() => hydrateRoot(host, h(Alert, { className, ...props }, ...children)));
  node.dataset.shadcnHydrated = 'true';
}

function observeManualNotice() {
  const existing = document.getElementById('kefeManualNotice');
  if (existing) mountManualNotice(existing);
  const mediaForm = document.querySelector('[data-panel-view="media"] .kefe-form');
  if (!mediaForm || typeof MutationObserver === 'undefined') return;
  new MutationObserver(() => {
    const notice = document.getElementById('kefeManualNotice');
    if (notice && !notice.dataset.shadcnHydrated) mountManualNotice(notice);
  }).observe(mediaForm, { childList: true, subtree: true });
}

function start() {
  mountMediaFields();
  mountUploads();
  mountMediaCardsAndBadges();
  observeManualNotice();
}

if (document.readyState === 'complete') start();
else window.addEventListener('load', start, { once: true });
