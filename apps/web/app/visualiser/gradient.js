/* KEFE Fluid Ink visualiser shell.
   Fluid Ink rendering and controls live in liquid-flow.js.
   This file owns only the shared visualiser tabs, heading power switch, and preset rail. */
(function () {
  'use strict';

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function buildPanel() {
    const panel = document.querySelector('[data-panel-view="visualiser"]');
    if (!panel || document.querySelector('.kefe-vis-tabs')) return;
    const form = panel.querySelector('.kefe-visualiser-form');
    if (!form) return;

    const view = element('div', 'kefe-vis-view kefe-gradient-view');
    view.id = 'kefeVisGradientView';
    view.hidden = true;

    const intro = element('div', 'kefe-visualiser-intro');
    const introContent = element('div');
    introContent.append(
      element('strong', '', 'Fluid Ink controls'),
      element('span', '', 'Audio-reactive fluid simulation and ink presets.')
    );
    intro.appendChild(introContent);
    view.appendChild(intro);

    const tabs = element('div', 'kefe-vis-tabs');
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'Choose visualiser');

    const tab = element('button', 'kefe-btn primary', 'Fluid Ink');
    tab.type = 'button';
    tab.setAttribute('role', 'tab');
    tab.dataset.visualiser = 'gradient';
    tab.dataset.icon = '≈';
    tab.setAttribute('aria-controls', view.id);
    tab.setAttribute('aria-label', 'Fluid Ink visualiser');
    tab.title = 'Fluid Ink visualiser';
    tab.setAttribute('aria-selected', 'true');
    const option = element('div', 'kefe-vis-option');
    option.appendChild(tab);
    tabs.appendChild(option);

    const presetRow = element('div', 'kefe-visualiser-preset-row');
    presetRow.id = 'kefeVisualiserPresetRow';
    const gradientPresetSet = element('div', 'kefe-visualiser-preset-set');
    gradientPresetSet.id = 'kefeGradientPresetSet';
    const flutedPresetSet = element('div', 'kefe-visualiser-preset-set');
    flutedPresetSet.id = 'kefeFlutedPresetSet';
    flutedPresetSet.hidden = true;
    presetRow.append(gradientPresetSet, flutedPresetSet);

    const header = panel.querySelector('.kefe-visualiser-panel-head');
    const heading = panel.querySelector('#kefeVisualiserHeading');
    const description = panel.querySelector('#kefeVisualiserDescription');
    let powerSlot = panel.querySelector('#kefeVisualiserPowerSlot');
    if (!powerSlot) {
      powerSlot = element('div', 'kefe-visualiser-power-slot');
      powerSlot.id = 'kefeVisualiserPowerSlot';
      powerSlot.setAttribute('aria-label', 'Selected visualiser power');
      if (header && description) header.insertBefore(powerSlot, description);
      else header?.appendChild(powerSlot);
    }

    const power = element('button', 'kefe-btn kefe-switch', '');
    power.type = 'button';
    power.setAttribute('role', 'switch');
    power.setAttribute('aria-checked', 'false');
    power.setAttribute('aria-label', 'Fluid Ink Visualiser');
    power.title = 'Fluid Ink Visualiser';
    const powerState = element('span', 'kefe-switch-state', 'Off');
    const powerTrack = element('span', 'kefe-switch-track');
    powerTrack.setAttribute('aria-hidden', 'true');
    powerTrack.appendChild(element('span', 'kefe-switch-thumb'));
    power.append(powerState, powerTrack);
    power.addEventListener('click', () => {
      const enabled = power.getAttribute('aria-checked') !== 'true';
      power.setAttribute('aria-checked', String(enabled));
      power.classList.toggle('is-on', enabled);
      powerState.textContent = enabled ? 'On' : 'Off';
    });
    powerSlot.replaceChildren(power);

    const editing = panel.closest('.kefe-editing');
    const panels = editing?.querySelector('.kefe-panels');
    if (editing && panels) {
      editing.insertBefore(tabs, panels);
      editing.insertBefore(presetRow, panels);
    } else {
      form.append(tabs, presetRow);
    }
    form.replaceChildren(view);

    function showFluidInk() {
      form.querySelectorAll('.kefe-vis-view').forEach(item => {
        item.hidden = item !== view;
      });
      tabs.querySelectorAll('[role="tab"]').forEach(item => {
        const selected = item === tab;
        item.classList.toggle('primary', selected);
        item.setAttribute('aria-selected', String(selected));
      });
      powerSlot.replaceChildren(power);
      power.setAttribute('aria-label', 'Fluid Ink Visualiser');
      power.title = 'Fluid Ink Visualiser';
      if (heading) heading.textContent = 'Fluid Ink Visualiser';
      if (description) description.textContent = 'Audio-reactive fluid dynamics with swirling ink, luminous colour and customizable presets.';
      presetRow.hidden = false;
      presetRow.querySelectorAll('.kefe-visualiser-preset-set').forEach(set => {
        set.hidden = set !== gradientPresetSet;
      });
      window.kefeFlutedGlassActive = false;
    }

    tab.addEventListener('click', showFluidInk);
    showFluidInk();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildPanel, { once: true });
  } else {
    buildPanel();
  }
})();
