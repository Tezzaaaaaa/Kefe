'use strict';

const KEFE_STRUCTURE=("\n<div class=\"kefe-editor\">\n<aside class=\"kefe-sidebar\" aria-label=\"KEFE workspace navigation\">\n  <div class=\"kefe-sidebar-brand-row\"><button class=\"kefe-sidebar-toggle\" type=\"button\" data-sidebar-toggle aria-label=\"Collapse sidebar\" title=\"Collapse sidebar\"><span aria-hidden=\"true\">◧</span></button><a class=\"kefe-sidebar-brand\" href=\"./workspace.html\" aria-label=\"KEFE workspace home\"><img src=\"./app/brand/favicon.svg\" alt=\"\"><span>KEFE</span></a></div>\n  <div class=\"kefe-sidebar-group\"><span class=\"kefe-sidebar-label\">Workspace</span><a class=\"kefe-sidebar-link\" href=\"./workspace.html\"><span aria-hidden=\"true\">⌂</span>Home</a><a class=\"kefe-sidebar-link\" href=\"./editor.html\"><span aria-hidden=\"true\">✳</span>Editor</a><button class=\"kefe-sidebar-link\" type=\"button\" data-shell-panel=\"media\"><span aria-hidden=\"true\">▤</span>Media</button></div>\n  <div class=\"kefe-sidebar-theme\"><span class=\"kefe-sidebar-label\">Accent colour</span><div class=\"kefe-theme-swatches\" role=\"group\" aria-label=\"Accent colour\"><button type=\"button\" data-accent=\"#ef4444\" aria-label=\"Matrix red\" title=\"Matrix red\" style=\"--swatch:#ef4444\"></button><button type=\"button\" data-accent=\"#06b6d4\" aria-label=\"Neon cyan\" title=\"Neon cyan\" style=\"--swatch:#06b6d4\"></button><button type=\"button\" data-accent=\"#8b5cf6\" aria-label=\"Electric violet\" title=\"Electric violet\" style=\"--swatch:#8b5cf6\"></button><button type=\"button\" data-accent=\"#10b981\" aria-label=\"Emerald green\" title=\"Emerald green\" style=\"--swatch:#10b981\"></button></div></div>\n  <div class=\"kefe-sidebar-group\"><span class=\"kefe-sidebar-label\">Create</span><button class=\"kefe-sidebar-link\" type=\"button\" data-shell-panel=\"lyrics\"><span aria-hidden=\"true\">≋</span>Lyrics</button><button class=\"kefe-sidebar-link\" type=\"button\" data-shell-panel=\"effects\"><span aria-hidden=\"true\">✧</span>Effects & type</button><button class=\"kefe-sidebar-link\" type=\"button\" data-shell-panel=\"visualiser\"><span aria-hidden=\"true\">◌</span>Visualisers</button><button class=\"kefe-sidebar-link\" type=\"button\" data-shell-panel=\"export\"><span aria-hidden=\"true\">⇧</span>Export</button></div>\n  <div class=\"kefe-sidebar-bottom\"><button class=\"kefe-sidebar-link\" type=\"button\" data-top-panel=\"settings\"><span aria-hidden=\"true\">⚙</span>Settings</button><a class=\"kefe-sidebar-link kefe-sidebar-github\" href=\"https://github.com/Tezzaaaaaa/Kefe\" target=\"_blank\" rel=\"noopener noreferrer\"><span aria-hidden=\"true\">↗</span>GitHub repository</a></div>\n</aside>\n<header class=\"kefe-top\">\n  <nav class=\"kefe-top-nav\" aria-label=\"Primary\">\n    <button class=\"kefe-brand\" type=\"button\" aria-label=\"Refresh KEFE\" title=\"Refresh KEFE\"><img src=\"./app/brand/favicon.svg?v=5\" alt=\"\"></button>\n    <a class=\"kefe-top-link\" href=\"./workspace.html\">Workspace</a>\n    \n    <button class=\"kefe-top-link\" type=\"button\" data-top-panel=\"editor\">Editor</button>\n  </nav>\n  <nav class=\"kefe-top-profile\" aria-label=\"Account\">\n    <button class=\"kefe-top-link kefe-command-trigger\" type=\"button\" data-command-open aria-label=\"Open command palette\" title=\"Search commands (⌘K)\">⌕ <span>Search</span><kbd>⌘K</kbd></button>\n    <a class=\"kefe-top-link kefe-github-link\" href=\"https://github.com/Tezzaaaaaa/Kefe\" target=\"_blank\" rel=\"noopener noreferrer\" aria-label=\"Open KEFE GitHub repository\" title=\"Open KEFE GitHub repository\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 2.6a9.4 9.4 0 0 0-2.97 18.32c.47.09.64-.2.64-.45v-1.7c-2.62.57-3.17-1.1-3.17-1.1-.43-1.08-1.04-1.37-1.04-1.37-.85-.58.07-.57.07-.57.94.07 1.44.97 1.44.97.84 1.44 2.2 1.03 2.74.79.09-.61.33-1.03.6-1.27-2.09-.24-4.29-1.05-4.29-4.67 0-1.03.37-1.87.97-2.53-.1-.24-.42-1.2.09-2.5 0 0 .79-.25 2.59.96a8.9 8.9 0 0 1 4.71 0c1.8-1.21 2.59-.96 2.59-.96.51 1.3.19 2.26.09 2.5.6.66.97 1.5.97 2.53 0 3.63-2.21 4.42-4.31 4.66.34.3.64.88.64 1.78v2.64c0 .25.17.54.65.45A9.4 9.4 0 0 0 12 2.6Z\" fill=\"currentColor\"/></svg></a>\n    <button class=\"kefe-top-link kefe-theme-toggle\" type=\"button\" id=\"kefeThemeToggle\" aria-label=\"Switch to day mode\" title=\"Switch to day mode\">☀ Day</button>\n    <button class=\"kefe-top-link\" type=\"button\" data-top-panel=\"settings\">Settings</button>\n  </nav>\n</header>\n\n<main class=\"kefe-work\">\n  <section class=\"kefe-preview\">\n    <div class=\"kefe-stage is-16x9\">\n      <button class=\"kefe-preview-fullscreen\" id=\"previewFullscreen\" type=\"button\" aria-label=\"Enter fullscreen\" title=\"Enter fullscreen\">\n        <svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M8 3H3v5M16 3h5v5M8 21H3v-5M21 16v5h-5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>\n      </button>\n            <canvas id=\"kefeCanvas\" width=\"1280\" height=\"720\"></canvas>\n    </div>\n  </section>\n\n  <section class=\"kefe-timeline\" aria-label=\"Timeline\">\n    <div class=\"kefe-transport\">\n      <button class=\"kefe-play\" id=\"playButton\" type=\"button\" aria-label=\"Play\" title=\"Play\"><svg class=\"kefe-play-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M8 5.5v13l10-6.5z\" fill=\"currentColor\"/></svg></button>\n    </div>\n    <div class=\"kefe-time\"><span id=\"timeNow\">0:00</span> / <span id=\"timeEnd\">0:30</span></div>\n    <div class=\"kefe-wave\" id=\"waveform\">\n      <input id=\"kefeTime\" class=\"kefe-slider\" type=\"range\" min=\"0\" max=\"30\" step=\".01\" value=\"0\" aria-label=\"Timeline\">\n      <div class=\"playhead\" id=\"playhead\"></div>\n    </div>\n    <label class=\"kefe-aspect-controls\">\n      <span class=\"kefe-aspect-label\">Aspect</span>\n      <select id=\"kefeAspect\" class=\"kefe-aspect-select\" aria-label=\"Preview aspect ratio\">\n        <option value=\"16:9\">16:9</option>\n        <option value=\"9:16\">9:16</option>\n        <option value=\"1:1\">1:1</option>\n      </select>\n    </label>\n    <div class=\"kefe-volume-control\" aria-label=\"Audio volume\"><button id=\"kefeMuteToggle\" type=\"button\" aria-label=\"Mute audio\" title=\"Mute audio\">◖</button><input class=\"beui-slider\" id=\"kefeVolume\" type=\"range\" min=\"0\" max=\"100\" step=\"1\" value=\"100\" aria-label=\"Audio volume\"><output id=\"kefeVolumeValue\" for=\"kefeVolume\">100%</output></div>\n  </section>\n\n  <section class=\"kefe-editing\">\n    <nav class=\"kefe-tabs\" aria-label=\"Editor sections\">\n      <button class=\"kefe-section active\" data-panel=\"media\">Media</button>\n      <button class=\"kefe-section\" data-panel=\"lyrics\">Lyrics</button>\n      <button class=\"kefe-section\" data-panel=\"effects\">Effects</button>\n      <button class=\"kefe-section\" data-panel=\"background-effects\">Background Effects</button>\n      <button class=\"kefe-section\" data-panel=\"visualiser\">Visualiser</button>\n      <button class=\"kefe-section\" data-panel=\"export\">Export</button>\n    </nav>\n\n    <div class=\"kefe-panels\">\n      <section class=\"kefe-panel active\" data-panel-view=\"media\">\n        <div class=\"kefe-panel-head\"><h2>Media</h2><span class=\"kefe-meta\">Upload audio or video, find your track, and confirm its details.</span></div>\n        <div class=\"kefe-form\">\n          <label class=\"kefe-upload-zone\" id=\"kefeUploadZone\" for=\"mediaInput\">\n            <span class=\"kefe-upload-title\">Drop audio or video</span>\n            <span class=\"kefe-upload-name\">or choose a file</span>\n            <span class=\"kefe-upload-help\">MP3, M4A, WAV, MP4, MOV and more</span>\n            <input class=\"kefe-file\" id=\"mediaInput\" type=\"file\" accept=\".mp3,.m4a,.wav,.aac,.flac,.ogg,.oga,.opus,.aiff,.caf,.mp4,.mov,.m4v,.webm,.avi,audio/*,video/*\">\n          </label>\n          <div class=\"kefe-media-track\" id=\"kefeMediaTrack\" hidden>\n            <div class=\"kefe-media-track-art\" id=\"kefeMediaTrackArt\"><div class=\"kefe-media-track-fallback\" id=\"kefeMediaTrackFallback\">K</div></div>\n            <div class=\"kefe-media-track-info\">\n              <p class=\"kefe-media-track-kicker\">Identified track</p>\n              <h3 id=\"kefeMediaTrackTitle\">Untitled</h3>\n              <p id=\"kefeMediaTrackArtist\">Unknown artist</p>\n              <div class=\"kefe-media-track-meta\"><span id=\"kefeMediaTrackAlbum\"></span><span id=\"kefeMediaTrackYear\"></span></div>\n            </div>\n          </div>\n          <div class=\"kefe-suggestions\" id=\"kefeSuggestions\" hidden>\n            <div class=\"kefe-suggestions-head\"><span class=\"kefe-suggestions-title\">Suggestions</span><span class=\"kefe-suggestions-status\" id=\"kefeSuggestionsStatus\">Finding matches<span class=\"kefe-suggestions-dots\" aria-hidden=\"true\"><i></i><i></i><i></i></span></span></div>\n            <div class=\"kefe-suggestion-list\" id=\"kefeSuggestionList\"></div>\n          </div>\n          <div><label class=\"kefe-label\" for=\"songTitle\">Song title</label><input class=\"kefe-input\" id=\"songTitle\" type=\"text\" placeholder=\"Song title\"></div>\n          <div><label class=\"kefe-label\" for=\"songArtist\">Artist</label><input class=\"kefe-input\" id=\"songArtist\" type=\"text\" placeholder=\"Artist\"></div>\n          <div><label class=\"kefe-label\" for=\"songAlbum\">Album</label><input class=\"kefe-input\" id=\"songAlbum\" type=\"text\" placeholder=\"Album\"></div>\n          <div><label class=\"kefe-label\" for=\"songYear\">Year</label><input class=\"kefe-input\" id=\"songYear\" type=\"text\" placeholder=\"Year\"></div>\n          \n        </div>\n      </section>\n\n      <section class=\"kefe-panel\" data-panel-view=\"lyrics\">\n        <div class=\"kefe-panel-head\"><h2>Lyrics</h2><span class=\"kefe-meta\" id=\"kefeLyricsStatus\">Upload audio to fetch synchronized lyrics.</span></div>\n        <div class=\"kefe-form\">\n          <div>\n            <label class=\"kefe-label\" for=\"lyricsInput\">Fetched lyrics</label>\n            <textarea class=\"kefe-textarea\" id=\"lyricsInput\" spellcheck=\"false\" placeholder=\"Synchronized lyrics will appear here after an audio track is identified.\"></textarea>\n          </div>\n          <div class=\"kefe-lyrics-timing\" aria-labelledby=\"lyricsTimingLabel\">\n            <div class=\"kefe-lyrics-timing-head\">\n              <div>\n                <div class=\"kefe-label\" id=\"lyricsTimingLabel\">Lyrics timing</div>\n                <div class=\"kefe-meta\">Move all synchronized lyrics earlier or later without changing their individual timings.</div>\n              </div>\n              <output class=\"kefe-lyrics-timing-value\" id=\"lyricsTimingValue\" for=\"lyricsTiming\">0.00s</output>\n            </div>\n            <div class=\"kefe-lyrics-timing-controls\">\n              <button class=\"kefe-btn kefe-lyrics-timing-step\" id=\"lyricsTimingEarlier\" type=\"button\" aria-label=\"Move lyrics 0.10 seconds earlier\">−0.10s</button>\n              <input id=\"lyricsTiming\" class=\"kefe-slider kefe-lyrics-timing-slider\" type=\"range\" min=\"-3\" max=\"3\" step=\"0.05\" value=\"0\" aria-label=\"Lyrics timing offset\">\n              <button class=\"kefe-btn kefe-lyrics-timing-step\" id=\"lyricsTimingLater\" type=\"button\" aria-label=\"Move lyrics 0.10 seconds later\">+0.10s</button>\n            </div>\n            <div class=\"kefe-lyrics-timing-foot\">\n              <span>−3s</span>\n              <button class=\"kefe-btn kefe-lyrics-timing-reset\" id=\"lyricsTimingReset\" type=\"button\">Reset</button>\n              <span>+3s</span>\n            </div>\n          </div>\n        </div>\n      </section>\n\n      <section class=\"kefe-panel\" data-panel-view=\"background-effects\">\n        <div class=\"kefe-panel-head\"><h2>Background Effects</h2><span class=\"kefe-meta\">Choose the canvas background and optional background video.</span></div>\n        <div class=\"kefe-form\"></div>\n      </section>\n\n      <section class=\"kefe-panel\" data-panel-view=\"effects\">\n        <div class=\"kefe-panel-head\"><h2>Effects</h2><span class=\"kefe-meta\">Choose the lyric treatment, font and typography.</span></div>\n        <div class=\"kefe-form\">\n          <div class=\"kefe-background-effect-control kefe-lyric-effects-control\">\n            <label class=\"kefe-label\">Lyric effects</label>\n            <div class=\"kefe-lyric-effect-grid\" id=\"lyricEffectOptions\" role=\"group\" aria-label=\"Lyric effect options\"></div>\n          </div>\n          <div class=\"kefe-background-effect-control\">\n            <label class=\"kefe-label\" for=\"visualiserBackground\">Background effect</label>\n            <select class=\"kefe-select\" id=\"visualiserBackground\">\n              <option value=\"apple\">Apple Motion Art</option>\n              <option value=\"video\" disabled>Uploaded video</option>\n            </select>\n            <p class=\"kefe-meta\">Choose the backdrop shown behind your lyrics and visualiser.</p>\n          </div>\n          <div class=\"kefe-background-effect-control\">\n            <label class=\"kefe-label\" for=\"backgroundTransparency\">Background transparency <output id=\"backgroundTransparencyValue\" for=\"backgroundTransparency\">0%</output></label>\n            <input class=\"kefe-background-transparency\" id=\"backgroundTransparency\" type=\"range\" min=\"0\" max=\"100\" step=\"1\" value=\"0\" aria-label=\"Background transparency; increase to darken the background behind lyrics\">\n            <p class=\"kefe-meta\">Increase to darken the background and make lyrics easier to read.</p>\n          </div>\n          <div>\n            <label class=\"kefe-label\" for=\"fontOverride\">Font</label>\n            <select class=\"kefe-select\" id=\"fontOverride\"><option value=\"\">Use effect font</option></select>\n          </div>\n          <div class=\"kefe-font-card\"><div class=\"kefe-font-name\" id=\"fontName\">SF Pro Display</div><div class=\"kefe-meta\" id=\"fontMeta\">Locked effect font</div></div>\n        </div>\n      </section>\n\n      <section class=\"kefe-panel\" data-panel-view=\"visualiser\">\n        <div class=\"kefe-panel-head kefe-visualiser-panel-head\"><h2 id=\"kefeVisualiserHeading\">Liquid Flow Visualiser</h2><span class=\"kefe-meta\" id=\"kefeVisualiserDescription\">Audio-reactive liquid glass with flowing gradients, refractive highlights and customizable presets.</span></div>\n        <div class=\"kefe-form kefe-visualiser-form\"></div>\n      </section>\n\n      <section class=\"kefe-panel\" data-panel-view=\"export\">\n        <div class=\"kefe-panel-head\"><h2>Export</h2><span class=\"kefe-meta\">Export the current visualiser composition.</span></div>\n        <div class=\"kefe-form\">\n          <select class=\"kefe-select\" id=\"exportFormat\" aria-label=\"Export format\"><option value=\"webm\">WebM video</option><option value=\"mp4\">MP4 (H.264/AAC where supported)</option></select>\n          <select class=\"kefe-select\" id=\"exportResolution\" aria-label=\"Export resolution\"><option value=\"720\">720p</option><option value=\"1080\" selected>1080p</option><option value=\"1440\">1440p (2K)</option><option value=\"2160\">2160p (4K)</option></select>\n          <button class=\"kefe-btn primary\" id=\"exportButton\" type=\"button\">Export video</button>\n          <div class=\"kefe-empty-panel\" id=\"exportStatus\">Exports the current preview canvas with its lyric and visualiser layers.</div>\n        </div>\n      </section>\n    </div>\n  </section>\n</main>\n\n<footer class=\"kefe-site-footer\">\n  <div class=\"kefe-site-footer-brand\"><img src=\"./app/brand/favicon.svg\" alt=\"\" aria-hidden=\"true\"><div><strong>KEFE Visualiser</strong><span>Browser-based music visualiser and lyric-video editor</span></div></div>\n  <div class=\"kefe-site-footer-meta\"><span>Public · main</span><a href=\"https://tezzaaaaaa.github.io/Kefe/\" target=\"_blank\" rel=\"noopener noreferrer\">Live site</a><a href=\"https://github.com/Tezzaaaaaa/Kefe\" target=\"_blank\" rel=\"noopener noreferrer\">GitHub</a></div>\n</footer>\n</div>\n<nav class=\"kefe-workspace-dock\" aria-label=\"Workspace shortcuts\"><button type=\"button\" data-dock-panel=\"media\" aria-label=\"Media\" title=\"Media\"><span aria-hidden=\"true\">▤</span></button><button type=\"button\" data-dock-panel=\"lyrics\" aria-label=\"Lyrics\" title=\"Lyrics\"><span aria-hidden=\"true\">≋</span></button><button type=\"button\" data-dock-panel=\"effects\" aria-label=\"Effects\" title=\"Effects\"><span aria-hidden=\"true\">✧</span></button><button type=\"button\" data-dock-panel=\"visualiser\" aria-label=\"Visualiser\" title=\"Visualiser\"><span aria-hidden=\"true\">◌</span></button><span aria-hidden=\"true\" class=\"kefe-dock-separator\"></span><button type=\"button\" data-dock-export aria-label=\"Export video\" title=\"Export video\"><span aria-hidden=\"true\">⇧</span></button><button type=\"button\" data-command-open aria-label=\"Settings and commands\" title=\"Settings and commands\"><span aria-hidden=\"true\">⌘</span></button></nav>\n<div class=\"kefe-command-overlay\" id=\"kefeCommandPalette\" hidden><section class=\"kefe-command-dialog\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"kefeCommandTitle\"><div class=\"kefe-command-search\"><span aria-hidden=\"true\">⌕</span><label class=\"kefe-sr-only\" id=\"kefeCommandTitle\" for=\"kefeCommandInput\">Search workspace commands</label><input id=\"kefeCommandInput\" type=\"search\" autocomplete=\"off\" placeholder=\"Search workspace commands…\"><kbd>ESC</kbd></div><div class=\"kefe-command-list\" id=\"kefeCommandList\"><button type=\"button\" data-command=\"panel:media\"><span>Open Media</span><kbd>1</kbd></button><button type=\"button\" data-command=\"panel:lyrics\"><span>Open Lyrics</span><kbd>2</kbd></button><button type=\"button\" data-command=\"panel:effects\"><span>Open Effects</span><kbd>3</kbd></button><button type=\"button\" data-command=\"panel:visualiser\"><span>Open Visualiser</span><kbd>4</kbd></button><button type=\"button\" data-command=\"panel:export\"><span>Open Export</span><kbd>5</kbd></button><button type=\"button\" data-command=\"sidebar\"><span>Toggle sidebar</span><kbd>⌘B</kbd></button><button type=\"button\" data-command=\"theme\"><span>Toggle day/night mode</span></button><button type=\"button\" data-command=\"fullscreen\"><span>Toggle preview fullscreen</span></button></div></section></div>\n<audio id=\"kefeAudio\" preload=\"metadata\"></audio>");
document.body.insertAdjacentHTML('beforeend',KEFE_STRUCTURE);

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
    kefeMuteToggle.textContent = muted ? '◖̸' : '◖';
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


document.querySelector('.kefe-brand')?.addEventListener('click', () => window.location.reload());

const shellRoot = document.querySelector('.kefe-editor');
const shellSidebar = document.querySelector('.kefe-sidebar');
function setSidebarCollapsed(collapsed, persist = true) {
  if (!shellRoot || !shellSidebar) return;
  shellRoot.classList.toggle('sidebar-collapsed', collapsed);
  document.querySelectorAll('[data-sidebar-toggle]').forEach(button => {
    button.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
    button.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
    button.setAttribute('aria-expanded', String(!collapsed));
  });
  if (persist) { try { localStorage.setItem('kefe.sidebarCollapsed', collapsed ? '1' : '0'); } catch (_) {} }
}
document.querySelectorAll('[data-sidebar-toggle]').forEach(button => {
  button.addEventListener('click', () => setSidebarCollapsed(!shellRoot?.classList.contains('sidebar-collapsed')));
});
const mobileNavQuery = window.matchMedia ? window.matchMedia('(max-width: 640px)') : null;
function restoreSidebarState() {
  if (mobileNavQuery && mobileNavQuery.matches) { setSidebarCollapsed(false, false); return; }
  let stored = false;
  try { stored = localStorage.getItem('kefe.sidebarCollapsed') === '1'; } catch (_) {}
  setSidebarCollapsed(stored, false);
}
restoreSidebarState();
if (mobileNavQuery && mobileNavQuery.addEventListener) mobileNavQuery.addEventListener('change', restoreSidebarState);

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
try { const savedAccent = localStorage.getItem(accentKey); if (savedAccent) setAccentColor(savedAccent); else setAccentColor('#ef4444'); } catch (_) { setAccentColor('#ef4444'); }

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
  } else if (command === 'sidebar') {
    setSidebarCollapsed(!shellRoot?.classList.contains('sidebar-collapsed'));
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
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) {
    event.preventDefault();
    setSidebarCollapsed(!shellRoot?.classList.contains('sidebar-collapsed'));
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


function syncShellSection(panel) {
  document.querySelectorAll('[data-shell-panel]').forEach(button => {
    const active = button.dataset.shellPanel === panel;
    button.classList.toggle('is-current', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
}
document.querySelectorAll('[data-shell-panel]').forEach(button => {
  button.addEventListener('click', () => {
    const target = document.querySelector('.kefe-section[data-panel="' + button.dataset.shellPanel + '"]');
    if (target) target.click();
  });
});
document.querySelectorAll('.kefe-section[data-panel]').forEach(button => {
  button.addEventListener('click', () => {
    syncShellSection(button.dataset.panel);
    document.querySelectorAll('[data-dock-panel]').forEach(dock => dock.setAttribute('aria-pressed', String(dock.dataset.dockPanel === button.dataset.panel)));
  });
});
document.querySelectorAll('[data-top-panel="editor"]').forEach(button => {
  button.addEventListener('click', () => {
    const mediaTab = document.querySelector('.kefe-section[data-panel="media"]');
    if (mediaTab) mediaTab.click();
    document.querySelector('.kefe-editing')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});
const editorSectionLink = document.querySelector('.kefe-sidebar-link[href="./editor.html"]');
if (editorSectionLink && /\/editor\.html$/.test(window.location.pathname)) {
  editorSectionLink.addEventListener('click', event => {
    event.preventDefault();
    const mediaTab = document.querySelector('.kefe-section[data-panel="media"]');
    if (mediaTab) mediaTab.click();
    document.querySelector('.kefe-editing')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}
syncShellSection(document.querySelector('.kefe-section.active')?.dataset.panel || 'media');
document.querySelectorAll('[data-dock-panel]').forEach(dock => dock.setAttribute('aria-pressed', String(dock.dataset.dockPanel === (document.querySelector('.kefe-section.active')?.dataset.panel || 'media'))));
const initialSection = new URLSearchParams(window.location.search).get('section');
if (['media', 'lyrics', 'effects', 'visualiser', 'export'].includes(initialSection)) {
  document.addEventListener('DOMContentLoaded', () => {
    const target = document.querySelector('.kefe-section[data-panel="' + initialSection + '"]');
    if (target) target.click();
  }, { once: true });
}

