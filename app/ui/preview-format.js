(() => {
  'use strict';

  const RATIOS = [
    { value: '9:16', label: '9:16', title: 'Vertical' },
    { value: '1:1', label: '1:1', title: 'Square' },
    { value: '16:9', label: '16:9', title: 'Horizontal' }
  ];

  function init() {
    const select = document.getElementById('aspectSelect');
    const host = document.getElementById('previewFormat');
    if (!select || !host) return;

    host.innerHTML = RATIOS.map(({ value, label, title }) =>
      `<button type="button" class="preview-format-btn" data-aspect="${value}" aria-label="${title} ${label}" title="${title} (${label})">${label}</button>`
    ).join('');

    const buttons = [...host.querySelectorAll('[data-aspect]')];

    function sync() {
      buttons.forEach((button) => {
        const active = button.dataset.aspect === select.value;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
    }

    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        if (select.value === button.dataset.aspect) return;
        select.value = button.dataset.aspect;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        sync();
      });
    });

    select.addEventListener('change', sync);
    sync();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
