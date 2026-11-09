/* The lyric studio remains the state source. Its original buttons are hidden
   backing controls; visible exclusive choices use shadcn/Radix RadioGroup. */
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group.js';
const h = React.createElement;
function mount(native, { checkedAttribute, valueOf }) {
  if (!native || native.dataset.shadcnRadioMounted) return;
  const buttons = [...native.querySelectorAll(':scope > button')];
  if (!buttons.length) return;
  const host = document.createElement('div');
  host.className = 'shad-lyric-display-host';
  native.after(host);
  function DisplayOptions() {
    const [, redraw] = React.useReducer(value => value + 1, 0);
    React.useEffect(() => {
      const observer = new MutationObserver(redraw);
      observer.observe(native, { subtree: true, attributes: true, attributeFilter: [checkedAttribute, 'disabled', 'hidden'] });
      return () => observer.disconnect();
    }, []);
    const selectedButton = buttons.find(button => button.getAttribute(checkedAttribute) === 'true');
    const selected = selectedButton ? valueOf(selectedButton) : undefined;
    return h(RadioGroup, { 'aria-label': native.getAttribute('aria-label'), value: selected,
      onValueChange: value => buttons.find(button => valueOf(button) === value && !button.disabled && !button.hidden)?.click(),
      // Radix's deferred focus can miss selection on a very quick keyup. Select
      // synchronously so arrow navigation always behaves like a radio group.
      onKeyDownCapture: event => {
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
        const items = [...event.currentTarget.querySelectorAll('[role="radio"]:not(:disabled)')];
        const current = items.indexOf(event.target);
        if (current < 0 || !items.length) return;
        const index = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 :
          (current + (event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
        event.preventDefault(); event.stopPropagation();
        items[index].focus(); items[index].click();
      },
      className: 'shad-lyric-display-options',
    }, buttons.filter(button => !button.hidden).map(button => h('label', { key: valueOf(button), className: 'shad-lyric-display-choice' },
      h(RadioGroupItem, { value: valueOf(button), disabled: button.disabled, 'aria-label': button.getAttribute('aria-label') || button.textContent.trim() }),
      h('span', null, button.textContent.trim()))));
  }
  flushSync(() => createRoot(host).render(h(DisplayOptions)));
  native.hidden = true;
  native.dataset.shadcnRadioMounted = 'true';
}
function start() {
  mount(document.querySelector('#kefeDisplayGroup [role="radiogroup"][aria-label="Lyric display mode"]'),
    { checkedAttribute: 'aria-checked', valueOf: button => button.dataset.mode });
  mount(document.getElementById('kefeLyricAlignment'),
    { checkedAttribute: 'aria-pressed', valueOf: button => button.textContent.trim().toLowerCase() });
}
if (document.readyState === 'complete') start();
else window.addEventListener('load', start, { once: true });
