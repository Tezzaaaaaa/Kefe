/* Hydrate the volume trigger in place as a shadcn Button and wrap the native
   volume popover in a Radix Popover anchored to it. The original button,
   popover, and slider DOM nodes stay intact with zero hydration warnings. */
import * as React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Button } from '../components/ui/button.js';
import { Popover, PopoverAnchor, PopoverContent } from '../components/ui/popover.js';

const h = React.createElement;

function mount() {
  const group = document.querySelector('.kefe-volume-control');
  const button = document.getElementById('kefeMuteToggle');
  const popover = document.getElementById('kefeVolumePopover');
  const slider = document.getElementById('kefeVolume');
  if (!group || !button || !popover || group.dataset.shadcnHydrated) return;

  const initiallyOpen = !popover.hidden;
  popover.remove();
  Array.from(group.childNodes).forEach(node => {
    if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) node.remove();
  });

  button.dataset.shadcnPopover = 'true';
  const className = button.className;
  button.className = `shad-btn shad-btn--ghost shad-btn--icon ${className}`.replace(/\s+/g, ' ').trim();
  button.dataset.slot = 'button';
  button.dataset.variant = 'ghost';
  button.dataset.size = 'icon';

  const attributes = {};
  for (const attr of button.attributes) {
    if (['class', 'data-slot', 'data-variant', 'data-size'].includes(attr.name)) continue;
    attributes[attr.name] = attr.name === 'disabled' || attr.name === 'hidden' ? true : attr.value;
  }

  flushSync(() => {
    hydrateRoot(group, h(Button, {
      variant: 'ghost',
      size: 'icon',
      className,
      ...attributes,
      dangerouslySetInnerHTML: { __html: button.innerHTML },
    }));
  });

  const popoverHost = document.createElement('span');
  popoverHost.className = 'shad-volume-popover-host';
  group.appendChild(popoverHost);

  const anchorRef = { current: button };

  function VolumePopover() {
    const [open, setOpen] = React.useState(initiallyOpen);
    const slotRef = React.useRef(null);
    const parkRef = React.useRef(null);
    const closedByOutsideRef = React.useRef(false);
    const wasOpenRef = React.useRef(initiallyOpen);

    React.useLayoutEffect(() => {
      const container = open ? slotRef.current : parkRef.current;
      if (container && popover.parentNode !== container) {
        container.appendChild(popover);
      }
      popover.hidden = !open;
      button.setAttribute('aria-expanded', String(open));
      if (wasOpenRef.current && !open && !closedByOutsideRef.current) {
        button.focus({ preventScroll: true });
      }
      wasOpenRef.current = open;
      if (!open) closedByOutsideRef.current = false;
      return () => {
        if (open && parkRef.current && popover.parentNode !== parkRef.current) {
          popover.hidden = true;
          parkRef.current.appendChild(popover);
        }
      };
    }, [open]);

    React.useEffect(() => {
      const onClick = () => flushSync(() => {
        closedByOutsideRef.current = false;
        setOpen(prev => !prev);
      });
      button.addEventListener('click', onClick);
      return () => button.removeEventListener('click', onClick);
    }, []);

    return h(
      React.Fragment,
      null,
      h('span', { ref: parkRef, hidden: true, style: { display: 'none' } }),
      h(
        Popover,
        { open, onOpenChange: setOpen },
        h(PopoverAnchor, { virtualRef: anchorRef }),
        h(
          PopoverContent,
          {
            portal: false,
            side: 'top',
            align: 'end',
            sideOffset: 10,
            className: 'shad-volume-popover-content',
            onOpenAutoFocus: event => {
              event.preventDefault();
              const target = popover.querySelector('[role="slider"]:not([aria-hidden="true"])') || slider;
              target?.focus({ preventScroll: true });
            },
            onCloseAutoFocus: event => {
              event.preventDefault();
              if (!closedByOutsideRef.current) {
                button.focus({ preventScroll: true });
              }
              closedByOutsideRef.current = false;
            },
            onEscapeKeyDown: () => {
              closedByOutsideRef.current = false;
            },
            onFocusOutside: event => {
              if (popover.contains(event.target) || event.target === button || button.contains(event.target)) {
                event.preventDefault();
              }
            },
            onPointerDownOutside: event => {
              if (popover.contains(event.target) || event.target === button || button.contains(event.target)) {
                event.preventDefault();
              } else {
                closedByOutsideRef.current = true;
              }
            },
          },
          h('div', { ref: slotRef, style: { display: 'contents' } })
        )
      )
    );
  }

  flushSync(() => {
    createRoot(popoverHost).render(h(VolumePopover));
  });
  group.dataset.shadcnHydrated = 'true';
}

if (document.readyState === 'complete') mount();
else window.addEventListener('load', mount, { once: true });
