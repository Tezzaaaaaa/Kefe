/* Hydrate the Settings action as a shadcn Button without inserting a wrapper.
   The original navigation children and fullscreen stage structure stay intact. */
import * as React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Button } from '../components/ui/button.js';

function mountHeaderActions() {
  const group = document.querySelector('.kefe-sidebar-bottom');
  if (group && !group.dataset.shadcnHydrated) {
    const buttons = Array.from(group.children);
    const ids = ['kefeResetButton', 'kefeSaveButton', 'kefeThemeToggle'];
    if (buttons.length === ids.length && buttons.every((button, index) => button.id === ids[index])) {
      const elements = buttons.map(button => {
        const className = button.className;
        button.className = 'shad-btn shad-btn--ghost ' + className;
        button.dataset.slot = 'button';
        button.dataset.variant = 'ghost';
        button.dataset.size = 'icon';
        const attributes = {};
        for (const attribute of button.attributes) {
          if (['class', 'data-slot', 'data-variant', 'data-size'].includes(attribute.name)) continue;
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
  }

  const nav = document.querySelector('.kefe-sidebar-group-editor');
  if (nav && !nav.dataset.shadcnHydrated) {
    const [editorLink, format, settings] = Array.from(nav.children);
    if (editorLink?.matches('a[data-editor-tab]') &&
        format?.matches('.kefe-toolbar-format') &&
        settings?.matches('button.kefe-header-settings[data-top-panel="settings"]')) {
      const linkProps = {};
      for (const { name, value } of editorLink.attributes) {
        linkProps[name === 'class' ? 'className' : name] = value;
      }
      linkProps.dangerouslySetInnerHTML = { __html: editorLink.innerHTML };
      const formatProps = {
        className: format.className,
        hidden: format.hidden,
        'aria-hidden': format.getAttribute('aria-hidden'),
        dangerouslySetInnerHTML: { __html: format.innerHTML },
      };
      const className = settings.className;
      settings.className = 'shad-btn shad-btn--ghost ' + className;
      settings.dataset.slot = 'button';
      settings.dataset.variant = 'ghost';
      settings.dataset.size = 'default';
      const buttonProps = {};
      for (const { name, value } of settings.attributes) {
        if (['class', 'data-slot', 'data-variant', 'data-size'].includes(name)) continue;
        buttonProps[name] = ['disabled', 'hidden'].includes(name) ? true : value;
      }
      buttonProps.className = className;
      buttonProps.variant = 'ghost';
      buttonProps.size = 'default';
      buttonProps.dangerouslySetInnerHTML = { __html: settings.innerHTML };
      Array.from(nav.childNodes).forEach(node => {
        if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) node.remove();
      });
      flushSync(() => hydrateRoot(nav, React.createElement(React.Fragment, null,
        React.createElement('a', linkProps),
        React.createElement('div', formatProps),
        React.createElement(Button, buttonProps))));
      nav.dataset.shadcnHydrated = 'true';
      settings.dataset.shadcnHydrated = 'true';
    }
  }

  const fullscreen = document.getElementById('previewFullscreen');
  if (fullscreen && !fullscreen.dataset.shadcnHydrated) {
    fullscreen.classList.add('shad-btn', 'shad-btn--ghost');
    fullscreen.dataset.slot = 'button';
    fullscreen.dataset.variant = 'ghost';
    fullscreen.dataset.size = 'icon';
    fullscreen.dataset.shadcnHydrated = 'true';
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountHeaderActions, { once: true });
else mountHeaderActions();
