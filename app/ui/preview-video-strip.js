/* KEFE — Video thumbnail strip above the seek slider + a manual lyric
   sync slider. Lets the user scrub visually and dial in the lyric offset
   by eye, without needing auto-detection. */
(function(){
  'use strict';
  if (window.__kefeVideoStrip) return;
  window.__kefeVideoStrip = true;

  var css = document.createElement('style');
  css.id = 'kefe-video-strip-css';
  css.textContent = [
    /* The thumbnail strip replaces the plain slider */
    '.kefe-strip-wrap{position:relative;display:flex;align-items:center;gap:10px;flex:1 1 auto;min-width:0}',
    '.kefe-strip{position:relative;flex:1 1 auto;height:44px;border:1px solid var(--line);background:#000;overflow:hidden;cursor:pointer}',
    '.kefe-strip canvas{display:block;width:100%;height:100%}',
    '.kefe-strip .kefe-strip-playhead{position:absolute;top:0;bottom:0;width:1px;background:#fff;pointer-events:none;box-shadow:0 0 6px rgba(255,255,255,.7)}',
    '.kefe-strip .kefe-strip-songstart{position:absolute;top:0;bottom:0;width:2px;background:var(--red);pointer-events:none;display:none}',
    '.kefe-strip .kefe-strip-songstart.visible{display:block}',
    '.kefe-strip .kefe-strip-songstart::after{content:"SONG START";position:absolute;top:2px;left:4px;font-size:8px;font-weight:800;letter-spacing:.1em;color:var(--red);white-space:nowrap}',
    /* Original slider stays but sits under the strip for fine scrubbing */
    '.kefe-strip-wrap .slider{position:absolute;inset:0;opacity:0;cursor:pointer;z-index:3}',

    /* Lyric sync slider panel */
    '.kefe-sync-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--line);margin-top:10px}',
    '.kefe-sync-row label{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-3);flex:0 0 auto}',
    '.kefe-sync-row input[type="range"]{flex:1 1 auto;min-width:0}',
    '.kefe-sync-row .kefe-sync-value{font-variant-numeric:tabular-nums;font-size:12px;color:var(--text-2);min-width:60px;text-align:right}',
    '.kefe-sync-row .kefe-sync-hint{font-size:10.5px;color:var(--text-3);flex:0 0 100%;margin-top:2px}',
    '.kefe-sync-actions{display:flex;gap:8px;margin-top:6px}',
    '.kefe-sync-actions button{font-size:11px;height:28px;padding:0 10px}'
  ].join('\n');
  document.head.appendChild(css);

  var stripCanvas = null;
  var playhead = null;
  var songStartMark = null;
  var strip = null;
  var thumbsDrawn = false;

  function buildStrip() {
    var slider = document.getElementById('seek');
    if (!slider || slider.dataset.kefeStripWrapped) return;
    slider.dataset.kefeStripWrapped = '1';

    var wrap = document.createElement('div');
    wrap.className = 'kefe-strip-wrap';
    slider.parentNode.insertBefore(wrap, slider);

    strip = document.createElement('div');
    strip.className = 'kefe-strip';
    stripCanvas = document.createElement('canvas');
    playhead = document.createElement('div');
    playhead.className = 'kefe-strip-playhead';
    songStartMark = document.createElement('div');
    songStartMark.className = 'kefe-strip-songstart';
    strip.appendChild(stripCanvas);
    strip.appendChild(playhead);
    strip.appendChild(songStartMark);
    wrap.appendChild(strip);
    wrap.appendChild(slider);

    // Click on strip seeks
    strip.addEventListener('click', function(e){
      var rect = strip.getBoundingClientRect();
      var pct = (e.clientX - rect.left) / rect.width;
      var dur = getDuration();
      if (dur > 0 && typeof seekPreview === 'function') {
        seekPreview(pct * dur);
      }
    });
  }

  function buildSyncRow() {
    if (document.getElementById('kefeSyncRow')) return;
    var toolbar = document.querySelector('.preview-toolbar');
    if (!toolbar) return;
    var row = document.createElement('div');
    row.id = 'kefeSyncRow';
    row.className = 'kefe-sync-row';
    row.innerHTML =
      '<label for="kefeSyncSlider">Lyric sync</label>' +
      '<input type="range" id="kefeSyncSlider" min="-30" max="30" step="0.05" value="0">' +
      '<span class="kefe-sync-value" id="kefeSyncValue">0.00s</span>' +
      '<div class="kefe-sync-actions">' +
        '<button type="button" id="kefeSyncReset">Reset</button>' +
        '<button type="button" id="kefeSyncSnap">Snap to playhead</button>' +
      '</div>' +
      '<div class="kefe-sync-hint">Drag until the lyric timing matches. Negative = lyrics earlier, positive = lyrics later.</div>';
    toolbar.parentElement.insertBefore(row, toolbar.nextSibling);

    var slider = row.querySelector('#kefeSyncSlider');
    var value = row.querySelector('#kefeSyncValue');

    function apply() {
      var v = Number(slider.value) || 0;
      window.state.lyricsOffset = v;
      value.textContent = (v > 0 ? '+' : '') + v.toFixed(2) + 's';
      try { window.redrawCurrentPreviewFrame(); } catch(e){}
    }

    slider.addEventListener('input', apply);
    row.querySelector('#kefeSyncReset').addEventListener('click', function(){
      slider.value = 0; apply();
    });
    row.querySelector('#kefeSyncSnap').addEventListener('click', function(){
      // If a video is loaded and the user has marked where they think the
      // song starts (by scrubbing there first), take that as the offset.
      var t = Number(window.state.playback.currentTime) || 0;
      if (t > 0) {
        slider.value = Math.max(-30, Math.min(30, -t));
        apply();
      }
    });

    // Sync from existing state
    if (typeof window.state.lyricsOffset === 'number') {
      slider.value = window.state.lyricsOffset;
      apply();
    }
  }

  function getDuration() {
    try { return getMasterDuration(); } catch(e) { return 0; }
  }
  function getCurrentTime() {
    try { return getMasterTime(); } catch(e) { return 0; }
  }

  function drawThumbs() {
    var media = window.kefeMedia || {};
    var video = media.video;
    if (!video || video.readyState < 2 || !video.videoWidth) return;
    if (thumbsDrawn) return;

    var rect = strip.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = Math.round(rect.width * dpr);
    var H = Math.round(rect.height * dpr);
    if (W < 2 || H < 2) return;
    if (stripCanvas.width !== W) stripCanvas.width = W;
    if (stripCanvas.height !== H) stripCanvas.height = H;

    var ctx = stripCanvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    var N = Math.max(6, Math.min(20, Math.floor(rect.width / 60)));
    var dur = Number(video.duration) || 0;
    if (!dur) return;

    // We can't seek a playing video 20 times synchronously without stutter,
    // so we draw what we can from the first frame and lay out a time ruler.
    // A future improvement could pre-encode thumbnails via canvas.
    try {
      ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, 0, 0, W, H);
      // Darken it so the playhead/marker read clearly
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, W, H);
      // Time ticks
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = (9 * dpr) + 'px monospace';
      ctx.textBaseline = 'bottom';
      for (var i = 0; i <= N; i++) {
        var x = (i / N) * W;
        ctx.fillRect(x, H - 6 * dpr, 1 * dpr, 4 * dpr);
        var t = dur * (i / N);
        var mm = Math.floor(t / 60);
        var ss = Math.floor(t % 60);
        ctx.fillText(mm + ':' + String(ss).padStart(2, '0'), x + 3 * dpr, H - 6 * dpr);
      }
    } catch(e) {
      // Cross-origin or draw error — leave the black background.
    }

    thumbsDrawn = true;
  }

  function updatePlayhead() {
    if (!strip || !playhead) return;
    var dur = getDuration();
    var cur = getCurrentTime();
    if (dur > 0) {
      var pct = Math.max(0, Math.min(1, cur / dur));
      playhead.style.left = (pct * 100) + '%';
    }
    // Song start marker if we detected one
    var start = window.state && window.state.songStartTime;
    if (typeof start === 'number' && start > 0 && dur > 0) {
      songStartMark.style.left = ((start / dur) * 100) + '%';
      songStartMark.classList.add('visible');
    } else {
      songStartMark.classList.remove('visible');
    }
  }

  setInterval(function(){
    try {
      buildStrip();
      buildSyncRow();
      drawThumbs();
      updatePlayhead();
    } catch(e) { /* ignore */ }
  }, 300);

  console.log('[KEFE] video strip + sync slider active');
})();
