'use strict';

const KEFE_STRUCTURE=("\n<div class=\"kefe-editor\">\n<header class=\"kefe-sidebar\" role=\"banner\" aria-label=\"KEFE header\">\n  <div class=\"kefe-sidebar-brand-row\"><a class=\"kefe-sidebar-brand\" href=\"./editor.html\" aria-label=\"KEFE editor home\"><span>KEFE</span></a></div>\n  <nav class=\"kefe-sidebar-group kefe-sidebar-group-editor\" aria-label=\"Workspace\"><a class=\"kefe-sidebar-link kefe-sidebar-editor-link is-current\" href=\"./editor.html\" data-editor-tab aria-current=\"page\" aria-label=\"Editor\" title=\"Editor — open the editor sections\"><span class=\"kefe-sidebar-link-label\">Editor</span></a></nav>\n  <div class=\"kefe-sidebar-bottom\" role=\"group\" aria-label=\"Editor actions\"><button class=\"kefe-sidebar-link kefe-header-settings\" type=\"button\" data-top-panel=\"settings\" aria-label=\"Settings\" title=\"Settings\"><span aria-hidden=\"true\"><span data-kefe-icon=\"settings\" aria-hidden=\"true\"></span></span></button><button class=\"kefe-sidebar-link kefe-theme-toggle\" id=\"kefeThemeToggle\" type=\"button\" data-top-panel=\"theme\" aria-label=\"Switch to day mode\" title=\"Switch to day mode\"><span aria-hidden=\"true\"><span data-kefe-icon=\"sun\" aria-hidden=\"true\"></span></span></button><button class=\"kefe-sidebar-link kefe-header-search\" type=\"button\" data-command-open aria-label=\"Search KEFE\" title=\"Search KEFE\"><span aria-hidden=\"true\"><span data-kefe-icon=\"search\" aria-hidden=\"true\"></span></span></button><a class=\"kefe-sidebar-link kefe-sidebar-github\" href=\"https://github.com/Tezzaaaaaa/Kefe\" target=\"_blank\" rel=\"noopener noreferrer\" aria-label=\"KEFE on GitHub\" title=\"KEFE on GitHub\"><span aria-hidden=\"true\"><span data-kefe-icon=\"github\" aria-hidden=\"true\"></span></span></a></div>\n</header>\n\n<main class=\"kefe-work\">\n  <section class=\"kefe-preview\">\n    <div class=\"kefe-preview-toolbar\" role=\"toolbar\" aria-label=\"Preview toolbar\">\n      <div class=\"kefe-toolbar-workspace\"><span class=\"kefe-toolbar-live-dot\" aria-hidden=\"true\"></span><span class=\"kefe-toolbar-title\">Preview</span></div>\n      <div class=\"kefe-toolbar-format\" hidden aria-hidden=\"true\">\n        <select id=\"kefeAspect\" class=\"kefe-aspect-trigger kefe-aspect-native\" aria-label=\"Preview aspect ratio\" tabindex=\"-1\"><option value=\"16:9\">16:9</option><option value=\"9:16\">9:16</option><option value=\"1:1\">1:1</option></select>\n      </div>\n      <div class=\"kefe-toolbar-actions\">\n        <span class=\"kefe-toolbar-status\">Canvas</span>\n        <button class=\"kefe-preview-fullscreen\" id=\"previewFullscreen\" type=\"button\" aria-label=\"Enter fullscreen\" title=\"Enter fullscreen\">\n          <span data-kefe-icon=\"maximize\" aria-hidden=\"true\"></span>\n        </button>\n      </div>\n    </div>\n    <div class=\"kefe-stage is-16x9\">\n      <canvas id=\"kefeCanvas\" width=\"1280\" height=\"720\"></canvas>\n    </div>\n  </section>\n\n  <section class=\"kefe-timeline\" aria-label=\"Timeline\">\n    <div class=\"kefe-transport\">\n      <button class=\"kefe-play beui-button\" id=\"playButton\" type=\"button\" aria-label=\"Play\" title=\"Play\"><span data-kefe-icon=\"play\" aria-hidden=\"true\"></span></button><button class=\"kefe-restart beui-button\" id=\"restartButton\" type=\"button\" aria-label=\"Restart playback\" title=\"Restart playback\"><span data-kefe-icon=\"reset\" aria-hidden=\"true\"></span></button>\n    </div>\n    <div class=\"kefe-wave kefe-timebar\" id=\"waveform\"><div class=\"kefe-time\" aria-label=\"Playback time\"><span id=\"timeNow\">0:00</span><span aria-hidden=\"true\">/</span><span id=\"timeEnd\">0:30</span></div><input id=\"kefeTime\" class=\"kefe-slider\" type=\"range\" min=\"0\" max=\"30\" step=\".01\" value=\"0\" aria-label=\"Timeline\"><div class=\"playhead\" id=\"playhead\" aria-hidden=\"true\"></div></div>    <div class=\"kefe-volume-control\" aria-label=\"Audio volume\"><button id=\"kefeMuteToggle\" type=\"button\" aria-label=\"Audio volume options\" title=\"Audio volume options\" aria-expanded=\"false\" aria-controls=\"kefeVolumePopover\"><span data-kefe-icon=\"volume\" aria-hidden=\"true\"></span></button><div class=\"kefe-volume-popover\" id=\"kefeVolumePopover\" hidden><label for=\"kefeVolume\">Volume</label><input class=\"beui-slider\" id=\"kefeVolume\" type=\"range\" min=\"0\" max=\"100\" step=\"1\" value=\"100\" aria-label=\"Audio volume\"><output id=\"kefeVolumeValue\" for=\"kefeVolume\">100%</output></div></div>\n  </section>\n\n</main>\n\n<section class=\"kefe-editing\">\n    <nav class=\"kefe-tabs\" aria-label=\"Editor sections\">\n      <button class=\"kefe-section active\" data-panel=\"media\">Media</button>\n      <button class=\"kefe-section\" data-panel=\"lyrics\">Lyric Sync</button>\n      <button class=\"kefe-section\" data-panel=\"effects\">Lyric Effects</button>\n      <button class=\"kefe-section\" data-panel=\"background-effects\">Background Effects</button>\n      <button class=\"kefe-section\" data-panel=\"visualiser\">Visualisers</button>\n      <button class=\"kefe-section\" data-panel=\"export\">Export</button>\n    </nav>\n\n    <div class=\"kefe-panels\">\n      <section class=\"kefe-panel active\" data-panel-view=\"media\">\n        <div class=\"kefe-panel-head\"><h2>Media</h2><span class=\"kefe-meta\">Import audio or video, identify the track, and confirm its details.</span></div>\n        <div class=\"kefe-form\">\n          <label class=\"kefe-upload-zone\" id=\"kefeUploadZone\" for=\"mediaInput\">\n            <div class=\"kefe-upload-card\">\n            <span class=\"beui-upload-symbol\" aria-hidden=\"true\"><span data-kefe-icon=\"audio-lines\" aria-hidden=\"true\"></span></span>\n            <span class=\"kefe-upload-title\">Audio or video</span>\n            <span class=\"kefe-upload-help\">Your source track for lyrics and audio-reactive visuals.</span>\n            <span class=\"kefe-upload-name\">Drop file here or browse</span>\n            <span class=\"beui-upload-browse\">Browse files</span>\n            <input class=\"kefe-file\" id=\"mediaInput\" type=\"file\" accept=\".mp3,.m4a,.wav,.aac,.flac,.ogg,.oga,.opus,.aiff,.caf,.mp4,.mov,.m4v,.webm,.avi,audio/*,video/*\">\n                      </div>\n          </label>\n          <div class=\"kefe-media-track\" id=\"kefeMediaTrack\" hidden>\n            <div class=\"kefe-media-track-art\" id=\"kefeMediaTrackArt\"><div class=\"kefe-media-track-fallback\" id=\"kefeMediaTrackFallback\">K</div></div>\n            <div class=\"kefe-media-track-info\">\n              <p class=\"kefe-media-track-kicker\">Identified track</p>\n              <h3 id=\"kefeMediaTrackTitle\">Untitled</h3>\n              <p id=\"kefeMediaTrackArtist\">Unknown artist</p>\n              <div class=\"kefe-media-track-meta\"><span id=\"kefeMediaTrackAlbum\"></span><span id=\"kefeMediaTrackYear\"></span></div>\n            </div>\n          </div>\n          <div class=\"kefe-suggestions\" id=\"kefeSuggestions\" hidden>\n            <div class=\"kefe-suggestions-head\"><span class=\"kefe-suggestions-title\">Suggestions</span><span class=\"kefe-suggestions-status\" id=\"kefeSuggestionsStatus\">Finding matches<span class=\"kefe-percent-loader\" role=\"status\" aria-label=\"Loading\"><span class=\"kefe-percent-value\">0%</span><span class=\"kefe-percent-track\"><span class=\"kefe-percent-fill\"></span></span></span></span></div>\n            <div class=\"kefe-suggestion-list\" id=\"kefeSuggestionList\"></div>\n          </div>\n          <div><label class=\"kefe-label\" for=\"songTitle\">Track title</label><input class=\"kefe-input\" id=\"songTitle\" type=\"text\" placeholder=\"Track title\"></div>\n          <div><label class=\"kefe-label\" for=\"songArtist\">Artist</label><input class=\"kefe-input\" id=\"songArtist\" type=\"text\" placeholder=\"Artist\"></div>\n          <div><label class=\"kefe-label\" for=\"songAlbum\">Album</label><input class=\"kefe-input\" id=\"songAlbum\" type=\"text\" placeholder=\"Album\"></div>\n          <div><label class=\"kefe-label\" for=\"songYear\">Year</label><input class=\"kefe-input\" id=\"songYear\" type=\"text\" placeholder=\"Year\"></div>\n          \n        </div>\n      </section>\n\n      <section class=\"kefe-panel\" data-panel-view=\"lyrics\">\n        <div class=\"kefe-panel-head\"><h2>Lyric Sync</h2><span class=\"kefe-meta\" id=\"kefeLyricsStatus\">Find, import and edit synchronised lyrics for your track.</span></div>\n        <div class=\"kefe-form\">\n          <div>\n            <label class=\"kefe-label\" for=\"lyricsInput\">Fetched lyrics</label>\n            <textarea class=\"kefe-textarea\" id=\"lyricsInput\" spellcheck=\"false\" placeholder=\"Synchronised lyrics will appear here after a track is identified.\"></textarea>\n          </div>\n          <div class=\"kefe-lyrics-timing\" aria-labelledby=\"lyricsTimingLabel\">\n            <div class=\"kefe-lyrics-timing-head\">\n              <div>\n                <div class=\"kefe-label\" id=\"lyricsTimingLabel\">Lyrics timing</div>\n                <div class=\"kefe-meta\">Shift all synchronised lyrics earlier or later while preserving their relative timing.</div>\n              </div>\n              <output class=\"kefe-lyrics-timing-value\" id=\"lyricsTimingValue\" for=\"lyricsTiming\">0.00s</output>\n            </div>\n            <div class=\"kefe-lyrics-timing-controls\">\n              <button class=\"kefe-btn kefe-lyrics-timing-step\" id=\"lyricsTimingEarlier\" type=\"button\" aria-label=\"Move lyrics 0.10 seconds earlier\">−0.10s</button>\n              <input id=\"lyricsTiming\" class=\"kefe-slider kefe-lyrics-timing-slider\" type=\"range\" min=\"-3\" max=\"3\" step=\"0.05\" value=\"0\" aria-label=\"Lyrics timing offset\">\n              <button class=\"kefe-btn kefe-lyrics-timing-step\" id=\"lyricsTimingLater\" type=\"button\" aria-label=\"Move lyrics 0.10 seconds later\">+0.10s</button>\n            </div>\n            <div class=\"kefe-lyrics-timing-foot\">\n              <span>−3s</span>\n              <button class=\"kefe-btn kefe-lyrics-timing-reset\" id=\"lyricsTimingReset\" type=\"button\">Reset</button>\n              <span>+3s</span>\n            </div>\n          </div>\n        </div>\n      </section>\n\n      \n\n      <section class=\"kefe-panel\" data-panel-view=\"effects\">\n        <div class=\"kefe-panel-head kefe-effects-panel-head\"><div class=\"kefe-effects-heading\"><h2>Lyric Effects</h2><span class=\"kefe-meta\">Choose a lyric effect, font and typography.</span></div><div class=\"kefe-lyrics-power\"><span>Lyrics</span><button class=\"kefe-switch is-on\" id=\"lyricsEnabledToggle\" type=\"button\" role=\"switch\" aria-checked=\"true\" aria-label=\"Lyrics on/off\" title=\"Turn lyrics off\"><span class=\"kefe-switch-state\">On</span><span class=\"kefe-switch-track\" aria-hidden=\"true\"><span class=\"kefe-switch-thumb\"></span></span></button></div></div>\n        <div class=\"kefe-form\">\n          <div class=\"kefe-background-effect-control kefe-lyric-effects-control\">\n            <label class=\"kefe-label\">Lyric effects</label>\n            <div class=\"kefe-lyric-effect-grid\" id=\"lyricEffectOptions\" role=\"group\" aria-label=\"Lyric effect gallery; select an effect to apply it to the live preview\" tabindex=\"0\"></div>\n          </div>\n          <div class=\"kefe-background-effect-control kefe-font-selector-control\">\n            <div class=\"kefe-font-selector-heading\">\n              <label class=\"kefe-label\" id=\"kefeFontSelectorLabel\" for=\"fontOverride\">Font</label>\n              <span class=\"kefe-meta\" id=\"fontMeta\">Effect font</span>\n            </div>\n            <select class=\"kefe-select kefe-font-dropdown\" id=\"fontOverride\" aria-labelledby=\"kefeFontSelectorLabel\"><option value=\"\">Use effect font</option></select>\n            <div class=\"kefe-font-selector-strip\" id=\"kefeFontOptions\" hidden aria-hidden=\"true\"></div>\n            <span class=\"kefe-sr-only\" id=\"fontName\">SF Pro Display</span>\n          </div>\n                  </div>\n      </section>\n\n      <section class=\"kefe-panel\" data-panel-view=\"background-effects\">\n        <div class=\"kefe-panel-head\"><h2>Background Effects</h2><span class=\"kefe-meta\">Choose the canvas background or add a background video.</span></div>\n        <div class=\"kefe-form\">\n          <div class=\"kefe-background-effect-control\">\n            <label class=\"kefe-label\" for=\"visualiserBackground\">Background</label>\n            <select class=\"kefe-select\" id=\"visualiserBackground\">\n              <option value=\"apple\">Apple Motion Art</option>\n              <option value=\"video\" disabled>Uploaded video</option>\n            </select>\n          </div>\n          <div class=\"kefe-background-effect-control\">\n            <label class=\"kefe-label\" for=\"backgroundTransparency\">Background darkness <output id=\"backgroundTransparencyValue\" for=\"backgroundTransparency\">0%</output></label>\n            <input class=\"kefe-background-transparency\" id=\"backgroundTransparency\" type=\"range\" min=\"0\" max=\"100\" step=\"1\" value=\"0\" aria-label=\"Background darkness; increase to darken the background behind lyrics\">\n            <p class=\"kefe-meta\">Increase darkness to improve lyric contrast.</p>\n          </div>\n        </div>\n      </section>\n\n      <section class=\"kefe-panel\" data-panel-view=\"visualiser\">\n        <div class=\"kefe-panel-head kefe-visualiser-panel-head\"><h2 id=\"kefeVisualiserHeading\">Visualisers</h2><span class=\"kefe-meta\" id=\"kefeVisualiserDescription\"></span></div>\n        <div class=\"kefe-vis-tabs\" role=\"tablist\" aria-label=\"Visualiser effects\"></div>\n        <div class=\"kefe-form kefe-visualiser-form\"></div>\n      </section>\n\n      <section class=\"kefe-panel\" data-panel-view=\"export\">\n        <div class=\"kefe-panel-head\"><h2>Export</h2><span class=\"kefe-meta\">Export your lyric video with its selected visualiser.</span></div>\n        <div class=\"kefe-form\">\n          <select class=\"kefe-select\" id=\"exportFormat\" aria-label=\"Export format\"><option value=\"webm\">WebM video</option><option value=\"mp4\">MP4 (H.264/AAC where supported)</option></select>\n          <select class=\"kefe-select\" id=\"exportResolution\" aria-label=\"Export resolution\"><option value=\"720\">720p</option><option value=\"1080\" selected>1080p</option><option value=\"1440\">1440p (2K)</option><option value=\"2160\">2160p (4K)</option></select>\n          <button class=\"kefe-btn primary\" id=\"exportButton\" type=\"button\">Export video</button>\n          <div class=\"kefe-empty-panel\" id=\"exportStatus\" role=\"status\" aria-live=\"polite\"></div>\n        </div>\n      </section>\n    </div>\n  </section>\n\n</div>\n<nav class=\"kefe-workspace-dock\" aria-label=\"Workspace shortcuts\"><button type=\"button\" data-dock-panel=\"media\" aria-label=\"Media\" title=\"Media\"><span aria-hidden=\"true\"><span data-kefe-icon=\"folder\" aria-hidden=\"true\"></span></span></button><button type=\"button\" data-dock-panel=\"lyrics\" aria-label=\"Lyrics\" title=\"Lyrics\"><span aria-hidden=\"true\"><span data-kefe-icon=\"list-music\" aria-hidden=\"true\"></span></span></button><button type=\"button\" data-dock-panel=\"effects\" aria-label=\"Effects\" title=\"Effects\"><span aria-hidden=\"true\"><span data-kefe-icon=\"sparkles\" aria-hidden=\"true\"></span></span></button><button type=\"button\" data-dock-panel=\"background-effects\" aria-label=\"Background Effects\" title=\"Background Effects\"><span aria-hidden=\"true\"><span data-kefe-icon=\"edit\" aria-hidden=\"true\"></span></span></button><button type=\"button\" data-dock-panel=\"visualiser\" aria-label=\"Visualisers\" title=\"Visualisers\"><span aria-hidden=\"true\"><span data-kefe-icon=\"activity\" aria-hidden=\"true\"></span></span></button><span aria-hidden=\"true\" class=\"kefe-dock-separator\"></span><button type=\"button\" data-dock-export aria-label=\"Export video\" title=\"Export video\"><span aria-hidden=\"true\"><span data-kefe-icon=\"upload\" aria-hidden=\"true\"></span></span></button><button type=\"button\" data-command-open aria-label=\"Settings and commands\" title=\"Settings and commands\"><span aria-hidden=\"true\"><span data-kefe-icon=\"settings\" aria-hidden=\"true\"></span></span></button></nav>\n<div class=\"kefe-command-overlay\" id=\"kefeCommandPalette\" hidden><section class=\"kefe-command-dialog\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"kefeCommandTitle\"><div class=\"kefe-command-search\"><span aria-hidden=\"true\"><span data-kefe-icon=\"search\" aria-hidden=\"true\"></span></span><label class=\"kefe-sr-only\" id=\"kefeCommandTitle\" for=\"kefeCommandInput\">Search workspace commands</label><input id=\"kefeCommandInput\" type=\"search\" autocomplete=\"off\" placeholder=\"Search workspace commands…\"><kbd>ESC</kbd></div><div class=\"kefe-command-list\" id=\"kefeCommandList\"><button type=\"button\" data-command=\"panel:media\"><span>Open Media</span><kbd>1</kbd></button><button type=\"button\" data-command=\"panel:lyrics\"><span>Open Lyric Sync</span><kbd>2</kbd></button><button type=\"button\" data-command=\"panel:effects\"><span>Open Lyric Effects</span><kbd>3</kbd></button><button type=\"button\" data-command=\"panel:background-effects\"><span>Open Background Effects</span></button><button type=\"button\" data-command=\"panel:visualiser\"><span>Open Visualisers</span><kbd>4</kbd></button><button type=\"button\" data-command=\"panel:export\"><span>Open Export</span><kbd>5</kbd></button><button type=\"button\" data-command=\"theme\"><span>Toggle day/night mode</span></button><button type=\"button\" data-command=\"fullscreen\"><span>Toggle preview fullscreen</span></button></div></section></div>\n<audio id=\"kefeAudio\" preload=\"metadata\"></audio>");

document.body.insertAdjacentHTML('beforeend',KEFE_STRUCTURE);

// Keep native panel buttons directly visible and styled. Dynamic renderer controls
// are decorated as they enter the panel tree; interaction and state stay on the
// original button instead of being copied into a second control.
const panelActionExclusions = [
  '[role="dialog"]', '.kefe-command-overlay', '#beui-settings-root',
  '.beui-button-host', '.kefe-section-info', '.beui-command-button-host',
  '.kefe-vis-tabs', '.kefe-visualiser-power-slot', '.beui-vis-tabs-host',
  '.beui-range-host', '.beui-settings-root',
  '.expand-button', '.info-button', '.toggle-switch', '.kefe-dd',
].join(',');
function decoratePanelAction(button) {
  if (!(button instanceof HTMLButtonElement) || !button.closest('.kefe-panel')) return;
  if (button.classList.contains('kefe-background-effect-card')
      || button.classList.contains('kefe-car-card')
      || button.classList.contains('kefe-lyric-effect-option')
      || button.classList.contains('kefe-lyric-effect-carousel-nav')
      || button.closest(panelActionExclusions)) return;
  button.type = 'button';
  button.classList.add('kefe-panel-action');
}
function scanPanelActions(root = document) {
  if (root instanceof HTMLButtonElement) decoratePanelAction(root);
  root.querySelectorAll?.('.kefe-panel button').forEach(decoratePanelAction);
}
scanPanelActions();
const panelActionObserver = new MutationObserver(records => {
  for (const record of records) {
    record.addedNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) scanPanelActions(node);
    });
  }
});
const panelTree = document.querySelector('.kefe-panels');
if (panelTree) panelActionObserver.observe(panelTree, { childList: true, subtree: true });

const kefePercentLoader = document.querySelector('.kefe-percent-loader');
if (kefePercentLoader) {
  const value = kefePercentLoader.querySelector('.kefe-percent-value');
  const fill = kefePercentLoader.querySelector('.kefe-percent-fill');
  let progress = 0;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let timer = 0;
  const tick = () => {
    if (!kefePercentLoader.isConnected || kefePercentLoader.closest('[hidden]')) { stop(); return; }
    progress = progress >= 100 ? 0 : progress + 1;
    if (value) value.textContent = progress + '%';
    if (fill) fill.style.width = progress + '%';
  };
  const start = () => { if (!timer) timer = window.setInterval(tick, reducedMotion ? 20 : 10); };
  function stop() { if (timer) { window.clearInterval(timer); timer = 0; } }
  const observer = new MutationObserver(() => {
    if (!kefePercentLoader.isConnected || kefePercentLoader.closest('[hidden]')) stop();
    else start();
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  start();
}

const kefeAudioElement = document.getElementById('kefeAudio');
const kefeVolumeSlider = document.getElementById('kefeVolume');
const kefeVolumeValue = document.getElementById('kefeVolumeValue');
const kefeMuteToggle = document.getElementById('kefeMuteToggle');
function syncKefeVolume() {
  if (!kefeAudioElement || !kefeVolumeSlider) return;
  const value = Math.max(0, Math.min(100, Number(kefeVolumeSlider.value) || 0));
  kefeAudioElement.volume = value / 100;
  if (kefeVolumeValue) kefeVolumeValue.textContent = value + '%';
  if (kefeMuteToggle) {
    const muted = kefeAudioElement.muted || value === 0;
    kefeMuteToggle.innerHTML = muted
      ? '<span data-kefe-icon="mute" aria-hidden="true"></span>'
      : '<span data-kefe-icon="volume" aria-hidden="true"></span>';
    kefeMuteToggle.setAttribute('aria-label', muted ? 'Unmute audio' : 'Mute audio');
    kefeMuteToggle.title = muted ? 'Unmute audio' : 'Mute audio';
    kefeMuteToggle.setAttribute('aria-pressed', String(muted));
  }
}
kefeVolumeSlider?.addEventListener('input', () => { if (kefeAudioElement) kefeAudioElement.muted = false; syncKefeVolume(); });
kefeMuteToggle?.addEventListener('click', () => {
  if (!kefeAudioElement) return;
  kefeAudioElement.muted = !kefeAudioElement.muted;
  if (kefeAudioElement.muted && kefeVolumeSlider && Number(kefeVolumeSlider.value) > 0) {
    kefeAudioElement.dataset.kefePreviousVolume = kefeVolumeSlider.value;
  } else if (!kefeAudioElement.muted && kefeVolumeSlider && Number(kefeVolumeSlider.value) === 0) {
    kefeVolumeSlider.value = kefeAudioElement.dataset.kefePreviousVolume || '80';
    kefeAudioElement.volume = Number(kefeVolumeSlider.value) / 100;
  }
  syncKefeVolume();
});



const accentKey = 'kefe.accent';
function setAccentColor(color) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return;
  document.documentElement.style.setProperty('--shell-accent', color);
  document.documentElement.style.setProperty('--accent', color);
  document.querySelectorAll('[data-accent]').forEach(button => {
    const active = button.dataset.accent.toLowerCase() === color.toLowerCase();
    button.setAttribute('aria-pressed', String(active));
  });
  try { localStorage.setItem(accentKey, color); } catch (_) {}
}
document.querySelectorAll('[data-accent]').forEach(button => button.addEventListener('click', () => setAccentColor(button.dataset.accent)));
// Default brand red (white-on-accent text passes WCAG AA). The old default, #ef4444, was auto-saved for everyone, so it counts as "unset".
const defaultAccent = '#d92f33';
try { const savedAccent = localStorage.getItem(accentKey); setAccentColor(savedAccent && savedAccent.toLowerCase() !== '#ef4444' ? savedAccent : defaultAccent); } catch (_) { setAccentColor(defaultAccent); }

const commandOverlay = document.getElementById('kefeCommandPalette');
const commandInput = document.getElementById('kefeCommandInput');
const commandList = document.getElementById('kefeCommandList');
let commandPreviousFocus = null;
function closeCommandPalette() {
  if (!commandOverlay || commandOverlay.hidden) return;
  commandOverlay.hidden = true;
  if (commandPreviousFocus && typeof commandPreviousFocus.focus === 'function') commandPreviousFocus.focus();
}
function openCommandPalette() {
  if (!commandOverlay) return;
  commandPreviousFocus = document.activeElement;
  commandOverlay.hidden = false;
  if (commandInput) { commandInput.value = ''; filterCommands(''); commandInput.focus(); }
}
function filterCommands(query) {
  const q = String(query || '').trim().toLowerCase();
  commandList?.querySelectorAll('[data-command]').forEach(button => {
    button.hidden = !button.textContent.toLowerCase().includes(q);
  });
}
document.querySelectorAll('[data-command-open]').forEach(button => button.addEventListener('click', openCommandPalette));
commandInput?.addEventListener('input', () => filterCommands(commandInput.value));
commandOverlay?.addEventListener('click', event => { if (event.target === commandOverlay) closeCommandPalette(); });
commandList?.addEventListener('click', event => {
  const button = event.target.closest('[data-command]');
  if (!button) return;
  const command = button.dataset.command;
  if (command.startsWith('panel:')) {
    const panel = command.slice(6);
    document.querySelector('.kefe-section[data-panel="' + panel + '"]')?.click();
    document.querySelector('.kefe-editing')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else if (command === 'theme') {
    document.getElementById('kefeThemeToggle')?.click();
  } else if (command === 'fullscreen') {
    document.getElementById('previewFullscreen')?.click();
  }
  closeCommandPalette();
});
document.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    if (commandOverlay?.hidden) openCommandPalette(); else closeCommandPalette();
  }
  if (event.key === 'Escape') closeCommandPalette();
});
document.querySelectorAll('[data-dock-panel]').forEach(button => button.addEventListener('click', () => {
  document.querySelector('.kefe-section[data-panel="' + button.dataset.dockPanel + '"]')?.click();
  document.querySelector('.kefe-editing')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}));
document.querySelector('[data-dock-export]')?.addEventListener('click', () => {
  document.querySelector('.kefe-section[data-panel="export"]')?.click();
  document.querySelector('.kefe-editing')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

document.querySelectorAll('.kefe-section[data-panel]').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-dock-panel]').forEach(dock => dock.setAttribute('aria-pressed', String(dock.dataset.dockPanel === button.dataset.panel)));
  });
});
/* The header only exposes the Editor tab. Selecting it opens the editor's side
   panel sections: the mobile drawer below 1024px, and the section panels in the
   desktop columns. Media is the default landing section. */
const EDITOR_SECTION_IDS = {
  media: 'media',
  lyrics: 'lyric-sync',
  effects: 'lyric-effects',
  'background-effects': 'background',
  visualiser: 'visualisers',
  export: 'export'
};
function openEditorSections() {
  const panelKey = document.querySelector('.kefe-section.active')?.dataset.panel || 'media';
  const editorTab = document.querySelector('[data-editor-tab]');
  if (editorTab) {
    editorTab.classList.add('is-current');
    editorTab.setAttribute('aria-current', 'page');
  }
  const sectionButton = document.querySelector('.kefe-section[data-panel="' + panelKey + '"]');
  if (sectionButton) sectionButton.click();
  const editing = document.querySelector('.kefe-editing');
  editing?.setAttribute('data-active-panel', panelKey);
  editing?.setAttribute('data-selected-section', panelKey);
  const sectionId = EDITOR_SECTION_IDS[panelKey] || panelKey;
  const section = document.querySelector('#kefe-settings-panel .section[data-section-id="' + sectionId + '"]');
  if (section) {
    section.dataset.expanded = 'true';
    section.querySelector('.expand-button')?.setAttribute('aria-expanded', 'true');
  }
  const mobileSidebar = document.documentElement.classList.contains('kefe-ms-enabled');
  const stacked = !window.matchMedia('(min-width: 1280px)').matches;
  if (!mobileSidebar && stacked) {
    const target = document.querySelector('.kefe-settings-mount') || editing;
    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
document.querySelectorAll('[data-editor-tab]').forEach(tab => {
  tab.addEventListener('click', event => {
    // Keep the Editor entry on the current page; it opens the editor's sections.
    event.preventDefault();
    openEditorSections();
  });
});
const editorTab = document.querySelector('[data-editor-tab]');
if (editorTab) {
  editorTab.classList.add('is-current');
  editorTab.setAttribute('aria-current', 'page');
}
document.querySelectorAll('[data-dock-panel]').forEach(dock => dock.setAttribute('aria-pressed', String(dock.dataset.dockPanel === (document.querySelector('.kefe-section.active')?.dataset.panel || 'media'))));
const initialSection = new URLSearchParams(window.location.search).get('section');
if (['media', 'lyrics', 'effects', 'background-effects', 'visualiser', 'export'].includes(initialSection)) {
  document.addEventListener('DOMContentLoaded', () => {
    const target = document.querySelector('.kefe-section[data-panel="' + initialSection + '"]');
    if (target) target.click();
  }, { once: true });
}

