'use strict';

const KEFE_STRUCTURE=("\n<div class=\"kefe-editor\">\n<header class=\"kefe-top\">\n  <nav class=\"kefe-top-nav\" aria-label=\"Primary\">\n    <button class=\"kefe-brand\" aria-label=\"KEFE home\"><img src=\"./app/brand/favicon.svg?v=5\" alt=\"\"></button>\n    <button class=\"kefe-top-link\" type=\"button\" data-top-panel=\"media\">Media</button>\n    <button class=\"kefe-top-link\" type=\"button\" data-top-panel=\"editor\">Editor</button>\n    <button class=\"kefe-top-link\" type=\"button\" data-top-panel=\"miniplayer\">MiniPlayer</button>\n  </nav>\n  <nav class=\"kefe-top-profile\" aria-label=\"Account\">\n    <button class=\"kefe-top-link\" type=\"button\" data-top-panel=\"profile\">Profile</button>\n    <button class=\"kefe-top-link\" type=\"button\" data-top-panel=\"settings\">Settings</button>\n  </nav>\n</header>\n\n<main class=\"kefe-work\">\n  <section class=\"kefe-preview\">\n    <div class=\"kefe-stage is-16x9\">\n      <button class=\"kefe-preview-fullscreen\" id=\"previewFullscreen\" type=\"button\" aria-label=\"Enter fullscreen\" title=\"Enter fullscreen\">\n        <svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M8 3H3v5M16 3h5v5M8 21H3v-5M21 16v5h-5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>\n      </button>\n      <canvas id=\"kefeCanvas\" width=\"1280\" height=\"720\"></canvas>\n      <div class=\"kefe-title-card\" id=\"kefeTitleCard\" aria-hidden=\"true\">\n        <div class=\"kefe-title-card-inner\">\n          <div class=\"kefe-title-art\" id=\"kefeTitleArt\"><div class=\"kefe-title-art-fallback\" id=\"kefeTitleArtFallback\">K</div></div>\n          <div class=\"kefe-title-info\">\n            <p class=\"kefe-title-kicker\">Now playing</p>\n            <h1 class=\"kefe-title-name\" id=\"kefeTitleName\">Untitled</h1>\n            <p class=\"kefe-title-artist\" id=\"kefeTitleArtist\">Unknown artist</p>\n            <div class=\"kefe-title-meta\"><span id=\"kefeTitleAlbum\"></span><span id=\"kefeTitleYear\"></span></div>\n          </div>\n        </div>\n      </div>\n    </div>\n  </section>\n\n  <section class=\"kefe-timeline\" aria-label=\"Timeline\">\n    <div class=\"kefe-transport\">\n      <button class=\"kefe-play\" id=\"playButton\" type=\"button\" aria-label=\"Play\" title=\"Play\"><svg class=\"kefe-play-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M8 5.5v13l10-6.5z\" fill=\"currentColor\"/></svg></button>\n    </div>\n    <div class=\"kefe-time\"><span id=\"timeNow\">0:00</span> / <span id=\"timeEnd\">0:30</span></div>\n    <div class=\"kefe-wave\" id=\"waveform\">\n      <input id=\"kefeTime\" class=\"kefe-slider\" type=\"range\" min=\"0\" max=\"30\" step=\".01\" value=\"0\" aria-label=\"Timeline\">\n      <div class=\"playhead\" id=\"playhead\"></div>\n    </div>\n    <label class=\"kefe-aspect-controls\">\n      <span class=\"kefe-aspect-label\">Aspect</span>\n      <select id=\"kefeAspect\" class=\"kefe-aspect-select\" aria-label=\"Preview aspect ratio\">\n        <option value=\"16:9\">16:9</option>\n        <option value=\"9:16\">9:16</option>\n        <option value=\"1:1\">1:1</option>\n      </select>\n    </label>\n  </section>\n\n  <section class=\"kefe-editing\">\n    <nav class=\"kefe-tabs\" aria-label=\"Editor sections\">\n      <button class=\"kefe-section active\" data-panel=\"media\">Media</button>\n      <button class=\"kefe-section\" data-panel=\"lyrics\">Lyrics</button>\n      <button class=\"kefe-section\" data-panel=\"effects\">Effects</button>\n      <button class=\"kefe-section\" data-panel=\"visualiser\">Visualiser</button>\n      <button class=\"kefe-section\" data-panel=\"export\">Export</button>\n    </nav>\n\n    <div class=\"kefe-panels\">\n      <section class=\"kefe-panel active\" data-panel-view=\"media\">\n        <div class=\"kefe-panel-head\"><h2>Media</h2><span class=\"kefe-meta\">Audio or video is the master source.</span></div>\n        <div class=\"kefe-form\">\n          <label class=\"kefe-upload-zone\" id=\"kefeUploadZone\" for=\"mediaInput\">\n            <span class=\"kefe-upload-title\">Drop audio or video</span>\n            <span class=\"kefe-upload-name\">or choose a file</span>\n            <span class=\"kefe-upload-help\">MP3, M4A, WAV, MP4, MOV and more</span>\n            <input class=\"kefe-file\" id=\"mediaInput\" type=\"file\" accept=\".mp3,.m4a,.wav,.aac,.flac,.ogg,.oga,.opus,.aiff,.caf,.mp4,.mov,.m4v,.webm,.avi,audio/*,video/*\">\n          </label>\n          <div class=\"kefe-media-track\" id=\"kefeMediaTrack\" hidden>\n            <div class=\"kefe-media-track-art\" id=\"kefeMediaTrackArt\"><div class=\"kefe-media-track-fallback\" id=\"kefeMediaTrackFallback\">K</div></div>\n            <div class=\"kefe-media-track-info\">\n              <p class=\"kefe-media-track-kicker\">Identified track</p>\n              <h3 id=\"kefeMediaTrackTitle\">Untitled</h3>\n              <p id=\"kefeMediaTrackArtist\">Unknown artist</p>\n              <div class=\"kefe-media-track-meta\"><span id=\"kefeMediaTrackAlbum\"></span><span id=\"kefeMediaTrackYear\"></span></div>\n            </div>\n          </div>\n          <div class=\"kefe-suggestions\" id=\"kefeSuggestions\" hidden>\n            <div class=\"kefe-suggestions-head\"><span class=\"kefe-suggestions-title\">Suggestions</span><span class=\"kefe-suggestions-status\" id=\"kefeSuggestionsStatus\">Finding matches<span class=\"kefe-suggestions-dots\" aria-hidden=\"true\"><i></i><i></i><i></i></span></span></div>\n            <div class=\"kefe-suggestion-list\" id=\"kefeSuggestionList\"></div>\n          </div>\n          <div><label class=\"kefe-label\" for=\"songTitle\">Song title</label><input class=\"kefe-input\" id=\"songTitle\" type=\"text\" placeholder=\"Song title\"></div>\n          <div><label class=\"kefe-label\" for=\"songArtist\">Artist</label><input class=\"kefe-input\" id=\"songArtist\" type=\"text\" placeholder=\"Artist\"></div>\n          <div><label class=\"kefe-label\" for=\"songAlbum\">Album</label><input class=\"kefe-input\" id=\"songAlbum\" type=\"text\" placeholder=\"Album\"></div>\n          <div><label class=\"kefe-label\" for=\"songYear\">Year</label><input class=\"kefe-input\" id=\"songYear\" type=\"text\" placeholder=\"Year\"></div>\n          <div class=\"kefe-empty-panel\"><strong>Preview stays primary.</strong><br><span class=\"kefe-meta\">Editing controls stay compact beneath the visualiser.</span></div>\n        </div>\n      </section>\n\n      <section class=\"kefe-panel\" data-panel-view=\"lyrics\">\n        <div class=\"kefe-panel-head\"><h2>Lyrics</h2><span class=\"kefe-meta\" id=\"kefeLyricsStatus\">Upload audio to fetch synchronized lyrics.</span></div>\n        <div class=\"kefe-form\">\n          <div>\n            <label class=\"kefe-label\" for=\"lyricsInput\">Fetched lyrics</label>\n            <textarea class=\"kefe-textarea\" id=\"lyricsInput\" spellcheck=\"false\" placeholder=\"Synchronized lyrics will appear here after an audio track is identified.\"></textarea>\n          </div>\n        </div>\n      </section>\n\n      <section class=\"kefe-panel\" data-panel-view=\"effects\">\n        <div class=\"kefe-panel-head\"><h2>Effects</h2><span class=\"kefe-meta\">Choose the lyric treatment, font and background effect.</span></div>\n        <div class=\"kefe-form\">\n          <div>\n            <label class=\"kefe-label\" for=\"lyricEffect\">Lyric effect</label>\n            <select class=\"kefe-select\" id=\"lyricEffect\"></select>\n          </div>\n          <div>\n            <label class=\"kefe-label\" for=\"fontOverride\">Font</label>\n            <select class=\"kefe-select\" id=\"fontOverride\"><option value=\"\">Use effect font</option></select>\n          </div>\n          <div>\n            <label class=\"kefe-label\" for=\"visualiserBackground\">Background effect</label>\n            <select class=\"kefe-select\" id=\"visualiserBackground\">\n              <option value=\"black\">Black</option>\n              <option value=\"gradient\">Cinematic Gradient</option>\n              <option value=\"accent\">KEFE Accent</option>\n              <option value=\"album\">Album Bloom</option>\n              <option value=\"aurora\">Aurora Veil</option>\n              <option value=\"fluid\">Fluid Silk</option>\n              <option value=\"plasma\">Plasma Field</option>\n              <option value=\"nebula\">Deep Nebula</option>\n              <option value=\"glass\">Liquid Glass</option>\n              <option value=\"prism\">Prism Light</option>\n              <option value=\"mesh\">Generative Mesh</option>\n              <option value=\"vortex\">Vortex</option>\n              <option value=\"tunnel\">Infinite Tunnel</option>\n              <option value=\"particles\">Particle Field</option>\n              <option value=\"stars\">Starfield</option>\n              <option value=\"noise\">Film Grain</option>\n              <option value=\"scanlines\">CRT Scanlines</option>\n              <option value=\"crtdesktop\">CRT Computer Desktop</option>\n              <option value=\"crttv\">CRT TV Box</option>\n              <option value=\"chromatic\">Chromatic Drift</option>\n              <option value=\"pulse\">Ambient Pulse</option>\n              <option value=\"spectrum\">Spectral Glow</option>\n              <option value=\"monochrome\">Monochrome Bloom</option>\n            </select>\n          </div>\n          <div class=\"kefe-font-card\"><div class=\"kefe-font-name\" id=\"fontName\">SF Pro Display</div><div class=\"kefe-meta\" id=\"fontMeta\">Locked effect font</div></div>\n        </div>\n      </section>\n\n      <section class=\"kefe-panel\" data-panel-view=\"visualiser\">\n        <div class=\"kefe-panel-head\"><h2>Visualiser</h2><span class=\"kefe-meta\">The visualiser remains the main canvas.</span></div>\n        <div class=\"kefe-form\">\n          <div>\n            <label class=\"kefe-label\" for=\"visualiserPreset\">Visualiser preset</label>\n            <select class=\"kefe-select\" id=\"visualiserPreset\">\n              <option value=\"bars\">Spectrum Bars</option>\n              <option value=\"pulse\">Pulse</option>\n              <option value=\"ring\">Ring</option>\n              <option value=\"none\" selected>None</option>\n            </select>\n          </div>\n          <div>\n            <label class=\"kefe-label\" for=\"visualiserMotion\">Motion</label>\n            <select class=\"kefe-select\" id=\"visualiserMotion\">\n              <option value=\"reactive\">Audio reactive</option>\n              <option value=\"steady\">Steady</option>\n              <option value=\"slow\">Slow</option>\n            </select>\n          </div>\n        </div>\n      </section>\n\n      <section class=\"kefe-panel\" data-panel-view=\"export\">\n        <div class=\"kefe-panel-head\"><h2>Export</h2><span class=\"kefe-meta\">Export the current visualiser composition.</span></div>\n        <div class=\"kefe-form\">\n          <select class=\"kefe-select\" id=\"exportFormat\" aria-label=\"Export format\"><option value=\"webm\">WebM video</option></select>\n          <select class=\"kefe-select\" id=\"exportResolution\" aria-label=\"Export resolution\"><option value=\"720\">720p</option><option value=\"1080\" selected>1080p</option></select>\n          <button class=\"kefe-btn primary\" id=\"exportButton\" type=\"button\">Export video</button>\n          <div class=\"kefe-empty-panel\" id=\"exportStatus\">Exports the current preview canvas with its lyric and visualiser layers.</div>\n        </div>\n      </section>\n    </div>\n  </section>\n</main>\n</div>\n\n<audio id=\"kefeAudio\" preload=\"metadata\"></audio>");
document.body.insertAdjacentHTML('beforeend',KEFE_STRUCTURE);

(function(){
  const nav=document.querySelector('[data-top-panel="miniplayer"]');
  if(!nav)return;
  let frameWrap=null;
  function clampPosition(x,y){
    const w=frameWrap.offsetWidth,h=frameWrap.offsetHeight;
    return {x:Math.max(8,Math.min(x,window.innerWidth-w-8)),y:Math.max(8,Math.min(y,window.innerHeight-h-8))};
  }
  function positionDefault(){
    const w=frameWrap.offsetWidth,h=frameWrap.offsetHeight;
    const pos=clampPosition(window.innerWidth-w-24,Math.max(72,window.innerHeight-h-24));
    frameWrap.style.left=pos.x+'px';
    frameWrap.style.top=pos.y+'px';
  }
  function open(){
    if(frameWrap){frameWrap.hidden=false;return;}
    frameWrap=document.createElement('div');
    frameWrap.id='kefeMiniPlayerWindow';
    frameWrap.style.cssText='position:fixed;z-index:9999;width:min(340px,calc(100vw - 16px));height:min(760px,calc(100vh - 16px));left:0;top:0;display:block;overflow:hidden;border-radius:32px;background:transparent;box-shadow:none;touch-action:none;';
    const dragBar=document.createElement('div');
    dragBar.setAttribute('aria-label','Drag MiniPlayer');
    dragBar.title='Drag MiniPlayer';
    dragBar.style.cssText='position:absolute;left:0;right:0;top:0;height:42px;z-index:3;cursor:grab;touch-action:none;';
    const controls=document.createElement('div');
    controls.style.cssText='position:absolute;right:10px;top:8px;display:flex;gap:6px;z-index:4;';
    const minimize=document.createElement('button');
    minimize.type='button';
    minimize.title='Minimize MiniPlayer';
    minimize.setAttribute('aria-label','Minimize MiniPlayer');
    minimize.textContent='−';
    minimize.style.cssText='width:24px;height:24px;border:0;border-radius:50%;background:#e4e4e7;color:#3f3f46;font:600 14px/24px system-ui;cursor:pointer;box-shadow:3px 3px 6px rgba(163,177,198,.5),-3px -3px 6px rgba(255,255,255,.8);';
    const close=document.createElement('button');
    close.type='button';
    close.title='Close MiniPlayer';
    close.setAttribute('aria-label','Close MiniPlayer');
    close.textContent='×';
    close.style.cssText='width:24px;height:24px;border:0;border-radius:50%;background:#e4e4e7;color:#3f3f46;font:600 14px/24px system-ui;cursor:pointer;box-shadow:3px 3px 6px rgba(163,177,198,.5),-3px -3px 6px rgba(255,255,255,.8);';
    controls.append(minimize,close);
    dragBar.appendChild(controls);
    frameWrap.appendChild(dragBar);
    const frame=document.createElement('iframe');
    frame.src='./app/ui/MiniplayerKefe.html';
    frame.title='KEFE MiniPlayer';
    frame.style.cssText='position:absolute;inset:0;z-index:1;display:block;width:100%;height:100%;border:0;background:transparent;';
    frameWrap.appendChild(frame);
    document.body.appendChild(frameWrap);
    let parentDragging=false,parentStartX=0,parentStartY=0,parentStartLeft=0,parentStartTop=0;
    dragBar.addEventListener('pointerdown',event=>{
      if(event.target===minimize||event.target===close)return;
      event.preventDefault();
      parentDragging=true;
      parentStartX=event.clientX;
      parentStartY=event.clientY;
      parentStartLeft=frameWrap.offsetLeft;
      parentStartTop=frameWrap.offsetTop;
      dragBar.setPointerCapture?.(event.pointerId);
      dragBar.style.cursor='grabbing';
    });
    dragBar.addEventListener('pointermove',event=>{
      if(!parentDragging)return;
      event.preventDefault();
      const next=clampPosition(parentStartLeft+(event.clientX-parentStartX),parentStartTop+(event.clientY-parentStartY));
      frameWrap.style.left=next.x+'px';
      frameWrap.style.top=next.y+'px';
    });
    const stopParentDrag=event=>{
      if(!parentDragging)return;
      parentDragging=false;
      dragBar.releasePointerCapture?.(event.pointerId);
      dragBar.style.cursor='grab';
    };
    dragBar.addEventListener('pointerup',stopParentDrag);
    dragBar.addEventListener('pointercancel',stopParentDrag);
    minimize.addEventListener('click',event=>{
      event.preventDefault();
      event.stopPropagation();
      parentDragging=false;
      frameWrap.hidden=true;
    });
    close.addEventListener('click',event=>{
      event.preventDefault();
      event.stopPropagation();
      parentDragging=false;
      frameWrap.remove();
      frameWrap=null;
    });
    requestAnimationFrame(positionDefault);
  }
  nav.addEventListener('click',open);
})();
