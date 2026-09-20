(function(){
  'use strict';
  if (window.__kefeExportFix) return;
  window.__kefeExportFix = true;

  // Remove any leftover debug box from previous sessions
  var oldDebug = document.getElementById('kefeExportDebug');
  if (oldDebug) oldDebug.remove();

  var MODALS = ['exportPreflight', 'exportOverlay'];

  function force(modal) {
    if (!modal) return;
    if (modal.classList.contains('hidden') || modal.hasAttribute('hidden')) {
      // Not meant to be shown — leave it alone.
      modal.style.removeProperty('display');
      modal.style.removeProperty('visibility');
      modal.style.removeProperty('position');
      modal.style.removeProperty('inset');
      modal.style.removeProperty('z-index');
      modal.style.removeProperty('align-items');
      modal.style.removeProperty('justify-content');
      modal.style.removeProperty('background');
      var mc = modal.querySelector('.modal-content');
      if (mc) mc.style.removeProperty('background');
      return;
    }
    // Visible — force it to actually appear above everything.
    modal.style.setProperty('display', 'flex', 'important');
    modal.style.setProperty('visibility', 'visible', 'important');
    modal.style.setProperty('opacity', '1', 'important');
    modal.style.setProperty('position', 'fixed', 'important');
    modal.style.setProperty('top', '0', 'important');
    modal.style.setProperty('left', '0', 'important');
    modal.style.setProperty('right', '0', 'important');
    modal.style.setProperty('bottom', '0', 'important');
    modal.style.setProperty('z-index', '999998', 'important');
    modal.style.setProperty('align-items', 'center', 'important');
    modal.style.setProperty('justify-content', 'center', 'important');
    modal.style.setProperty('background', 'rgba(0,0,0,.65)', 'important');
    var mc = modal.querySelector('.modal-content');
    if (mc) {
      mc.style.setProperty('background', 'var(--surface)', 'important');
      mc.style.setProperty('color', 'var(--text)', 'important');
      mc.style.setProperty('max-width', '600px', 'important');
      mc.style.setProperty('max-height', '85vh', 'important');
      mc.style.setProperty('overflow', 'auto', 'important');
      mc.style.setProperty('border-radius', '14px', 'important');
      mc.style.setProperty('padding', '0', 'important');
    }
  }

  function refresh() {
    MODALS.forEach(function(id){
      force(document.getElementById(id));
    });
  }

  refresh();
  // Watch every modal for class changes
  MODALS.forEach(function(id){
    var el = document.getElementById(id);
    if (!el) return;
    new MutationObserver(refresh).observe(el, { attributes: true, attributeFilter: ['class','style','hidden'] });
  });

  console.log('[KEFE export-fix] active');
})();
