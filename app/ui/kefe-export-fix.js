/* KEFE — export modal positioning guard.
   Keeps the existing export flow visible above the editor without adding
   another export control or competing with the shared KEFE visual system. */
(function(){
  'use strict';
  if (window.__kefeExportFix) return;
  window.__kefeExportFix = true;

  const MODALS = ['exportPreflight', 'exportOverlay'];

  function sync(modal) {
    if (!modal) return;
    const hidden = modal.classList.contains('hidden') || modal.hasAttribute('hidden');
    if (hidden) {
      modal.style.removeProperty('display');
      modal.style.removeProperty('visibility');
      return;
    }
    modal.style.setProperty('display', 'flex', 'important');
    modal.style.setProperty('visibility', 'visible', 'important');
  }

  function refresh() {
    MODALS.forEach(id => sync(document.getElementById(id)));
  }

  refresh();

  MODALS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    new MutationObserver(refresh).observe(el, {
      attributes: true,
      attributeFilter: ['class', 'hidden']
    });
  });
})();
