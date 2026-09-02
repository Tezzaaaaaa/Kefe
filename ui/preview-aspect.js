/* KEFE preview — keep aspect ratio selection beside the timing controls. */
(() => {
  'use strict';

  const CSS = `
    .preview-aspect-control{display:inline-flex;align-items:center;gap:6px;flex:0 0 auto;margin-left:8px;white-space:nowrap}
    .preview-aspect-control span{font-size:10px;font-weight:650;color:var(--text-3);letter-spacing:.02em}
    .preview-aspect-control select{height:32px;min-width:126px;padding:0 25px 0 9px;border:1px solid var(--line);border-radius:8px;background:var(--surface-2);color:var(--text);font:650 10px/1 "Open Sans",Arial,sans-serif}
    .preview-aspect-control select:focus-visible{outline:2px solid var(--red);outline-offset:2px}
    @media(max-width:760px){.preview-aspect-control{margin-left:6px}.preview-aspect-control span{display:none}.preview-aspect-control select{min-width:92px}}
    @media(max-width:560px){.preview-aspect-control select{height:30px;min-width:82px;font-size:9px;padding-left:7px}}
  `;

  function init() {
    const transport = document.querySelector('.preview .transport');
    const seek = document.getElementById('seek');
    const source = document.getElementById('aspectSelect');
    if (!transport || !seek || !source || document.getElementById('previewAspectControl')) return;

    if (!document.getElementById('previewAspectCSS')) {
      const style = document.createElement('style');
      style.id = 'previewAspectCSS';
      style.textContent = CSS;
      document.head.appendChild(style);
    }

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
