/* Hydrate the Settings action as a shadcn Button without inserting a wrapper.
   The original navigation children and fullscreen stage structure stay intact. */
import * as React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Button } from '../components/ui/button.js';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs.js';

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
      const linkClass = editorLink.className;
      editorLink.className = 'shad-btn shad-btn--ghost ' + linkClass;
      editorLink.dataset.slot = 'button';
      editorLink.dataset.variant = 'ghost';
      editorLink.dataset.size = 'default';
      const linkProps = {};
      for (const { name, value } of editorLink.attributes) {
        if (['class', 'data-slot', 'data-variant', 'data-size'].includes(name)) continue;
        linkProps[name] = value;
      }
      linkProps.className = linkClass;
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
        React.createElement(Button, { asChild: true, variant: 'ghost', size: 'default' },
          React.createElement('a', linkProps)),
        React.createElement('div', formatProps),
        React.createElement(Button, buttonProps))));
      nav.dataset.shadcnHydrated = 'true';
      settings.dataset.shadcnHydrated = 'true';
    }
  }

  const fullscreen = document.getElementById('previewFullscreen');
  if (fullscreen && !fullscreen.dataset.shadcnHydrated) {
    fullscreen.dataset.slot = 'button';
    fullscreen.dataset.variant = 'ghost';
    fullscreen.dataset.size = 'icon';
    fullscreen.dataset.shadcnHydrated = 'true';
  }
}
function mountEditorSectionTabs() {
  const nav = document.querySelector('.kefe-tabs');
  if (!nav || nav.dataset.shadcnRoot) return;
  nav.dataset.shadcnTabStatus = 'checking';
  const backingButtons = Array.from(nav.querySelectorAll(':scope > button.kefe-section[data-panel]'));
  if (backingButtons.length !== 6) {
    nav.dataset.shadcnTabStatus = `skipped:${backingButtons.length}:${Array.from(nav.children).map(node => node.tagName + '.' + node.className).join('|')}`;
    return;
  }
  const backing = document.createElement('div');
  backing.hidden = true;
  backing.setAttribute('aria-hidden', 'true');
  backing.dataset.kefeSectionBacking = 'true';
  backingButtons.forEach(button => backing.append(button));
  nav.after(backing);
  nav.dataset.slot = 'tabs';
  function SectionTabs() {
    const [value, setValue] = React.useState(backingButtons.find(button => button.classList.contains('active'))?.dataset.panel || 'media');
    React.useEffect(() => {
      const listeners = backingButtons.map(button => {
        const sync = () => setValue(button.dataset.panel);
        button.addEventListener('click', sync);
        return () => button.removeEventListener('click', sync);
      });
      return () => listeners.forEach(remove => remove());
    }, []);
    return React.createElement(Tabs, {
      value,
      onValueChange: next => {
        setValue(next);
        const target = backingButtons.find(button => button.dataset.panel === next);
        if (target && !target.classList.contains('active')) target.click();
      },
      style: { display: 'contents' },
    }, React.createElement(TabsList, {
      className: 'kefe-tabs-list',
      'aria-label': 'Editor sections',
    }, backingButtons.map(button => React.createElement(TabsTrigger, {
      key: button.dataset.panel,
      value: button.dataset.panel,
      className: 'kefe-section' + (value === button.dataset.panel ? ' active' : ''),
      'data-panel': button.dataset.panel,
      type: 'button',
    }, button.textContent.trim()))));
  }
  const root = createRoot(nav);
  try {
    flushSync(() => root.render(React.createElement(SectionTabs)));
    nav.dataset.shadcnRoot = 'true';
    nav.dataset.shadcnTabStatus = 'mounted';
  } catch (error) {
    nav.dataset.shadcnTabStatus = 'error:' + String(error?.message || error);
    throw error;
  }
  nav.dataset.shadcnTabStatus = 'mounted';
}

function mountWorkspaceDock() {
  const dock = document.querySelector('.kefe-workspace-dock');
  if (!dock || dock.dataset.shadcnHydrated) return;
  const elements = Array.from(dock.children).map((element, index) => {
    if (element.tagName !== 'BUTTON') {
      const props = {};
      for (const { name, value } of element.attributes) props[name === 'class' ? 'className' : name] = value;
      return React.createElement('span', {
        key: `dock-separator-${index}`, ...props,
        dangerouslySetInnerHTML: { __html: element.innerHTML },
      });
    }
    const className = element.className;
    element.className = 'shad-btn shad-btn--ghost ' + className;
    element.dataset.slot = 'button';
    element.dataset.variant = 'ghost';
    element.dataset.size = 'icon';
    const props = {};
    for (const { name, value } of element.attributes) {
      if (['class', 'data-slot', 'data-variant', 'data-size'].includes(name)) continue;
      props[name] = ['disabled', 'hidden'].includes(name) ? true : value;
    }
    return React.createElement(Button, {
      key: element.dataset.dockPanel || 'dock-export',
      variant: 'ghost', size: 'icon', className, ...props,
      dangerouslySetInnerHTML: { __html: element.innerHTML },
    });
  });
  Array.from(dock.childNodes).forEach(node => {
    if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) node.remove();
  });
  flushSync(() => hydrateRoot(dock, React.createElement(React.Fragment, null, ...elements)));
  dock.dataset.shadcnHydrated = 'true';
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { mountHeaderActions(); mountEditorSectionTabs(); mountWorkspaceDock(); }, { once: true });
else { mountHeaderActions(); mountEditorSectionTabs(); mountWorkspaceDock(); }
