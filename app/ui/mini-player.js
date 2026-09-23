/* KEFE Now Playing — compact disc-and-card player skin with Butterchurn visuals. */
(() => {
  'use strict';
  if (window.kefeMiniPlayer) return;

  const player = document.createElement('div');
  player.id = 'kefeMiniPlayerModal';
  player.className = 'kefe-mini-modal is-hidden';
  player.setAttribute('role', 'dialog');
  player.setAttribute('aria-modal', 'true');
  player.setAttribute('aria-label', 'KEFE Now Playing');
  player.innerHTML = `
    <div class="kefe-mini-shell">
      <div class="kefe-mini-topline"><span>KEFE / NOW PLAYING</span><div class="kefe-mini-topline-actions"><button type="button" id="kefeMiniSkinToggle" class="kefe-mini-icon-button" aria-label="Switch to Skin 2" title="Skin 2"><span aria-hidden="true">S2</span></button><button type="button" id="kefeMiniFullscreen" class="kefe-mini-icon-button" aria-label="Enter fullscreen" title="Fullscreen"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4H4v4M16 4h4v4M8 20H4v-4M20 16v4h-4"/></svg></button><button type="button" id="kefeMiniClose" class="kefe-mini-close" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div></div>
      <div id="kefeMiniCard" class="kefe-mini-card" role="button" tabindex="0" aria-pressed="false" aria-label="Show cover art" title="Tap to show cover art">
        <div class="kefe-mini-body">
          <div class="kefe-mini-art">
            <div class="kefe-mini-spin">
              <canvas id="kefeMiniCanvas" width="720" height="720"></canvas>
              <div class="kefe-mini-hub"></div>
            </div>
            <div class="kefe-mini-art-caption" aria-hidden="true"><strong id="kefeMiniCapArtist"></strong><span id="kefeMiniCapTitle"></span></div>
          </div>
          <div class="kefe-mini-info">
            <div class="kefe-mini-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
            <div id="kefeMiniArtist" class="kefe-mini-artist">Add music to begin</div>
            <div id="kefeMiniTitle" class="kefe-mini-title">Nothing queued</div>
            <div class="kefe-mini-bar" aria-hidden="true"><span id="kefeMiniProgress"></span></div>
          </div>
          <div id="kefeMiniControlPanel" class="kefe-mini-control-panel">
        <button type="button" id="kefeMiniUpload" class="kefe-mini-add"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V5M8 9l4-4 4 4M5 19h14"/></svg><span>Upload media</span></button><input id="kefeMiniFiles" type="file" accept="audio/*,.aac,.aif,.aiff,.alac,.amr,.ape,.au,.caf,.flac,.m4a,.m4b,.m4r,.mka,.mp2,.mp3,.mpga,.oga,.ogg,.opus,.ra,.wav,.weba,.wma,.wv,.3ga,.ac3,.eac3,.mid,.midi,.mp4,.m4v,.mov,.webm,.3gp,.mkv,.ogv" multiple hidden>
        <div class="kefe-mini-controls" aria-label="Playback controls">
          <button type="button" id="kefeMiniShuffleTrack" class="kefe-mini-control-icon" aria-label="Shuffle queue" title="Shuffle queue"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h2c4 0 6 10 10 10h4M16 5h4v4M20 5l-4 4M4 17h2c1.8 0 3-1.5 4-3M16 15h4v4M20 19l-4-4"/></svg></button>
          <button type="button" id="kefeMiniPrev" class="kefe-mini-control-icon" aria-label="Previous track" title="Previous track"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 6v12M18 6l-8 6 8 6z"/></svg></button>
          <button type="button" id="kefeMiniPlay" class="kefe-mini-play" aria-label="Play" title="Play"><svg class="icon-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z"/></svg></button>
          <button type="button" id="kefeMiniStop" class="kefe-mini-control-icon" aria-label="Stop" title="Stop"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10v10H7z"/></svg></button>
          <button type="button" id="kefeMiniNext" class="kefe-mini-control-icon" aria-label="Next track" title="Next track"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 6v12M6 6l8 6-8 6z"/></svg></button>
          <button type="button" id="kefeMiniRepeat" class="kefe-mini-control-icon" aria-label="Repeat off" title="Repeat off"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 7H7a3 3 0 0 0 0 6h1M7 17h10a3 3 0 0 0 0-6h-1M15 5l2 2-2 2M9 15l-2 2 2 2"/></svg></button>
        </div>
        <input id="kefeMiniSeek" class="kefe-mini-seek" type="range" min="0" max="0" step="0.01" value="0" aria-label="Track position">
        <div class="kefe-mini-clock"><span id="kefeMiniCurrent" class="cur">0 : 00</span><span class="sep"> / </span><span id="kefeMiniDuration" class="dur">0:00</span></div>
        <div class="kefe-mini-actions">
          <div class="kefe-mini-volume"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 10v4h3l4 3V7L8 10H5zM16 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/></svg><input id="kefeMiniVolume" type="range" min="0" max="1" step="0.01" value="1" aria-label="Volume"></div>
          <button type="button" id="kefeMiniShuffle">Shuffle preset</button>
        </div>
        <div id="kefeMiniNotice" class="kefe-mini-notice" role="status" aria-live="polite" hidden></div>
        <div class="kefe-mini-preset"><span>Visual</span><select id="kefeMiniPreset" aria-label="Butterchurn preset"></select></div>
        <button type="button" id="kefeMiniLyricsToggle" class="kefe-mini-lyrics-toggle" aria-expanded="false" aria-controls="kefeMiniLyricsPanel"><span>Lyrics</span><svg class="lyrics-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>
        <section id="kefeMiniLyricsPanel" class="kefe-mini-lyrics-panel" hidden>
          <div class="kefe-mini-lyrics-head"><span>LYRICS</span><button type="button" id="kefeMiniLyricsClose" aria-label="Close lyrics"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
          <div id="kefeMiniLyricsContent" class="kefe-mini-lyrics-content"><p>No lyrics loaded</p></div>
        </section>
        <div class="kefe-mini-queue"><div class="kefe-mini-queue-head"><div><span>UP NEXT</span><small>Playlist</small></div><span id="kefeMiniQueueCount">0 tracks</span></div><ol id="kefeMiniQueueList"></ol></div>
        </div>
      <button type="button" id="kefeMiniVisualToggle" class="kefe-mini-visual-toggle" aria-pressed="false" aria-label="Switch to visualizer" title="Show audio visualizer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14c2.5-8 5.5-8 8 0s5.5 8 8 0M4 10c2.5 8 5.5 8 8 0s5.5-8 8 0"/></svg><span class="sr-only">Visualizer</span></button>
    </div>
    </div>`;
  document.body.appendChild(player);

  const audio = new Audio();
  audio.preload = 'auto';
  audio.playsInline = true;
  const fallbackState = {
    audio: { file: null, url: null, duration: 0, ready: false, metadata: { title: '', artist: '', album: '' } },
    lyrics: { lines: [] },
    style: { visualiserStyle: 'butterchurn', butterchurnPreset: '' }
  };
  const getState = () => window.state || fallbackState;
  const urls = new Map();
  let tracks = [];