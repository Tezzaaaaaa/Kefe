/* KEFE Motion Artwork — standalone album-cover animation generator. */
(function () {
  'use strict';
  function init() {
    const host = document.querySelector('[data-panel-view="background-effects"] .kefe-form');
    if (!host || document.getElementById('kefeMotionArtwork')) return;
    const root = document.createElement('section');
    root.id = 'kefeMotionArtwork';
    root.className = 'kefe-motion-artwork shad-card';
    root.dataset.slot = 'card';
    root.innerHTML = '<div class="kma-head"><div><span class="kma-kicker">ALBUM ART STUDIO</span><h3>Motion Artwork</h3><p>Bring a still cover to life with a seamless cinematic loop.</p></div><span class="kma-status shad-badge shad-badge--secondary" data-slot="badge" data-variant="secondary" id="kmaStatus">Ready</span></div>' +
      '<label class="kma-upload shad-dropzone" data-slot="dropzone" for="kmaImage"><span class="kma-upload-icon" aria-hidden="true">＋</span><span><b id="kmaFileName">Upload album artwork</b><small>JPG, PNG or WebP · square or portrait</small></span><input id="kmaImage" type="file" accept="image/jpeg,image/png,image/webp"></label>' +
      '<div class="kma-preview-wrap"><canvas id="kmaPreview" width="720" height="960" aria-label="Motion artwork preview"></canvas><span class="kma-preview-label">LIVE PREVIEW</span></div>' +
      '<div class="kma-controls">' +
      '<label>Motion style<select class="kefe-select" id="kmaStyle"><option value="cinematic">Cinematic drift</option><option value="parallax">3D depth</option><option value="light">Light sweep</option><option value="orbit">Floating motion</option></select></label>' +
      '<label>Artwork format<select class="kefe-select" id="kmaAspect"><option value="portrait">Portrait · 3:4</option><option value="square">Square · 1:1</option></select></label>' +
      '<label class="kma-range">Motion intensity <output id="kmaIntensityValue">55%</output><input id="kmaIntensity" type="range" min="0" max="100" value="55"></label>' +
      '<label class="kma-range">Background softness <output id="kmaSoftnessValue">70%</output><input id="kmaSoftness" type="range" min="0" max="100" value="70"></label>' +
      '<label class="kma-range">Lighting <output id="kmaLightingValue">35%</output><input id="kmaLighting" type="range" min="0" max="100" value="35"></label>' +
      '</div><div class="kma-export-row"><label>Resolution<select class="kefe-select" id="kmaResolution"><option value="1080">1080p</option><option value="2160">4K</option></select></label><button type="button" class="kefe-btn primary shad-btn shad-btn--primary" data-slot="button" data-variant="default" id="kmaExport" disabled>Export motion artwork</button><button type="button" class="kefe-btn shad-btn shad-btn--outline" data-slot="button" data-variant="outline" id="kmaCancel" hidden>Cancel</button></div>' +
      '<p class="kma-foot" id="kmaFoot">Upload a cover to start. The loop begins and ends on the original artwork.</p>';
    host.appendChild(root);
    const $ = id => root.querySelector('#' + id);
    const canvas = $('kmaPreview'), ctx = canvas.getContext('2d');
    if (!ctx) {
      window.kefeResilience?.panelError('background-effects', { id: 'kma-canvas', title: 'Motion Artwork preview unavailable', message: '2D canvas rendering could not start in this browser.' });
      return;
    }
    let image = new Image();
    let loaded = false, start = performance.now(), exporting = false, previewLoop = null, activeAbort = null;
    const scope = window.kefeResilience?.createScope?.();
    const values = () => ({style:$('kmaStyle').value,intensity:Number($('kmaIntensity').value)/100,softness:Number($('kmaSoftness').value)/100,lighting:Number($('kmaLighting').value)/100});
    function setAspect() {
      const square = $('kmaAspect').value === 'square';
      canvas.width = square ? 960 : 720; canvas.height = 960;
      canvas.dataset.square = String(square);
      $('kmaPreview').parentElement.style.aspectRatio = square ? '1' : '3 / 4';
    }
    function draw(target, w, h, seconds) {
      if (!target || w < 2 || h < 2) return;
      const c = target, v = values(), phase = (seconds % 8) / 8 * Math.PI * 2;
      c.save(); c.clearRect(0,0,w,h); c.fillStyle='#101114'; c.fillRect(0,0,w,h);
      if (!loaded || !image.complete || !image.naturalWidth) { c.restore(); return; }
      const iw=image.naturalWidth, ih=image.naturalHeight, cover=Math.max(w/iw,h/ih), bw=iw*cover, bh=ih*cover;
      const breathe=(1-Math.cos(phase))*.5, move=v.intensity;
      const blur=Math.round(2+v.softness*34);
      c.save(); c.filter='blur('+blur+'px) saturate(1.12)'; c.globalAlpha=.72;
      const bgZoom=1.12+breathe*.09*move;
      const bgW=bw*bgZoom,bgH=bh*bgZoom;
      c.drawImage(image,(w-bgW)/2+Math.sin(phase)*w*.018*move,(h-bgH)/2+Math.cos(phase)*h*.018*move,bgW,bgH);
      c.restore();
      c.fillStyle='rgba(0,0,0,'+(.18+v.softness*.2)+')';c.fillRect(0,0,w,h);
      const fit=Math.min(w/iw,h/ih)*.88;
      let scale=fit*(1+breathe*.045*move),x=w/2,y=h/2;
      if(v.style==='parallax'){x+=Math.sin(phase)*w*.025*move;y+=Math.cos(phase)*h*.02*move;}
      if(v.style==='orbit'){x+=Math.sin(phase)*w*.035*move;y+=Math.cos(phase)*h*.025*move;scale*=1+Math.sin(phase)*.012*move;}
      const fw=iw*scale,fh=ih*scale;
      c.save();c.translate(x,y);c.rotate(v.style==='orbit'?Math.sin(phase)*.012*move:Math.sin(phase)*.003*move);
      c.shadowColor='rgba(0,0,0,.48)';c.shadowBlur=Math.min(w,h)*.035;c.shadowOffsetY=Math.min(w,h)*.012;
      c.filter='saturate(1.02)';c.drawImage(image,-fw/2,-fh/2,fw,fh);c.restore();
      if(v.style==='light'&&v.lighting>0){const sweep=.5+Math.sin(phase)*.72;c.save();c.globalCompositeOperation='screen';const g=c.createLinearGradient(w*sweep,0,w*(sweep+.32),h);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.5,'rgba(255,255,255,'+(.22*v.lighting)+')');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,0,w,h);c.restore();}
      if(v.lighting>0){const g=c.createRadialGradient(w*.5,h*.42,0,w*.5,h*.42,Math.max(w,h)*.78);g.addColorStop(0,'rgba(255,255,255,'+(v.lighting*.055)+')');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,0,w,h);}
      const shade=c.createLinearGradient(0,0,0,h);shade.addColorStop(0,'rgba(0,0,0,.08)');shade.addColorStop(1,'rgba(0,0,0,.2)');c.fillStyle=shade;c.fillRect(0,0,w,h);
      c.restore();
    }
    function isPanelVisible(){
      const panel = root.closest('[data-panel-view]');
      return !panel || (!panel.hidden && panel.getAttribute('aria-hidden') !== 'true');
    }
    function syncPreviewLoop(){
      if(loaded && !document.hidden && isPanelVisible()) previewLoop?.start();
      else { previewLoop?.stop(); draw(ctx, canvas.width, canvas.height, 0); }
    }
    previewLoop = window.kefeResilience?.createRenderLoop
      ? window.kefeResilience.createRenderLoop(now => {
          if (!loaded || document.hidden || !isPanelVisible()) return false;
          draw(ctx, canvas.width, canvas.height, (now - start) / 1000);
          return true;
        }, {
          onError(err) {
            console.error('[KEFE Motion Artwork preview]', err);
            loaded = false;
            $('kmaFoot').textContent = 'Preview stopped due to a canvas error.';
          },
        })
      : { start(){}, stop(){}, dispose(){} };
    function status(text){$('kmaStatus').textContent=text;}
    $('kmaImage').addEventListener('change',()=>{
      const file=$('kmaImage').files&&$('kmaImage').files[0];if(!file)return;
      if(!/^image\/(jpeg|png|webp)$/.test(file.type)){ $('kmaFoot').textContent='Choose a JPG, PNG or WebP image.';return; }
      const url=URL.createObjectURL(file),uploadedImage=new Image();
      uploadedImage.onload=()=>{image=uploadedImage;loaded=true;URL.revokeObjectURL(url);$('kmaFileName').textContent=file.name;$('kmaExport').disabled=false;status('Artwork loaded');$('kmaFoot').textContent='Using your uploaded artwork. Selecting a song in Find Your Song will replace it with that track’s cover.';syncPreviewLoop();};
      uploadedImage.onerror=()=>{URL.revokeObjectURL(url);$('kmaFoot').textContent='This image could not be opened.';};uploadedImage.src=url;
    });
    function useTrackArtwork(detail){
      const sourceImage=detail&&detail.image;
      if(!sourceImage||!sourceImage.complete||!sourceImage.naturalWidth){
        loaded=false;image=new Image();$('kmaExport').disabled=true;
        $('kmaFileName').textContent='Waiting for song artwork';
        status('No track artwork');$('kmaFoot').textContent='Upload artwork or choose a song with available album artwork.';
        syncPreviewLoop();
        return;
      }
      image=sourceImage;loaded=true;$('kmaExport').disabled=false;
      const title=[detail.title,detail.artist].filter(Boolean).join(' — ');
      $('kmaFileName').textContent=title||'Current song artwork';
      const labels={'uploaded-audio':'Embedded in uploaded audio','selected-song':'Selected from Find Your Song','track-metadata':'Current track artwork'};
      status('Track artwork loaded');
      $('kmaFoot').textContent='Using '+(labels[detail.source]||'current track artwork')+(title?' for '+title:'')+'. Upload a different cover to override it.';
      syncPreviewLoop();
    }
    const onArtChanged = event => useTrackArtwork(event.detail);
    const onViewChanged = () => syncPreviewLoop();
    if (scope) {
      scope.on(window, 'kefe-album-artwork-changed', onArtChanged);
      scope.on(window, 'kefe-panel-view-change', onViewChanged);
      const panelEl = root.closest('[data-panel-view]');
      if (panelEl && window.MutationObserver) {
        const obs = new MutationObserver(syncPreviewLoop);
        obs.observe(panelEl, { attributes: true, attributeFilter: ['hidden', 'aria-hidden', 'class'] });
        scope.add(() => obs.disconnect());
      }
      scope.add(() => { previewLoop.dispose(); activeAbort?.abort(); });
    } else {
      window.addEventListener('kefe-album-artwork-changed', onArtChanged);
    }
    const currentArtwork=window.kefeGetAlbumArt&&window.kefeGetAlbumArt();
    if(currentArtwork&&currentArtwork.complete&&currentArtwork.naturalWidth){
      useTrackArtwork({image:currentArtwork,source:'track-metadata'});
    }
    ['kmaStyle','kmaAspect'].forEach(id=>$(id).addEventListener('change',()=>{if(id==='kmaAspect')setAspect();if(!loaded)draw(ctx,canvas.width,canvas.height,0);}));
    ['kmaIntensity','kmaSoftness','kmaLighting'].forEach(id=>$(id).addEventListener('input',()=>{$(id+'Value').textContent=$(id).value+'%';}));
    $('kmaCancel').addEventListener('click',()=>{activeAbort?.abort();});
    $('kmaExport').addEventListener('click',async()=>{
      if(!loaded||exporting)return;
      if(window.kefeResilience&&!window.kefeResilience.isImageCorsSafe(image)){
        status('Export blocked');$('kmaFoot').textContent='Current album cover URL blocks cross-origin video capture. Upload a local cover image above to export Motion Artwork.';
        return;
      }
      if(!HTMLCanvasElement.prototype.captureStream||!window.MediaRecorder){$('kmaFoot').textContent='Video export is not supported in this browser.';return;}
      exporting=true;$('kmaExport').disabled=true;$('kmaCancel').hidden=false;status('Rendering');$('kmaFoot').textContent='Rendering an 8-second loop. Keep this tab open.';
      activeAbort = new AbortController();
      const signal = activeAbort.signal;
      let stream = null, recorder = null, timeoutId = 0, url = '';
      try{
        const square=$('kmaAspect').value==='square',long=Number($('kmaResolution').value),w=square?long:Math.round(long*3/4),h=long;
        const out=document.createElement('canvas');out.width=w;out.height=h;
        const outCtx=out.getContext('2d');
        if(!outCtx)throw new Error('Could not open 2D export canvas.');
        draw(outCtx,w,h,0);
        stream=out.captureStream(30);
        const types=['video/mp4;codecs=avc1.640028','video/mp4;codecs=avc1','video/mp4','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'];
        const mime=types.find(t=>MediaRecorder.isTypeSupported(t));
        if(!mime)throw new Error('This browser does not expose a supported video encoder.');
        const chunks=[];
        recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:long>=2160?32000000:12000000});
        recorder.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data);};
        const stopped=new Promise((resolve,reject)=>{
          recorder.onstop=resolve;
          recorder.onerror=ev=>reject(ev?.error||new Error('Video encoding failed'));
        });
        timeoutId=setTimeout(()=>{try{activeAbort?.abort();}catch(_){}},20000);
        const renderStart=performance.now();
        recorder.start(250);
        await new Promise((resolve,reject)=>{
          if(signal.aborted){reject(new DOMException('Export cancelled','AbortError'));return;}
          let rafId=0;
          const onAbort=()=>{if(rafId)cancelAnimationFrame(rafId);reject(new DOMException('Export cancelled','AbortError'));};
          signal.addEventListener('abort',onAbort,{once:true});
          function renderFrame(now){
            if(signal.aborted)return;
            const elapsed=(now-renderStart)/1000;
            if(elapsed>=8){
              draw(outCtx,w,h,8);
              signal.removeEventListener('abort',onAbort);
              resolve();
              return;
            }
            draw(outCtx,w,h,elapsed);
            rafId=requestAnimationFrame(renderFrame);
          }
          rafId=requestAnimationFrame(renderFrame);
        });
        if(recorder.state==='recording')recorder.stop();
        await stopped;
        if(signal.aborted)throw new DOMException('Export cancelled','AbortError');
        if(!chunks.length)throw new Error('No video data was recorded.');
        const blob=new Blob(chunks,{type:mime});
        url=URL.createObjectURL(blob);
        const a=document.createElement('a');
        const ext=mime.startsWith('video/mp4')?'mp4':'webm';
        a.href=url;a.download='KEFE-Motion-Artwork.'+ext;document.body.appendChild(a);a.click();a.remove();
        setTimeout(()=>{if(url)URL.revokeObjectURL(url);},15000);
        status('Export complete');$('kmaFoot').textContent='Exported '+w+' × '+h+' '+ext.toUpperCase()+'.';
      }catch(error){
        if(recorder&&recorder.state==='recording'){try{recorder.stop();}catch(_){}}
        if(error&&error.name==='AbortError'){status('Cancelled');$('kmaFoot').textContent='Motion artwork export cancelled.';}
        else{status('Export failed');$('kmaFoot').textContent=error.message||'The export could not be completed.';}
      }finally{
        if(timeoutId)clearTimeout(timeoutId);
        if(stream)stream.getTracks().forEach(t=>{try{t.stop();}catch(_){}});
        activeAbort=null;
        exporting=false;
        $('kmaExport').disabled=!loaded;
        $('kmaCancel').hidden=true;
      }
    });
    setAspect();
    syncPreviewLoop();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
