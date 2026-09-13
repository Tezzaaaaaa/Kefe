(function(){
  'use strict';
  if (window.__kefeRearrange) return;
  window.__kefeRearrange = true;

  /* 1. Effect buttons — give every button the same base look so the ones
        without a bespoke visual signature (decrypt/blur/shiny/pulse/rise/
        slide/drop/drift/scrolllines) still read as proper buttons. */
  var css = document.createElement('style');
  css.id = 'kefe-rearrange-css';
  css.textContent = [
    '#lyricStyleBlock .effect-buttons{display:grid !important;grid-template-columns:repeat(2,minmax(0,1fr)) !important;gap:8px !important}',
    '#lyricStyleBlock .effect-buttons > button{',
    '  position:relative !important;isolation:isolate;overflow:hidden;',
    '  min-height:68px !important;padding:10px 12px !important;',
    '  border:1px solid var(--line) !important;border-radius:10px !important;',
    '  background:var(--surface-2) !important;color:var(--text) !important;',
    '  font-size:12px !important;font-weight:600 !important;',
    '  white-space:normal !important;text-align:center !important;',
    '  display:flex !important;align-items:center !important;justify-content:center !important;',
    '}',
    '#lyricStyleBlock .effect-buttons > button.active-effect{',
    '  border-color:var(--red) !important;box-shadow:0 0 0 1px var(--red) !important;',
    '}',
    /* 2. Hide the standalone UPLOADED cards in media/background sections;
          they get re-shown in the consolidated list in the Lyrics section. */
    '.kefe-upload-confirmation{display:none !important}',
    '#kefeUploadSummary{margin:0 0 12px;padding:10px 12px;border:1px solid rgba(48,209,88,.55);border-radius:10px;background:rgba(48,209,88,.06)}',
    '#kefeUploadSummary .kefe-summary-title{font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#30d158;margin-bottom:6px}',
    '#kefeUploadSummary .kefe-summary-row{display:flex;align-items:center;gap:8px;font-size:12px;padding:4px 0;color:var(--text-2)}',
    '#kefeUploadSummary .kefe-summary-row b{color:var(--text);font-weight:650;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '#kefeUploadSummary .kefe-summary-row span.check{color:#30d158;font-weight:800}',
    '#kefeUploadSummary .kefe-summary-row em{color:var(--text-3);font-style:normal;font-size:11px}',
    '#kefeUploadSummary.hidden{display:none !important}'
  ].join('');
  document.head.appendChild(css);

  /* 3. Build the consolidated "Uploaded media" block in the Lyrics section. */
  function ensureSummary() {
    var lyricsPanel = document.getElementById('lyricsPanel');
    if (!lyricsPanel) return null;
    var existing = document.getElementById('kefeUploadSummary');
    if (existing) return existing;
    var box = document.createElement('div');
    box.id = 'kefeUploadSummary';
    box.className = 'hidden';
    box.innerHTML = '<div class="kefe-summary-title">Uploaded media</div><div id="kefeUploadSummaryList"></div>';
    var anchor = document.getElementById('lyricsStatus');
    if (anchor && anchor.parentElement === lyricsPanel) lyricsPanel.insertBefore(box, anchor);
    else lyricsPanel.insertBefore(box, lyricsPanel.firstChild);
    return box;
  }

  function refreshSummary() {
    var box = ensureSummary();
    if (!box) return;
    var list = box.querySelector('#kefeUploadSummaryList');
    var rows = [];

    var state = window.state || {};
    var media = window.kefeMedia || {};
    var af = state.audio && state.audio.file;
    if (af) {
      var audioInfo = [(state.audio.metadata||{}).title, (state.audio.metadata||{}).artist].filter(Boolean).join(' - ');
      rows.push('<div class="kefe-summary-row"><span class="check">&#10003;</span><b>' + escapeHtml(af.name || 'Audio') + '</b><em>' + (audioInfo ? escapeHtml(audioInfo) : 'Audio ready') + '</em></div>');
    }
    if (media.videoFile) {
      rows.push('<div class="kefe-summary-row"><span class="check">&#10003;</span><b>' + escapeHtml(media.videoFile.name) + '</b><em>Video' + (media.videoHasAudio ? ' · has audio' : '') + '</em></div>');
    } else if (media.image) {
      rows.push('<div class="kefe-summary-row"><span class="check">&#10003;</span><b>Image</b><em>Background image ready</em></div>');
    }

    if (!rows.length) {
      box.classList.add('hidden');
      list.innerHTML = '';
    } else {
      box.classList.remove('hidden');
      var html = rows.join('');
      if (list.innerHTML !== html) list.innerHTML = html;
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function(c){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
    });
  }

  /* 4. Move the Title card sub-block from #backgroundSection to the
        Lyrics section. Runs on a loop because the wizard rebuilds DOM. */
  function moveTitleCard() {
    var text = document.getElementById('textSection');
    if (!text) return;
    var lyricsPanel = document.getElementById('lyricsPanel');
    if (!lyricsPanel) return;

    var titleBlock = document.getElementById('kefeTitleCardBlock');
    if (!titleBlock) {
      // Find it in background section by its heading.
      var bg = document.getElementById('backgroundSection');
      if (!bg) return;
      var heads = bg.querySelectorAll('.sub-heading');
      for (var i = 0; i < heads.length; i++) {
        if (heads[i].textContent.trim().toLowerCase() === 'title card') {
          var block = heads[i].closest('.sub-block');
          if (block) { block.id = 'kefeTitleCardBlock'; titleBlock = block; }
          break;
        }
      }
    }
    if (!titleBlock) return;
    if (titleBlock.parentElement === lyricsPanel) return; // already home

    // Insert after the upload summary (or at the top of the lyrics panel).
    var summary = document.getElementById('kefeUploadSummary');
    if (summary && summary.parentElement === lyricsPanel) {
      summary.insertAdjacentElement('afterend', titleBlock);
    } else {
      lyricsPanel.appendChild(titleBlock);
    }
  }

  function tick() { refreshSummary(); moveTitleCard(); }

  tick();
  setInterval(tick, 400);
  ['click','change','input'].forEach(function(ev){
    document.addEventListener(ev, function(){ setTimeout(tick, 60); }, true);
  });
  console.log('[KEFE rearrange] active');
})();
