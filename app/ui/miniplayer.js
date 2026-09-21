(function(){
  'use strict';
  if (window.__kefeMiniPlayer) return;
  window.__kefeMiniPlayer = true;

  var SKINS = ['ipod', 'glass', 'neum'];
  var skin = 'ipod';
  var audio = new Audio();
  var root = null;
  var dragging = false, dragX = 0, dragY = 0;

  function fmt(s){
    s = Math.max(0, Number(s) || 0);
    var m = Math.floor(s / 60), r = Math.floor(s % 60);
    return m + ':' + (r < 10 ? '0' : '') + r;
  }
  function curTrack(){
    try { var m = window.kefeMedia || {}; return m.audioFile || (window.state && window.state.audio && window.state.audio.file) || null; }
    catch(e){ return null; }
  }
  function titleOf(){
    var s = window.state || {};
    var md = s.audio && s.audio.metadata;
    if (md && md.title) return md.title;
    var f = curTrack();
    return f ? f.name.replace(/\.[^.]+$/, '') : 'No track loaded';
  }
  function artistOf(){
    var s = window.state || {};
    var md = s.audio && s.audio.metadata;
    return (md && md.artist) || '';
  }
  function artSrc(){
    try { var img = window.kefeAlbumArt; return (img && img.src) ? img.src : ''; }
    catch(e){ return ''; }
  }

  function ipodHTML(){
    return '<div class="kmp-switch">◐</div>' +
      '<div class="kmp-ipod-screen" data-art>' +
        '<div class="kmp-ipod-status"><span>KEFE</span><span id="kmp-ipod-mode">▶</span></div>' +
        '<div class="kmp-ipod-title">' + titleOf() + '</div>' +
        '<div class="kmp-ipod-artist">' + (artistOf() || 'KEFE Visualiser') + '</div>' +
        '<div class="kmp-ipod-progress"><i id="kmp-bar"></i></div>' +
        '<div class="kmp-ipod-time"><span id="kmp-cur">0:00</span><span id="kmp-dur">0:00</span></div>' +
      '</div>' +
      '<div class="kmp-ipod-wheel">' +
        '<div class="kmp-menu">MENU</div>' +
        '<div class="kmp-prev kmp-btn" data-act="prev">◀◀</div>' +
        '<div class="kmp-next kmp-btn" data-act="next">▶▶</div>' +
        '<div class="kmp-play kmp-btn" data-act="play">▶‖</div>' +
        '<div class="kmp-center kmp-btn" data-act="play"></div>' +
      '</div>';
  }

  function glassHTML(){
    return '<div class="kmp-switch">◐</div>' +
      '<div class="kmp-gl-art" data-art></div>' +
      '<div class="kmp-gl-body">' +
        '<div class="kmp-gl-bars"><span></span><span></span><span></span><span></span><span></span></div>' +
        '<div class="kmp-gl-artist">' + (artistOf() || 'KEFE') + '</div>' +
        '<div class="kmp-gl-title">' + titleOf() + '</div>' +
        '<div class="kmp-gl-progress"><i id="kmp-bar"></i></div>' +
        '<div class="kmp-gl-time"><span id="kmp-cur">0:00</span> <small>/</small> <span id="kmp-dur">0:00</span></div>' +
        '<div class="kmp-gl-controls">' +
          '<div class="kmp-gl-btn kmp-btn" data-act="prev">◀◀</div>' +
          '<div class="kmp-gl-btn kmp-btn" data-act="play">▶</div>' +
          '<div class="kmp-gl-btn kmp-btn" data-act="next">▶▶</div>' +
        '</div>' +
      '</div>';
  }

  function neumHTML(){
    var d = new Date();
    return '<div class="kmp-switch">◐</div>' +
      '<div class="kmp-nm-top">' +
        '<div><div class="kmp-nm-date"><b>' + (d.getMonth()+1) + '/' + d.getDate() + '</b></div>' +
        '<div class="kmp-nm-clock">' + (d.getHours() < 12 ? 'AM' : 'PM') + '</div></div>' +
        '<div class="kmp-nm-badge"><span>R</span><span>24</span></div>' +
      '</div>' +
      '<div class="kmp-nm-track">' +
        '<div class="kmp-nm-track-info">' +
          '<div class="kmp-nm-track-label">Now playing</div>' +
          '<div class="kmp-nm-track-name">' + titleOf() + '</div>' +
        '</div>' +
        '<div class="kmp-nm-track-tag">KEFE</div>' +
        '<div class="kmp-nm-btn kmp-btn" data-act="play">▶</div>' +
      '</div>' +
      '<div class="kmp-nm-bottom">' +
        '<div class="kmp-nm-disc">' +
          '<div class="kmp-nm-hand kmp-nm-hand-h" style="transform:translate(-50%,-100%) rotate(' + ((d.getHours() % 12) * 30) + 'deg)"></div>' +
          '<div class="kmp-nm-hand kmp-nm-hand-m" style="transform:translate(-50%,-100%) rotate(' + (d.getMinutes() * 6) + 'deg)"></div>' +
        '</div>' +
        '<div class="kmp-nm-art" data-art></div>' +
        '<div style="flex:1;display:flex;flex-direction:column;gap:6px">' +
          '<div class="kmp-nm-transport">' +
            '<div class="kmp-nm-pill kmp-btn" data-act="prev">◀</div>' +
            '<div class="kmp-nm-pill kmp-btn" data-act="play">▶</div>' +
            '<div class="kmp-nm-pill kmp-btn" data-act="next">▶</div>' +
          '</div>' +
          '<div class="kmp-nm-time"><span id="kmp-cur">0:00</span> / <span id="kmp-dur">0:00</span></div>' +
        '</div>' +
      '</div>';
  }

  function applyArt(){
    var src = artSrc();
    root.querySelectorAll('[data-art]').forEach(function(el){
      if (src) { el.style.backgroundImage = 'url(' + src + ')'; }
      else { el.style.backgroundImage = ''; }
    });
  }

  function render(){
    if (!root) return;
    root.className = 'kmp-' + skin;
    root.innerHTML = skin === 'ipod' ? ipodHTML() : skin === 'glass' ? glassHTML() : neumHTML();
    wire();
    applyArt();
  }

  function wire(){
    root.querySelectorAll('[data-act]').forEach(function(el){
      el.addEventListener('click', function(e){ e.stopPropagation(); action(el.dataset.act); });
    });
    var sw = root.querySelector('.kmp-switch');
    if (sw) sw.addEventListener('click', function(e){
      e.stopPropagation();
      skin = SKINS[(SKINS.indexOf(skin) + 1) % SKINS.length];
      render();
    });
  }

  function action(a){
    if (a === 'play') toggle();
    else if (a === 'prev') seek(-10);
    else if (a === 'next') seek(10);
  }
  function toggle(){
    if (!audio.src) load();
    if (audio.paused) audio.play().catch(function(){}); else audio.pause();
  }
  function seek(d){ if (audio.duration) audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + d)); }
  function load(){ var f = curTrack(); if (f) audio.src = URL.createObjectURL(f); }

  function tick(){
    if (!root) return;
    var c = document.getElementById('kmp-cur'); if (c) c.textContent = fmt(audio.currentTime);
    var du = document.getElementById('kmp-dur'); if (du) du.textContent = fmt(audio.duration);
    var b = document.getElementById('kmp-bar'); if (b) b.style.width = audio.duration ? ((audio.currentTime / audio.duration) * 100) + '%' : '0%';
    var m = document.getElementById('kmp-ipod-mode'); if (m) m.textContent = audio.paused ? '▶' : '❚❚';
    root.querySelectorAll('[data-act="play"]').forEach(function(el){ el.textContent = audio.paused ? '▶' : '❚❚'; });
    applyArt();
  }

  function build(){
    if (root) return;
    root = document.createElement('div');
    root.id = 'kefeMiniPlayer';
    document.body.appendChild(root);
    render();
    tick();
    setInterval(tick, 500);

    root.addEventListener('pointerdown', function(e){
      if (e.target.closest('[data-act]') || e.target.closest('.kmp-switch')) return;
      dragging = true; root.classList.add('dragging');
      var r = root.getBoundingClientRect();
      dragX = e.clientX - r.left; dragY = e.clientY - r.top;
      try { root.setPointerCapture(e.pointerId); } catch(x){}
    });
    root.addEventListener('pointermove', function(e){
      if (!dragging) return;
      root.style.left = (e.clientX - dragX) + 'px';
      root.style.top = (e.clientY - dragY) + 'px';
      root.style.right = 'auto';
      root.style.bottom = 'auto';
    });
    root.addEventListener('pointerup', function(e){
      dragging = false; root.classList.remove('dragging');
      try { root.releasePointerCapture(e.pointerId); } catch(x){}
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build, {once: true});
  else build();
})();