/* KEFE visualiser — background layer.
   Exactly two background effects:
     apple – Apple Music-style motion backdrop built from the album artwork (slow drifting, blurred, saturated art)
     video – a video the user uploads in Media → Background video (looped, kept in sync with playback)
   Visualiser layers are composited into video export. */
(function(){
  'use strict';
  var stage,cv,cctx,sel,audio,mode='off',lastMode='apple',enabled=false,vid=null,vidUrl='',vidName='',small=null,smallKey='',avg=[20,22,30],palette=['#18212d','#30485b','#597c8b','#a7c3c9'];
  var syncBackgroundOptionsUI=null,syncBackgroundToggleUI=null;
  var work=document.createElement('canvas'),wctx=work.getContext('2d');
  var t0=performance.now();

  function artImage(){var f=window.kefeGetAlbumArt;var i=f&&f();return i&&i.complete&&i.naturalWidth>0?i:null;}
  function prepareArt(img){
    var key=img?img.src:'';
    if(key===smallKey)return;
    smallKey=key;small=null;
    if(!img)return;
    try{
      var c=document.createElement('canvas');c.width=c.height=64;var g=c.getContext('2d');
      g.drawImage(img,0,0,64,64);
      var d=g.getImageData(0,0,64,64).data,r=0,gg=0,b=0,n=0;
      for(var i=0;i<d.length;i+=4){r+=d[i];gg+=d[i+1];b+=d[i+2];n++;}
      avg=[r/n,gg/n,b/n];
       var buckets=Array.from({length:12},function(){return {r:0,g:0,b:0,n:0};});
       for(var j=0;j<d.length;j+=4){var rr=d[j],gr=d[j+1],bb=d[j+2],mx=Math.max(rr,gr,bb),mn=Math.min(rr,gr,bb),sat=mx?(mx-mn)/mx:0,hue=Math.atan2(Math.sqrt(3)*(gr-bb),2*rr-gr-bb),idx=sat<.12?11:Math.min(10,Math.floor(((hue+Math.PI)/(Math.PI*2))*11)),weight=.4+sat;buckets[idx].r+=rr*weight;buckets[idx].g+=gr*weight;buckets[idx].b+=bb*weight;buckets[idx].n+=weight;}
       var ranked=buckets.filter(function(v){return v.n>0;}).sort(function(a,b){return b.n-a.n;}),picked=[];
       ranked.forEach(function(v){if(picked.length>=5)return;var col=[v.r/v.n,v.g/v.n,v.b/v.n];if(picked.every(function(q){return Math.hypot(col[0]-q[0],col[1]-q[1],col[2]-q[2])>32;}))picked.push(col);});
       if(picked.length>=2)palette=picked.map(function(c){return 'rgb('+Math.round(c[0])+','+Math.round(c[1])+','+Math.round(c[2])+')';});
       small=c;
    }catch(e){small=null;}
  }

  /* Cover-aware motion artwork: a softly defocused environment plane and a
     gently breathing, sharper cover plane create restrained perspective depth. */
  function drawApple(g,w,h,t){
    var img=artImage();
    var base='rgb('+Math.round(avg[0]*.28)+','+Math.round(avg[1]*.28)+','+Math.round(avg[2]*.28)+')';
    g.save();
    g.fillStyle=base;g.fillRect(0,0,w,h);
    if(img){
      var vw=img.naturalWidth||img.width,vh=img.naturalHeight||img.height;
      if(vw>0&&vh>0){
        var coverScale=Math.max(w/vw,h/vh);
        var dw=vw*coverScale,dh=vh*coverScale;
        var breathe=(1-Math.cos(t*.42))*.5;
        var zoom=1.045+breathe*.075;
        var driftX=Math.sin(t*.24)*w*.012;
        var driftY=Math.cos(t*.19)*h*.012;
        /* Background plane: same artwork, enlarged and lightly blurred, never glowing. */
        g.save();
        g.filter='blur('+Math.max(2,Math.min(7,Math.min(w,h)*.0132))+'px) saturate(1.08)';
        g.globalAlpha=.574;
        var backZoom=1.16+breathe*.035;
        var bw=dw*backZoom,bh=dh*backZoom;
        g.drawImage(img,(w-bw)/2-driftX*.45,(h-bh)/2-driftY*.45,bw,bh);
        g.restore();
        /* Foreground plane: slow perspective push/pull keeps the artwork recognizable. */
        g.save();
        g.translate(w/2+driftX,h/2+driftY);
        g.scale(zoom,zoom);
        g.globalAlpha=.94;
        g.filter='blur(.715px) saturate(1.03)';
        g.drawImage(img,-dw/2,-dh/2,dw,dh);
        g.restore();
      }
    }else{
      /* Neutral fallback until album artwork is available; no animated neon glow. */
      g.fillStyle='rgba(0,0,0,.16)';g.fillRect(0,0,w,h);
    }
    /* Keep the moving art subordinate to lyrics without washing out its detail. */
    var shade=g.createLinearGradient(0,0,0,h);
    shade.addColorStop(0,'rgba(0,0,0,.18)');
    shade.addColorStop(.5,'rgba(0,0,0,.24)');
    shade.addColorStop(1,'rgba(0,0,0,.32)');
    g.fillStyle=shade;g.fillRect(0,0,w,h);
    g.restore();
  }

  /* Artwork-derived animated gradient. Native canvas gradients stay smooth at 4K export dimensions. */
  function drawAlbumGradient(g,w,h,t){
    prepareArt(artImage());
    var colors=palette&&palette.length?palette:['#18212d','#30485b','#597c8b','#a7c3c9'];
    var dark=function(value){var m=String(value).match(/rgb\((\d+),(\d+),(\d+)\)/);if(!m)return value;return 'rgb('+Math.round(Number(m[1])*.52)+','+Math.round(Number(m[2])*.52)+','+Math.round(Number(m[3])*.52)+')';};
    g.save();g.globalCompositeOperation='source-over';g.globalAlpha=1;
    var base=g.createLinearGradient(0,0,w,h);base.addColorStop(0,dark(colors[0]));base.addColorStop(.52,dark(colors[1%colors.length]));base.addColorStop(1,dark(colors[2%colors.length]));g.fillStyle=base;g.fillRect(0,0,w,h);
    var spots=[{x:.22+Math.sin(t*.16)*.10,y:.28+Math.cos(t*.13)*.08,c:colors[0]},{x:.78+Math.cos(t*.12)*.10,y:.34+Math.sin(t*.15)*.09,c:colors[1%colors.length]},{x:.52+Math.sin(t*.10)*.12,y:.82+Math.cos(t*.11)*.06,c:colors[2%colors.length]},{x:.84+Math.sin(t*.08)*.05,y:.78+Math.cos(t*.09)*.06,c:colors[3%colors.length]}];
    spots.forEach(function(p,i){var x=p.x*w,y=p.y*h,r=Math.max(w,h)*(.58+(i%2)*.12),rad=g.createRadialGradient(x,y,0,x,y,r);rad.addColorStop(0,p.c);rad.addColorStop(.42,p.c);rad.addColorStop(1,'rgba(0,0,0,0)');g.globalAlpha=.56;g.fillStyle=rad;g.fillRect(0,0,w,h);});
    var shade=g.createLinearGradient(0,0,0,h);shade.addColorStop(0,'rgba(0,0,0,.12)');shade.addColorStop(.55,'rgba(0,0,0,.18)');shade.addColorStop(1,'rgba(0,0,0,.28)');g.globalAlpha=1;g.fillStyle=shade;g.fillRect(0,0,w,h);g.restore();
  }

  function drawCover(g,el,w,h){
    var vw=el.videoWidth,vh=el.videoHeight;if(!vw||!vh)return false;
    var k=Math.max(w/vw,h/vh),dw=vw*k,dh=vh*k;
    try{g.drawImage(el,(w-dw)/2,(h-dh)/2,dw,dh);return true;}catch(e){return false;}
  }

  function useVideo(){return mode==='video'&&vid&&vid.readyState>=2;}

  /* paint(ctx,w,h,t) – used by the preview loop and by video export */
  function paint(g,w,h,t){
    g.save();g.fillStyle='#000';g.fillRect(0,0,w,h);
    if(!enabled){g.restore();return;}
    if(mode==='gradient'){drawAlbumGradient(g,w,h,t);g.restore();return;}
    if(useVideo()&&drawCover(g,vid,w,h)){
      g.restore();return;
    }
    prepareArt(artImage());
    var lw=480,lh=Math.max(2,Math.round(480*h/w));
    if(h>w){lh=480;lw=Math.max(2,Math.round(480*w/h));}
    if(work.width!==lw||work.height!==lh){work.width=lw;work.height=lh;}
    drawApple(wctx,lw,lh,t);
    g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
    g.drawImage(work,0,0,w,h);
    g.restore();
  }

  /* ── preview ── */
  function size(){
    if(!cv||!stage)return;
    var cw=(cv.clientWidth>2?cv.clientWidth:stage.clientWidth)||640,ch=(cv.clientHeight>2?cv.clientHeight:stage.clientHeight)||360;
    var sc=mode==='gradient'?Math.min(3,3840/Math.max(cw,ch)):Math.min(1,960/Math.max(cw,ch)),w=Math.max(2,Math.round(cw*sc)),h=Math.max(2,Math.round(ch*sc));
    if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h;}
  }
  var last=0;
  function loop(now){
    requestAnimationFrame(loop);
    if(document.hidden||now-last<33)return;last=now;
    size();paint(cctx,cv.width,cv.height,(performance.now()-t0)/1000);
    syncVideo(false);
  }

  /* ── video sync ── */
  function syncVideo(force){
    if(!vid||!audio||!vid.duration||!Number.isFinite(vid.duration))return;
    var want=audio.currentTime%vid.duration;
    if(force||Math.abs(vid.currentTime-want)>0.35){try{vid.currentTime=want;}catch(e){}}
    if(mode==='video'&&!audio.paused&&vid.paused)vid.play().catch(function(){});
    if((audio.paused||mode!=='video')&&!vid.paused)vid.pause();
  }

  /* ── UI ── */
  function setMode(m){
    if(m==='off'){enabled=false;mode='off';if(sel&&sel.value!=='off')sel.value='off';}
    else{mode=m;lastMode=m;enabled=true;if(sel&&sel.value!==m)sel.value=m;}
    var o=sel&&sel.querySelector('option[value="video"]');if(o)o.disabled=!vid;
    syncVideo(true);
    if(syncBackgroundOptionsUI)syncBackgroundOptionsUI();
    if(syncBackgroundToggleUI)syncBackgroundToggleUI();
  }
  function buildSelect(){
    sel=document.getElementById('visualiserBackground');if(!sel)return;
    sel.innerHTML='<option value="off">Off</option><option value="apple">Apple Motion Art</option><option value="gradient">Album Palette Gradient</option><option value="video" disabled>Uploaded video</option>';
    sel.value='off';
    sel.addEventListener('change',function(){setMode(sel.value==='video'&&!vid?'apple':sel.value);});
  }
  function buildEffectCategories(){
    var backgroundForm=document.querySelector('[data-panel-view="background-effects"] .kefe-form');
    var select=document.getElementById('visualiserBackground');
    var lyricOptions=document.getElementById('lyricEffectOptions');
    if(!backgroundForm||!select||!lyricOptions||document.getElementById('kefeBackgroundEffectOptions'))return;
    var panel=document.querySelector('[data-panel-view="background-effects"]');
    var panelHead=panel&&panel.querySelector('.kefe-panel-head');
    var heading=panelHead&&panelHead.querySelector('h2');
    if(heading&&!document.getElementById('kefeBackgroundEffectToggle')){
      var titleRow=document.createElement('div');titleRow.className='kefe-background-effect-heading';
      heading.parentNode.insertBefore(titleRow,heading);titleRow.appendChild(heading);
      var toggle=document.createElement('button');toggle.id='kefeBackgroundEffectToggle';toggle.type='button';toggle.className='kefe-background-effect-toggle kefe-switch';toggle.setAttribute('role','switch');toggle.setAttribute('aria-label','Background effects');toggle.setAttribute('aria-checked',String(enabled));
      var toggleState=document.createElement('span');toggleState.className='kefe-switch-state';
      var toggleTrack=document.createElement('span');toggleTrack.className='kefe-switch-track';toggleTrack.setAttribute('aria-hidden','true');
      var toggleThumb=document.createElement('span');toggleThumb.className='kefe-switch-thumb';toggleTrack.appendChild(toggleThumb);toggle.append(toggleState,toggleTrack);
      toggle.addEventListener('click',function(){setMode(enabled?'off':(lastMode||'apple'));});
      titleRow.appendChild(toggle);
      syncBackgroundToggleUI=function(){toggleState.textContent=enabled?'On':'Off';toggle.setAttribute('aria-checked',String(enabled));toggle.classList.toggle('is-on',enabled);};
      syncBackgroundToggleUI();
    }
    var backgroundBlock=select.closest('.kefe-background-effect-control');
    var transparency=document.getElementById('backgroundTransparency');
    var transparencyBlock=transparency&&transparency.closest('.kefe-background-effect-control');
    var upload=document.getElementById('kefeBgVideoZone');
    var uploadWrap=upload&&upload.parentElement;
    if(backgroundBlock)backgroundForm.appendChild(backgroundBlock);
    if(transparencyBlock&&transparencyBlock.parentNode!==backgroundForm)backgroundForm.appendChild(transparencyBlock);
    if(uploadWrap)backgroundForm.appendChild(uploadWrap);
    var choiceWrap=document.createElement('div');choiceWrap.id='kefeBackgroundEffectOptions';choiceWrap.className='kefe-background-effect-options';choiceWrap.setAttribute('role','group');choiceWrap.setAttribute('aria-label','Background effect options');
    [['apple','Apple Motion Art'],['gradient','Album Palette Gradient'],['video','Uploaded Video']].forEach(function(item){
      var button=document.createElement('button');button.type='button';button.className='kefe-lyric-effect-option kefe-background-effect-card';button.dataset.backgroundMode=item[0];button.setAttribute('aria-pressed',String(lastMode===item[0]));
      var preview=document.createElement('span');preview.className='kefe-background-effect-preview';preview.setAttribute('aria-hidden','true');
      var previewCore=document.createElement('span');previewCore.className='kefe-background-effect-preview-core';preview.appendChild(previewCore);
      var label=document.createElement('span');label.className='kefe-background-effect-name';label.textContent=item[1];
      button.appendChild(preview);button.appendChild(label);
      button.addEventListener('click',function(){if(item[0]==='video'&&button.disabled)return;setMode(item[0]);});
      choiceWrap.appendChild(button);
    });
    select.parentNode.insertBefore(choiceWrap,select);select.hidden=true;select.setAttribute('aria-hidden','true');select.tabIndex=-1;
    function syncBackgroundOptions(){
      choiceWrap.querySelectorAll('[data-background-mode]').forEach(function(button){var selected=button.dataset.backgroundMode===lastMode;button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));if(button.dataset.backgroundMode==='video')button.disabled=!vid;});
    }
    syncBackgroundOptionsUI=syncBackgroundOptions;
    select.addEventListener('change',function(){setMode(select.value==='video'&&!vid?'off':select.value);});
    syncBackgroundOptions();
  }
  function buildUpload(){
    var zone=document.getElementById('kefeUploadZone');if(!zone||document.getElementById('kefeBgVideoZone'))return;
    var wrap=document.createElement('div');wrap.className='beui-upload-wrap';
    wrap.innerHTML='<label class="kefe-upload-zone beui-upload-dropzone" id="kefeBgVideoZone" for="bgVideoInput">'+
      '<span class="beui-upload-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M12 16V4m-5 5 5-5 5 5M5 15v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></span>'+
      '<span class="kefe-upload-title">Background video</span>'+\n      '<span class="kefe-upload-name" id="bgVideoName">Drop file here or browse</span>'+
      '<span class="beui-upload-browse">Browse files</span>'+
      '<input class="kefe-file" id="bgVideoInput" type="file" accept=".mp4,.mov,.m4v,.webm,video/*"></label>'+
      '<div class="beui-upload-file" id="bgVideoFileRow" hidden aria-live="polite"><span class="beui-upload-file-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h4L13 6.5h4.5A2.5 2.5 0 0 1 20 9v8.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5zM9 11l2 2 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span class="beui-upload-file-copy"><span class="beui-upload-file-name" id="bgVideoFileName"></span><span class="beui-upload-file-meta">Background video</span></span><span class="beui-upload-file-status"><span class="beui-upload-status-dot"></span><span id="bgVideoFileStatus">Loading preview…</span></span><button class="kefe-btn" id="bgVideoRemove" type="button">Remove</button></div>';
    zone.parentNode.insertBefore(wrap,zone.nextSibling);
    var input=wrap.querySelector('#bgVideoInput'),name=wrap.querySelector('#bgVideoName'),rm=wrap.querySelector('#bgVideoRemove'),z=wrap.querySelector('#kefeBgVideoZone'),row=wrap.querySelector('#bgVideoFileRow'),rowName=wrap.querySelector('#bgVideoFileName'),rowStatus=wrap.querySelector('#bgVideoFileStatus');
    function load(file){
      if(!file||!/^video\//.test(file.type)&&! /\.(mp4|mov|m4v|webm)$/i.test(file.name)){name.textContent='Choose an MP4, MOV or WebM video';return;}
      clearVideo();
      vidUrl=URL.createObjectURL(file);vidName=file.name;
      rowName.textContent=file.name;rowStatus.textContent='Loading preview…';row.hidden=false;z.classList.add('has-selected-file');
      vid=document.createElement('video');vid.muted=true;vid.loop=true;vid.playsInline=true;vid.preload='auto';vid.style.display='none';
      vid.src=vidUrl;document.body.appendChild(vid);
      vid.addEventListener('loadeddata',function(){name.textContent=vidName;rowStatus.textContent='Ready to use';z.classList.add('kefe-confirmed-container');setMode('video');syncVideo(true);if(audio&&!audio.paused)vid.play().catch(function(){});});
      vid.addEventListener('error',function(){name.textContent='Could not load this video';rowStatus.textContent='Could not read file';z.classList.remove('kefe-confirmed-container','has-selected-file');row.hidden=true;clearVideo();});
      vid.load();
    }
    input.addEventListener('change',function(){load(input.files&&input.files[0]);});
    ['dragenter','dragover'].forEach(function(e){z.addEventListener(e,function(ev){ev.preventDefault();z.classList.add('is-dragging');});});
    ['dragleave','drop'].forEach(function(e){z.addEventListener(e,function(ev){ev.preventDefault();z.classList.remove('is-dragging');});});
    z.addEventListener('drop',function(ev){var f=ev.dataTransfer&&ev.dataTransfer.files&&ev.dataTransfer.files[0];if(f)load(f);});
    rm.addEventListener('click',function(){clearVideo();z.classList.remove('kefe-confirmed-container','has-selected-file');input.value='';name.textContent='Drop file here or browse';row.hidden=true;setMode('apple');});
  }
  function clearVideo(){
    if(vid){vid.pause();vid.removeAttribute('src');vid.load();vid.remove();vid=null;}
    if(vidUrl){URL.revokeObjectURL(vidUrl);vidUrl='';}
  }

  function init(){
    stage=document.querySelector('.kefe-stage');audio=document.getElementById('kefeAudio');
    if(!stage)return;
    cv=document.createElement('canvas');cv.id='kefeBackgroundCanvas';cv.setAttribute('aria-hidden','true');
    stage.insertBefore(cv,stage.firstChild);cctx=cv.getContext('2d');
    var transparencyLayer=document.createElement('div');transparencyLayer.id='kefeBackgroundTransparencyLayer';transparencyLayer.setAttribute('aria-hidden','true');
    transparencyLayer.style.cssText='position:absolute;inset:0;z-index:3;pointer-events:none;background:#000;opacity:0;';
    stage.appendChild(transparencyLayer);
    var lyricCanvas=document.getElementById('kefeCanvas'),appleLyrics=document.getElementById('kefeAppleLyrics');
    if(lyricCanvas)lyricCanvas.style.zIndex='4';if(appleLyrics)appleLyrics.style.zIndex='5';
    if(window.ResizeObserver)new ResizeObserver(size).observe(stage);
    window.addEventListener('kefe-stage-resize',size);
    buildSelect();buildUpload();buildEffectCategories();
    window.addEventListener('kefe-effect-change',function(event){if(event.detail&&event.detail.effect==='apple')setMode('gradient');});
    var appleLyrics=document.getElementById('kefeAppleLyrics');if(appleLyrics&&appleLyrics.style.display!=='none')setMode('gradient');
    var transparency=document.getElementById('backgroundTransparency'),transparencyValue=document.getElementById('backgroundTransparencyValue');
    if(transparency&&transparencyValue){
      var updateTransparency=function(){var amount=Math.max(0,Math.min(100,Number(transparency.value)||0))/100;transparencyValue.value=transparency.value+'%';transparencyValue.textContent=transparency.value+'%';transparencyLayer.style.opacity=String(amount);};
      transparency.addEventListener('input',updateTransparency);updateTransparency();
    }
    if(audio)['play','pause','seeked','ended'].forEach(function(e){audio.addEventListener(e,function(){syncVideo(e==='seeked');});});
    size();requestAnimationFrame(loop);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();

  function paintTransparency(g,w,h){var amount=Math.max(0,Math.min(100,Number(document.getElementById('backgroundTransparency')?.value)||0))/100;if(amount>0){g.save();g.fillStyle='rgba(0,0,0,'+amount+')';g.fillRect(0,0,w,h);g.restore();}}
  window.kefeBackground={paint:paint,paintTransparency:paintTransparency,setMode:setMode,mode:function(){return mode;},blend:function(){return !enabled?'source-over':'screen';},hasVideo:function(){return !!vid;}};
})();
