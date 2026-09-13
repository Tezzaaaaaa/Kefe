/* KEFE — shows an "Uploaded media" confirmation card on the Media
   (source) step of the wizard, listing whichever audio or video the
   user has uploaded. Hidden on all other steps. */
(function(){
  'use strict';
  if (window.__kefeUploadSummary) return;
  window.__kefeUploadSummary = true;

  var css = document.createElement('style');
  css.id = 'kefe-upload-summary-css';
  css.textContent = [
    '#kefeUploadSummary{margin:14px 0 12px;padding:12px;border:1px solid rgba(48,209,88,.55);border-radius:10px;background:rgba(48,209,88,.06)}',
    '#kefeUploadSummary.hidden{display:none !important}',
    '#kefeUploadSummary .kefe-summary-title{font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#30d158;margin-bottom:8px}',
    '#kefeUploadSummary .kefe-summary-row{display:flex;align-items:center;gap:10px;font-size:12px;padding:7px 0;color:var(--text-2);border-top:1px solid rgba(48,209,88,.15)}',
    '#kefeUploadSummary .kefe-summary-row:first-child{border-top:0;padding-top:0}',
    '#kefeUploadSummary .kefe-summary-thumb{width:40px;height:40px;flex:0 0 40px;border-radius:7px;background:var(--surface-3);background-size:cover;background-position:center;border:1px solid rgba(48,209,88,.2);display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;overflow:hidden}',
    '#kefeUploadSummary .kefe-summary-thumb.audio{background:linear-gradient(135deg,var(--red),#a8241d)}',
    '#kefeUploadSummary .kefe-summary-row b{color:var(--text);font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1 1 auto;min-width:0}',
    '#kefeUploadSummary .kefe-summary-row em{color:var(--text-3);font-style:normal;font-size:11px;flex:0 0 auto}',
    '.kefe-upload-confirmation{display:none !important}'
  ].join('');
  document.head.appendChild(css);

  function esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }

  function getHost() {
    var step = document.body.dataset.wizardStep;
    if (step !== 'source') return null;
    return document.getElementById('wizardSection') || document.querySelector('.wizard-panel');
  }

  function buildRows() {
    var state = window.state || {};
    var media = window.kefeMedia || {};
    var rows = [];

    var af = state.audio && state.audio.file;
    if (af) {
      var info = [(state.audio.metadata||{}).title, (state.audio.metadata||{}).artist].filter(Boolean).join(' - ');
      rows.push(
        '<div class="kefe-summary-row">' +
          '<div class="kefe-summary-thumb audio">&#9835;</div>' +
          '<b>' + esc(af.name || 'Audio') + '</b>' +
          '<em>' + esc(info || 'Audio ready') + '</em>' +
        '</div>'
      );
    }

    if (media.videoFile) {
      rows.push(
        '<div class="kefe-summary-row">' +
          '<div class="kefe-summary-thumb">&#9654;</div>' +
          '<b>' + esc(media.videoFile.name) + '</b>' +
          '<em>Video' + (media.videoHasAudio ? ' - has audio' : '') + '</em>' +
        '</div>'
      );
    } else if (media.image) {
      rows.push(
        '<div class="kefe-summary-row">' +
          '<div class="kefe-summary-thumb" style="background-image:url(' + media.image.src + ');background-size:cover"></div>' +
          '<b>Background image</b>' +
          '<em>Image ready</em>' +
        '</div>'
      );
    }

    return rows;
  }

  function ensureBox(host) {
    var existing = document.getElementById('kefeUploadSummary');
    if (existing && existing.parentElement === host) return existing;
    if (existing) existing.remove();
    var box = document.createElement('div');
    box.id = 'kefeUploadSummary';
    box.innerHTML = '<div class="kefe-summary-title">Uploaded media</div><div id="kefeUploadSummaryList"></div>';
    var choices = host.querySelector('.wizard-source-choices') || host.querySelector('.wizard-choices');
    var mount = host.querySelector('#wizardMetadataMount');
    if (choices && choices.parentElement === host) choices.insertAdjacentElement('afterend', box);
    else if (mount && mount.parentElement === host) host.insertBefore(box, mount);
    else host.appendChild(box);
    return box;
  }

  function tick() {
    var host = getHost();
    var existing = document.getElementById('kefeUploadSummary');
    if (!host) { if (existing) existing.remove(); return; }
    var box = ensureBox(host);
    if (!box) return;
    var list = box.querySelector('#kefeUploadSummaryList');
    var rows = buildRows();
    if (rows.length) {
      box.classList.remove('hidden');
      var html = rows.join('');
      if (list.innerHTML !== html) list.innerHTML = html;
    } else {
      box.classList.add('hidden');
    }
  }

  tick();
  setInterval(tick, 300);
  ['click','change','input'].forEach(function(ev){
    document.addEventListener(ev, function(){ setTimeout(tick, 80); }, true);
  });

  console.log('[KEFE] upload summary moved to Media step');
})();
