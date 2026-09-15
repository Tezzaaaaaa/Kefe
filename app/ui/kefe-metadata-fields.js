/* KEFE — restore the metadata fields after page load.
   Injects them into the LYRICS section (where the wizard needs them),
   and also into the Media section when that step is active. Idempotent. */
(function(){
  'use strict';
  if (window.__kefeMetadataFields) return;
  window.__kefeMetadataFields = true;

  function fieldSpec() {
    return [
      { id: 'metaArtist', label: 'Artist', placeholder: 'Enter artist' },
      { id: 'metaTitle',  label: 'Title',  placeholder: 'Enter song title' },
      { id: 'metaAlbum',  label: 'Album',  placeholder: 'Enter album' }
    ];
  }

  function buildBlock() {
    var heading = document.createElement('div');
    heading.className = 'sub-heading music-details-heading';
    heading.textContent = 'Song details';

    var grid = document.createElement('div');
    grid.className = 'metadata-grid music-details';
    grid.setAttribute('aria-label', 'Song details');

    fieldSpec().forEach(function(spec) {
      var lab = document.createElement('label');
      lab.className = 'music-slot';
      lab.setAttribute('for', spec.id);

      var span = document.createElement('span');
      span.textContent = spec.label;

      var inp = document.createElement('input');
      inp.type = 'text';
      inp.id = spec.id;
      inp.autocomplete = 'off';
      inp.placeholder = spec.placeholder;

      inp.addEventListener('input', function() {
        var s = window.state;
        if (!s || !s.audio || !s.audio.metadata) return;
        var key = spec.id === 'metaTitle' ? 'title' : spec.id === 'metaArtist' ? 'artist' : 'album';
        s.audio.metadata[key] = inp.value.trim();
        s.audio.metadataSource = 'manual';
        // Also let app.js know via its normal event path.
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      });

      lab.appendChild(span);
      lab.appendChild(inp);
      grid.appendChild(lab);
    });

    return { heading: heading, grid: grid };
  }

  function currentHost() {
    // Where should the fields live right now?
    // If the wizard is on the Lyrics or Captions step, put them in the
    // Lyrics panel (or the wizard panel). Otherwise Media section.
    var step = document.body.dataset.wizardStep;
    if (step === 'lyrics' || step === 'captions') {
      var lyricsPanel = document.getElementById('lyricsPanel');
      var wizPanel = document.getElementById('wizardSection');
      // Prefer a visible parent.
      if (lyricsPanel && lyricsPanel.offsetParent !== null) return lyricsPanel;
      if (wizPanel) return wizPanel;
    }
    var audioSection = document.getElementById('audioSection');
    if (audioSection) return audioSection;
    var wizPanel2 = document.getElementById('wizardSection');
    if (wizPanel2) return wizPanel2;
    return null;
  }

  function inject() {
    var existing = document.getElementById('metaArtist');
    var host = currentHost();
    if (!host) return;

    // If the fields exist but are in the wrong section, move them.
    if (existing) {
      var existingSection = existing.closest('.section, #lyricsPanel, #wizardSection');
      if (existingSection === host || (host.contains && host.contains(existing))) {
        return; // already in the right place
      }
      // Move the whole block.
      var wrapper = existing.closest('.metadata-grid');
      var headingEl = wrapper && wrapper.previousElementSibling;
      if (wrapper) wrapper.remove();
      if (headingEl && headingEl.classList && headingEl.classList.contains('music-details-heading')) headingEl.remove();
    }

    var block = buildBlock();
    // Insert at the top of the host so it sits above the drop-zone/status.
    host.insertBefore(block.grid, host.firstChild);
    host.insertBefore(block.heading, host.firstChild);

    // Restore values from state if present.
    var s = window.state;
    if (s && s.audio && s.audio.metadata) {
      var a = document.getElementById('metaArtist');
      var t = document.getElementById('metaTitle');
      var al = document.getElementById('metaAlbum');
      if (a) a.value = s.audio.metadata.artist || '';
      if (t) t.value = s.audio.metadata.title || '';
      if (al) al.value = s.audio.metadata.album || '';
    }

    console.log('[KEFE] metadata fields injected into', host.id || host.className);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject, { once: true });
  } else {
    inject();
  }
  setTimeout(inject, 400);
  setTimeout(inject, 1200);

  // Re-check on wizard step changes.
  var lastStep = null;
  setInterval(function() {
    var step = document.body.dataset.wizardStep;
    if (step !== lastStep) {
      lastStep = step;
      inject();
    }
  }, 500);
})();
