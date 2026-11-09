/* The header actions are real shadcn Buttons, hydrated in place so the editor's
   delegated save/reset handlers and theme control keep their original nodes. */
import * as React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Button } from '../components/ui/button.js';

function mountHeaderActions() {
  const group = document.querySelector('.kefe-sidebar-bottom');
  if (!group || group.dataset.shadcnHydrated) return;
  const buttons = Array.from(group.children);
  const ids = ['kefeResetButton', 'kefeSaveButton', 'kefeThemeToggle'];
  if (buttons.length !== ids.length || buttons.some((button, index) => button.id !== ids[index])) return;
  const elements = buttons.map(button => {
    const className = button.className;
    button.className = `shad-btn shad-btn--ghost ${className}`;
    button.dataset.slot = 'button';
    button.dataset.variant = 'ghost';
    button.dataset.size = 'icon';
    const attributes = {};
    for (const attribute of button.attributes) {
      if (attribute.name === 'class' || attribute.name === 'data-slot' || attribute.name === 'data-variant' || attribute.name === 'data-size') continue;
      attributes[attribute.name] = attribute.value;
    }
    return React.createElement(Button, {
      key: button.id, variant: 'ghost', size: 'icon', className, ...attributes,
      dangerouslySetInnerHTML: { __html: button.innerHTML },
    });
  });
  Array.from(group.childNodes).forEach(node => {
    if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) node.remove();
  });
  flushSync(() => hydrateRoot(group, React.createElement(React.Fragment, null, ...elements)));
  group.dataset.shadcnHydrated = 'true';
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountHeaderActions, { once: true });
else mountHeaderActions();
