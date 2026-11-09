/* shadcn-backed control adapters for the editor's native state model.
   Existing input nodes, labels, listeners and validation remain authoritative. */
import * as React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Input } from '../components/ui/input.js';
import { Textarea } from '../components/ui/textarea.js';

const TEXT_INPUT_SELECTOR = '.kefe-editor input:not([type="range"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="color"]):not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"])';
const TOGGLE_GROUP_SELECTOR = '.kefe-seg-row, .ls-tabs, .kefe-align-group';

function isToggleItemActive(btn) {
  return btn.classList.contains('active') || btn.classList.contains('is-active') ||
    btn.getAttribute('aria-pressed') === 'true' || btn.getAttribute('aria-selected') === 'true';
}
function syncToggleGroup(group) {
  [...group.querySelectorAll(':scope > button')].forEach(btn => {
    btn.dataset.slot = 'toggle-group-item';
    btn.dataset.state = isToggleItemActive(btn) ? 'on' : 'off';
  });
}
function enhanceToggleGroup(group) {
  if (!(group instanceof HTMLElement) || group.dataset.shadToggleGroup === 'true') return;
  group.dataset.shadToggleGroup = 'true';
  group.dataset.slot = 'toggle-group';
  if (!group.hasAttribute('role')) group.setAttribute('role', 'group');
  syncToggleGroup(group);
  group.addEventListener('keydown', event => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    const buttons = [...group.querySelectorAll(':scope > button:not([disabled]):not([hidden])')];
    const index = buttons.indexOf(event.target.closest('button'));
    if (index < 0 || buttons.length < 2) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 :
      (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
    buttons[next]?.click();
  });
  const observer = new MutationObserver(() => syncToggleGroup(group));
  observer.observe(group, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'aria-pressed', 'aria-selected'] });
}
function enhanceDropzone(zone) {
  if (!(zone instanceof HTMLElement) || zone.dataset.shadDropzone === 'true') return;
  zone.dataset.shadDropzone = 'true';
  zone.dataset.slot = 'dropzone';
  let depth = 0;
  zone.addEventListener('dragenter', () => { depth += 1; zone.dataset.dragover = 'true'; });
  zone.addEventListener('dragover', () => { zone.dataset.dragover = 'true'; });
  zone.addEventListener('dragleave', () => {
    depth = Math.max(0, depth - 1);
    if (!depth) delete zone.dataset.dragover;
  });
  zone.addEventListener('drop', () => { depth = 0; delete zone.dataset.dragover; });
}
function controlProps(element, multiline) {
  const props = {};
  const aliases = { tabindex: 'tabIndex', spellcheck: 'spellCheck', maxlength: 'maxLength',
    minlength: 'minLength', autocomplete: 'autoComplete', inputmode: 'inputMode',
    readonly: 'readOnly', autofocus: 'autoFocus' };
  const booleanAttributes = new Set(['disabled', 'hidden', 'required', 'multiple', 'readOnly', 'autoFocus']);
  for (const attribute of element.attributes) {
    if (['class', 'style', 'value', 'data-slot', 'data-shadcn-hydrated'].includes(attribute.name)) continue;
    const name = aliases[attribute.name] || attribute.name;
    props[name] = booleanAttributes.has(name) ? true : attribute.value;
  }
  if (!multiline) props.type = element.type;
  props.defaultValue = element.defaultValue;
  return props;
}
function mountTextControl(element, multiline) {
  if (element.dataset.shadcnHydrated || !element.parentNode) return;
  const originalClass = element.className;
  element.className = (multiline ? 'shad-textarea ' : 'shad-input ') + originalClass;
  element.dataset.slot = multiline ? 'textarea' : 'input';
  const host = document.createElement('span');
  host.className = 'shad-text-control-host';
  host.style.display = 'contents';
  element.parentNode.insertBefore(host, element);
  host.appendChild(element);
  const Component = multiline ? Textarea : Input;
  flushSync(() => hydrateRoot(host, React.createElement(Component, {
    className: originalClass, ...controlProps(element, multiline),
  })));
  element.dataset.shadcnHydrated = 'true';
}
function each(root, selector, callback) {
  if (root.matches?.(selector)) callback(root);
  root.querySelectorAll(selector).forEach(callback);
}
function tagPrimitives(root = document) {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  each(root, TOGGLE_GROUP_SELECTOR, enhanceToggleGroup);
  each(root, '.kefe-drop', enhanceDropzone);
  each(root, TEXT_INPUT_SELECTOR, input => mountTextControl(input, false));
  each(root, '.kefe-editor textarea', textarea => mountTextControl(textarea, true));
  each(root, '.kefe-editor input[type="checkbox"]', checkbox => {
    if (!checkbox.dataset.slot) checkbox.dataset.slot = 'checkbox';
  });
  each(root, '.kefe-editor select', select => {
    if (!select.dataset.slot) select.dataset.slot = 'select';
  });
  each(root, '#kefeMediaCurrentCard, .kefe-car-card, .ls-root, .kefe-settings-panel .section', card => {
    if (!card.dataset.slot) card.dataset.slot = 'card';
  });
  each(root, '#lsAutoSyncModal .ls-as-card', dialog => {
    if (!dialog.dataset.slot) dialog.dataset.slot = 'dialog-content';
  });
}
function bootShadcnControls() {
  tagPrimitives(document);
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
      if (node instanceof HTMLElement) tagPrimitives(node);
    }));
  });
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
}
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootShadcnControls, { once: true });
  else bootShadcnControls();
}
