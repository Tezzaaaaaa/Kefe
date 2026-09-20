/* KEFE — one consistent green confirmation style for every success state.
   Catches:
     - .status.success (audio, lyrics, captions, background, etc.)
     - #kefeUploadSummary (uploaded media card)
     - toast() success messages
     - wizard media-ready badge
   Nothing else needs to know this exists. */
(function(){
  'use strict';
  if (window.__kefeSuccessBoxes) return;
  window.__kefeSuccessBoxes = true;

  var css = document.createElement('style');
  css.id = 'kefe-success-boxes-css';
  css.textContent = [
    /* ---- Base green success palette ---- */
    ':root{',
    '  --kefe-success-bg: rgba(48,209,88,.10);',
    '  --kefe-success-bg-hover: rgba(48,209,88,.14);',
    '  --kefe-success-border: rgba(48,209,88,.55);',
    '  --kefe-success-border-strong: rgba(48,209,88,.78);',
    '  --kefe-success-text: #30d158;',
    '  --kefe-success-text-muted: rgba(48,209,88,.72);',
    '}',

    /* ---- Universal success status ---- */
    '.status.success{',
    '  display:block;',
    '  padding:9px 12px;',
    '  margin-top:6px;',
    '  border:1px solid var(--kefe-success-border);',
    '  border-radius:9px;',
    '  background:var(--kefe-success-bg);',
    '  color:var(--kefe-success-text) !important;',
    '  font-weight:600;',
    '  font-size:12px;',
    '  line-height:1.45;',
    '  transition:background .18s ease,border-color .18s ease;',
    '}',
    '.status.success::before{',
    '  content:"\\2713 " !important;',
    '  font-weight:800;',
    '  margin-right:2px;',
    '}',

    /* ---- Uploaded media summary ---- */
    '#kefeUploadSummary{',
    '  border-color:var(--kefe-success-border-strong) !important;',
    '  background:linear-gradient(135deg,var(--kefe-success-bg),transparent) !important;',
    '  box-shadow:0 0 0 1px rgba(48,209,88,.08),0 6px 20px rgba(48,209,88,.06);',
    '}',
    '#kefeUploadSummary .kefe-summary-title{',
    '  color:var(--kefe-success-text) !important;',
    '}',

    /* ---- Toast success ---- */
    '.toast.success{',
    '  background:#0b1e0e !important;',
    '  border-color:var(--kefe-success-border-strong) !important;',
    '  color:var(--kefe-success-text) !important;',
    '}',
    '.toast.success::before{',
    '  content:"\\2713  ";',
    '  font-weight:800;',
    '}',

    /* ---- Caption generator success ---- */
    '#captionGenStatus.status.success,',
    '#captionsStatus.status.success,',
    '#lyricsStatus.status.success,',
    '#audioStatus.status.success,',
    '#backgroundStatus.status.success,',
    '#editorStatus.status.success,',
    '#captionsEditorStatus.status.success{',
    '  background:var(--kefe-success-bg) !important;',
    '  border-color:var(--kefe-success-border) !important;',
    '  color:var(--kefe-success-text) !important;',
    '}',

    /* ---- Music intelligence "ready" ---- */
    '#kefeIntelStatus.kefe-ready,',
    '#kefeIntelStatus[data-state="ready"]{',
    '  padding:8px 11px;',
    '  border:1px solid var(--kefe-success-border);',
    '  border-radius:8px;',
    '  background:var(--kefe-success-bg);',
    '  color:var(--kefe-success-text);',
    '  font-weight:600;',
    '}',

    /* ---- Preview status when "Ready" ---- */
    '#previewStatus[data-state="ready"]{',
    '  color:var(--kefe-success-text);',
    '}',

    /* ---- Export complete overlay ---- */
    '#exportStatus.kefe-complete{',
    '  padding:10px 14px;',
    '  border-radius:9px;',
    '  background:var(--kefe-success-bg);',
    '  border:1px solid var(--kefe-success-border);',
    '  color:var(--kefe-success-text) !important;',
    '  font-weight:650;',
    '}'
  ].join('\n');
  document.head.appendChild(css);

  /* ---- Watch for the export overlay to flip to "complete" ---- */
  function watchExport() {
    var status = document.getElementById('exportStatus');
    if (!status) return;
    var text = (status.textContent || '').toLowerCase();
    if (/complete|finished|saved|done/.test(text)) {
      status.classList.add('kefe-complete');
    } else {
      status.classList.remove('kefe-complete');
    }
  }
  new MutationObserver(watchExport).observe(document.body, {
    childList: true, subtree: true, characterData: true
  });

  console.log('[KEFE] success boxes active');
})();
