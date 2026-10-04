/* KEFE visualiser — background layer.
   Exactly two background effects:
     apple – Apple Music-style motion backdrop built from the album artwork (slow drifting, blurred, saturated art)
     video – a video the user uploads in Media → Background video (looped, kept in sync with playback)
   The particle canvas is blended with `screen` over this layer, and the same layer is composited into video export. */
(function(){
  'use strict';
  var stage,cv,cctx,sel,audio,mode='off',vid=null,vidUrl='',vidName='',small=null,smallKey='',avg=[20,22,30];
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
      avg=[r/n,gg/n,b/n];small=c;
    }catch(e){small=null;}
  }

  /* Apple-style motion art, drawn at low resolution so it stays soft and cheap. */
  function drawApple(g,w,h,t){
    var base='rgb('+Math.round(avg[0]*.35)+','+Math.round(avg[1]*.35)+','+Math.round(avg[2]*.35)+')';
    g.save();g.fillStyle=base;g.fillRect(0,0,w,h);
    var s=Math.max(w,h);
    if(small){
      try{g.filter='saturate(1.7) blur('+Math.round(s*.012)+'px)';}catch(e){}
      for(var i=0;i<4;i++){
        g.save();
        g.translate(w/2+Math.sin(t*.11+i*1.7)*w*.2,h/2+Math.cos(t*.09+i*2.3)*h*.2);
        g.rotate(t*(.05+.03*i)*(i%2?-1:1)+i);
        var sz=s*(1.15+.3*i);g.globalAlpha=i?.55:1;
        g.drawImage(small,-sz/2,-sz/2,sz,sz);g.restore();
      }
      try{g.filter='none';}catch(e){}
    }else{
      for(var j=0;j<4;j++){
        var hue=(j*70+t*6+210)%360,x=w*(.5+.32*Math.sin(t*.13+j*1.9)),y=h*(.5+.32*Math.cos(t*.1+j*2.4));
        var gr=g.createRadialGradient(x,y,0,x,y,s*.6);
        gr.addColorStop(0,'hsla('+hue+',75%,52%,.85)');gr.addColorStop(1,'hsla('+hue+',75%,52%,0)');
        g.fillStyle=gr;g.fillRect(0,0,w,h);
      }
    }
    g.fillStyle='rgba(0,0,0,.28)';g.fillRect(0,0,w,h);
    g.restore();
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
    if(mode==='off'){g.restore();return;}
    if(useVideo()&&drawCover(g,vid,w,h)){g.restore();return;}
    prepareArt(artImage());
    var lw=480,lh=Math.max(2,Math.round(480*h/w));
    if(h>w){lh=480;lw=Math.max(2,Math.round(480*w/h));}
    if(work.width!==lw||work.height!==lh){work.width=lw;work.height=lh;}
    drawApple(wctx,lw,lh,t);
    g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
    g.drawImage(work,0,0,w,h);g.restore();
  }

  /* ── preview ── */
  function size(){
    if(!cv||!stage)return;
    var cw=(cv.clientWidth>2?cv.clientWidth:stage.clientWidth)||640,ch=(cv.clientHeight>2?cv.clientHeight:stage.clientHeight)||360;
    var sc=Math.min(1,960/Math.max(cw,ch)),w=Math.max(2,Math.round(cw*sc)),h=Math.max(2,Math.round(ch*sc));
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
    mode=m;if(sel&&sel.value!==m)sel.value=m;
    /* Particles keep their own colours when no background is shown; only blend over a background. */
    var vc=document.getElementById('kefeVisualiserCanvas');if(vc)vc.style.mixBlendMode=m==='off'?'normal':'screen';
    var o=sel&&sel.querySelector('option[value="video"]');if(o)o.disabled=!vid;
    syncVideo(true);
  }
  function buildSelect(){
    sel=document.getElementById('visualiserBackground');if(!sel)return;
    sel.innerHTML='<option value="off">Off</option><option value="apple">Apple Motion Art</option><option value="video" disabled>Uploaded video</option>';
    sel.value='off';
    sel.addEventListener('change',function(){setMode(sel.value==='video'&&!vid?'apple':sel.value);});
  }
  function buildUpload(){
    var zone=document.getElementById('kefeUploadZone');if(!zone||document.getElementById('kefeBgVideoZone'))return;
    var wrap=document.createElement('div');wrap.style.cssText='grid-column:1/-1;display:grid;gap:8px';
    wrap.innerHTML='<label class="kefe-upload-zone" id="kefeBgVideoZone" for="bgVideoInput">'+
      '<span class="kefe-upload-title">Background video</span>'+
      '<span class="kefe-upload-name" id="bgVideoName">Optional — loops behind the visualiser</span>'+
      '<span class="kefe-upload-help">MP4, MOV, WebM</span>'+
      '<input class="kefe-file" id="bgVideoInput" type="file" accept=".mp4,.mov,.m4v,.webm,video/*"></label>'+
      '<button class="kefe-btn" id="bgVideoRemove" type="button" hidden>Remove background video</button>';
    zone.parentNode.insertBefore(wrap,zone.nextSibling);
    var input=wrap.querySelector('#bgVideoInput'),name=wrap.querySelector('#bgVideoName'),rm=wrap.querySelector('#bgVideoRemove'),z=wrap.querySelector('#kefeBgVideoZone');
    function load(file){
      if(!file||!/^video\//.test(file.type)&&!/\.(mp4|mov|m4v|webm)$/i.test(file.name)){name.textContent='Choose a video file';return;}
      clearVideo();
      vidUrl=URL.createObjectURL(file);vidName=file.name;
      vid=document.createElement('video');vid.muted=true;vid.loop=true;vid.playsInline=true;vid.preload='auto';vid.style.display='none';
      vid.src=vidUrl;document.body.appendChild(vid);
      vid.addEventListener('loadeddata',function(){name.textContent=vidName;rm.hidden=false;setMode('video');syncVideo(true);if(audio&&!audio.paused)vid.play().catch(function(){});});
      vid.addEventListener('error',function(){name.textContent='Could not read that video';clearVideo();});
      vid.load();
    }
    input.addEventListener('change',function(){load(input.files&&input.files[0]);});
    ['dragenter','dragover'].forEach(function(e){z.addEventListener(e,function(ev){ev.preventDefault();z.classList.add('is-dragging');});});
    ['dragleave','drop'].forEach(function(e){z.addEventListener(e,function(ev){ev.preventDefault();z.classList.remove('is-dragging');});});
    z.addEventListener('drop',function(ev){var f=ev.dataTransfer&&ev.dataTransfer.files&&ev.dataTransfer.files[0];if(f)load(f);});
    rm.addEventListener('click',function(){clearVideo();input.value='';name.textContent='Optional — loops behind the visualiser';rm.hidden=true;setMode('apple');});
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
    if(window.ResizeObserver)new ResizeObserver(size).observe(stage);
    window.addEventListener('kefe-stage-resize',size);
    buildSelect();buildUpload();
    if(audio)['play','pause','seeked','ended'].forEach(function(e){audio.addEventListener(e,function(){syncVideo(e==='seeked');});});
    size();requestAnimationFrame(loop);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();

  window.kefeBackground={paint:paint,mode:function(){return mode;},blend:function(){return mode==='off'?'source-over':'screen';},hasVideo:function(){return !!vid;}};
})();
