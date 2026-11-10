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

    React.useLayoutEffect(() => {
      if (slotRef.current && popover.parentNode !== slotRef.current) {
        slotRef.current.appendChild(popover);
      }
    }, []);

    React.useEffect(() => {
      popover.hidden = !open;
      button.setAttribute('aria-expanded', String(open));
    }, [open]);

    React.useEffect(() => {
      const onClick = () => setOpen(prev => !prev);
      button.addEventListener('click', onClick);
      return () => button.removeEventListener('click', onClick);
    }, []);

    return h(
      Popover,
      { open, onOpenChange: setOpen },
      h(PopoverAnchor, { virtualRef: anchorRef }),
      h(
        PopoverContent,
        {
          portal: false,
          forceMount: true,
          side: 'top',
          align: 'end',
          sideOffset: 10,
          className: 'shad-volume-popover-content',
          onOpenAutoFocus: event => {
            event.preventDefault();
            slider?.focus({ preventScroll: true });
          },
          onCloseAutoFocus: event => {
            event.preventDefault();
            button.focus({ preventScroll: true });
          },
          onPointerDownOutside: event => {
            if (event.target === button || button.contains(event.target)) {
              event.preventDefault();
            }
          },
        },
        h('div', { ref: slotRef, style: { display: 'contents' } })
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
