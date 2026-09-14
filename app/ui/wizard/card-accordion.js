/* KEFE — pathway rows expand downward when selected.
   Plain implementation:
     - Inject one panel into each row on mount
     - Toggle the panel's inline max-height on click
     - Use requestAnimationFrame to guarantee the transition fires
   No observers, no grid-template-rows, no class dependencies. */
(function(){
  'use strict';
  if (window.__kefeCardAccordion) return;
  window.__kefeCardAccordion = true;

  var DETAILS = {
    lyric:     'The classic KEFE flow. Upload your song, sync the lyrics (automatic lookup or an LRC file), pick a lyric effect, choose a background, and export. Best when the lyrics are the main event.',
    visualiser:'No lyrics at all. The video reacts to your audio — pulsing with the beat, moving with the energy of the track. Good for instrumental releases, DJ sets, or anywhere the music should speak for itself.',
    captioned: 'For spoken word. Upload a video or a voice recording and KEFE transcribes it into timed caption blocks you can edit. Use this for interviews, vlogs, tutorials, or any video with dialogue.'
  };

  var css = document.createElement('style');
  css.id = 'kefe-card-accordion-css';
  css.textContent = [
    /* Row grows downward to fit the panel */
    '.wizard-choice {',
    '  display: block !important;',
    '  overflow: hidden !important;',
    '}',

    /* The content row (icon + copy) keeps its original inline-flex layout.
       The wizard uses grid already, so we don\'t fight that — we just add
       a full-width panel underneath. */
    '.kefe-accordion-panel {',
    '  max-height: 0;',
    '  overflow: hidden;',
    '  opacity: 0;',
    '  transition: max-height 340ms cubic-bezier(.2,.8,.2,1),',
    '              opacity 200ms ease 60ms,',
    '              margin-top 200ms ease;',
    '  margin-top: 0;',
    '  grid-column: 1 / -1;',
    '  width: 100%;',
    '}',

    '.kefe-accordion-panel.open {',
    '  max-height: 320px;',
    '  opacity: 1;',
    '  margin-top: 12px;',
    '}',

    '.kefe-accordion-inner {',
    '  padding: 0 0 4px 0;',
    '  font-size: 12.5px;',
    '  line-height: 1.55;',
    '  color: var(--text-3);',
    '  letter-spacing: -0.005em;',
    '}',

    /* When the row is selected (inverted fill), match the panel text */
    '.wizard-choice.selected .kefe-accordion-inner {',
    '  color: var(--bg);',
    '  opacity: 0.78;',
    '}'
  ].join('\n');
  document.head.appendChild(css);

  function keyFor(el) {
    return el.getAttribute('data-choice') || null;
  }

  function inject(row) {
    if (row.querySelector('.kefe-accordion-panel')) return;
    var key = keyFor(row);
    var text = DETAILS[key];
    if (!text) return;
    var panel = document.createElement('div');
    panel.className = 'kefe-accordion-panel';
    var inner = document.createElement('div');
    inner.className = 'kefe-accordion-inner';
    inner.textContent = text;
    panel.appendChild(inner);
    row.appendChild(panel);
  }

  function refresh() {
    var rows = document.querySelectorAll('#wizardSection .wizard-choice[data-choice]');
    rows.forEach(function(row) {
      inject(row);
      var panel = row.querySelector('.kefe-accordion-panel');
      if (!panel) return;
      var open = row.classList.contains('selected');
      if (open) {
        panel.style.setProperty('max-height', '320px');
        panel.style.setProperty('opacity', '1');
        panel.style.setProperty('margin-top', '12px');
      } else {
        panel.style.setProperty('max-height', '0px');
        panel.style.setProperty('opacity', '0');
        panel.style.setProperty('margin-top', '0px');
      }
    });
  }

  // React to the click directly — the wizard sets .selected in its own
  // handler, so we listen in the capture phase and refresh on the next frame.
  document.addEventListener('click', function(e) {
    if (!e.target || !e.target.closest) return;
    if (!e.target.closest('#wizardSection .wizard-choice')) return;
    requestAnimationFrame(refresh);
    setTimeout(refresh, 40);
    setTimeout(refresh, 120);
  }, true);

  // Safety net: keep state in sync if selection happens some other way.
  setInterval(refresh, 250);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refresh, { once: true });
  } else {
    refresh();
  }

  console.log('[KEFE] accordion active');
})();
