/* KEFE preview — keep aspect ratio selection beside the timing controls. */
(() => {
  'use strict';

  function init() {
    const transport = document.querySelector('.preview .transport');
    const seek = document.getElementById('seek');
    const source = document.getElementById('aspectSelect');
    if (!transport || !seek || !source || document.getElementById('previewAspectControl')) return;

    const control = document.createElement('label');
    control.id = 'previewAspectControl';
    control.className = 'preview-aspect-control';
    control.setAttribute('aria-label', 'Preview aspect ratio');
    control.innerHTML = '<span>Aspect ratio</span>';

    const select = document.createElement('select');
    select.id = 'previewAspectSelect';
    select.setAttribute('aria-label', 'Preview aspect ratio');
    [...source.options].forEach(option => select.appendChild(option.cloneNode(true)));
    select.value = source.value || '9:16';
    control.appendChild(select);

    seek.insertAdjacentElement('afterend', control);

    const sync = () => {
      if (select.value !== source.value) select.value = source.value;
    };

    select.addEventListener('change', () => {
      source.value = select.value;
      source.dispatchEvent(new Event('change', { bubbles: true }));
      sync();
    });

    source.addEventListener('change', sync);
    sync();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
