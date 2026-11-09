/* KEFE Motion Artwork — standalone album-cover animation generator. */
(function () {
  'use strict';
  function init() {
    const host = document.querySelector('[data-panel-view="background-effects"] .kefe-form');
    if (!host || document.getElementById('kefeMotionArtwork')) return;
    const root = document.createElement('section');
    root.id = 'kefeMotionArtwork';
    root.className = 'kefe-motion-artwork';
    root.innerHTML = '<div class="kma-head"><div><span class="kma-kicker">ALBUM ART STUDIO</span><h3>Motion Artwork</h3><p>Bring a still cover to life with a seamless cinematic loop.</p></div><span class="kma-status" id="kmaStatus">Ready</span></div>' +
      '<label class="kma-upload" for="kmaImage"><span class="kma-upload-icon" aria-hidden="true">＋</span><span><b id="kmaFileName">Upload album artwork</b><small>JPG, PNG or WebP · square or portrait</small></span><input id="kmaImage" type="file" accept="image/jpeg,image/png,image/webp"></label>' +
      '<div class="kma-preview-wrap"><canvas id="kmaPreview" width="720" height="960" aria-label="Motion artwork preview"></canvas><span class="kma-preview-label">LIVE PREVIEW</span></div>' +
      '<div class="kma-controls">' +
      '<label>Motion style<select id="kmaStyle"><option value="cinematic">Cinematic drift</option><option value="parallax">3D depth</option><option value="light">Light sweep</option><option value="orbit">Floating motion</option></select></label>' +
      '<label>Artwork format<select id="kmaAspect"><option value="portrait">Portrait · 3:4</option><option value="square">Square · 1:1</option></select></label>' +
      '<label class="kma-range">Motion intensity <output id="kmaIntensityValue">55%</output><input id="kmaIntensity" type="range" min="0" max="100" value="55"></label>' +
      '<label class="kma-range">Background softness <output id="kmaSoftnessValue">70%</output><input id="kmaSoftness" type="range" min="0" max="100" value="70"></label>' +
      '<label class="kma-range">Lighting <output id="kmaLightingValue">35%</output><input id="kmaLighting" type="range" min="0" max="100" value="35"></label>' +
      '</div><div class="kma-export-row"><label>Resolution<select id="kmaResolution"><option value="1080">1080p</option><option value="2160">4K</option></select></label><button type="button" id="kmaExport" disabled>Export motion artwork</button></div>' +
      '<p class="kma-foot" id="kmaFoot">Upload a cover to start. The loop begins and ends on the original artwork.</p>';
    const style = document.createElement('style');
    style.textContent = '#kefeMotionArtwork{display:grid;gap:12px;padding:14px;margin-top:16px;border:1px solid var(--border-color,rgba(140,140,150,.22));border-radius:16px;background:var(--bg-secondary,rgba(128,128,128,.06));color:var(--text-primary,inherit)}#kefeMotionArtwork .kma-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}#kefeMotionArtwork .kma-kicker{font-size:10px;letter-spacing:.13em;opacity:.62;font-weight:700}#kefeMotionArtwork h3{font-size:16px;margin:4px 0}#kefeMotionArtwork p{font-size:12px;opacity:.7;margin:0;line-height:1.45}#kefeMotionArtwork .kma-status{font-size:11px;padding:5px 8px;border-radius:20px;background:rgba(128,128,128,.13)}#kefeMotionArtwork .kma-upload{display:flex;align-items:center;gap:10px;padding:12px;border:1px dashed var(--border-color,rgba(140,140,150,.35));border-radius:12px;cursor:pointer}#kefeMotionArtwork .kma-upload-icon{font-size:23px;width:32px;height:32px;display:grid;place-items:center;border-radius:9px;background:rgba(128,128,128,.13)}#kefeMotionArtwork .kma-upload b,#kefeMotionArtwork .kma-upload small{display:block}#kefeMotionArtwork .kma-upload b{font-size:12px}#kefeMotionArtwork .kma-upload small{font-size:10px;opacity:.65;margin-top:3px}#kefeMotionArtwork input[type=file]{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}#kefeMotionArtwork .kma-preview-wrap{position:relative;overflow:hidden;border-radius:12px;background:#101114;max-width:360px;width:100%;margin:auto;aspect-ratio:3/4}#kefeMotionArtwork .kma-preview-wrap:has(canvas[data-square=true]){aspect-ratio:1}#kefeMotionArtwork canvas{width:100%;height:100%;display:block}#kefeMotionArtwork .kma-preview-label{position:absolute;top:9px;left:9px;font-size:9px;letter-spacing:.12em;padding:5px 7px;border-radius:5px;background:rgba(0,0,0,.48);color:white}#kefeMotionArtwork .kma-controls{display:grid;grid-template-columns:1fr 1fr;gap:10px}#kefeMotionArtwork .kma-controls>label,#kefeMotionArtwork .kma-export-row>label{display:grid;gap:6px;font-size:11px;font-weight:600}#kefeMotionArtwork select{min-width:0;width:100%;padding:9px;border:1px solid var(--border-color,rgba(140,140,150,.25));border-radius:9px;background:var(--input-bg,var(--bg-primary,#171719));color:var(--text-primary,inherit);font:inherit;font-size:12px}#kefeMotionArtwork .kma-range{grid-column:1/-1;grid-template-columns:1fr auto;align-items:center}#kefeMotionArtwork output{font-variant-numeric:tabular-nums;opacity:.7}#kefeMotionArtwork input[type=range]{grid-column:1/-1;width:100%;accent-color:var(--accent-color,#8b8bff)}#kefeMotionArtwork .kma-export-row{display:flex;gap:10px;align-items:end}#kefeMotionArtwork .kma-export-row>label{width:112px}#kefeMotionArtwork #kmaExport{flex:1;min-height:38px;border:0;border-radius:10px;background:var(--accent-color,#7777e8);color:white;font-weight:700;font-size:12px;cursor:pointer}#kefeMotionArtwork #kmaExport:disabled{opacity:.4;cursor:not-allowed}#kefeMotionArtwork #kmaExport:disabled{opacity:.45}#kefeMotionArtwork .kma-foot{min-height:18px}@media(max-width:520px){#kefeMotionArtwork{padding:11px}#kefeMotionArtwork .kma-preview-wrap{max-width:100%}}';
    document.head.appendChild(style);
    host.appendChild(root);
    const $ = id => root.querySelector('#' + id);
    const canvas = $('kmaPreview'), ctx = canvas.getContext('2d');
    const image = new Image();
    let loaded = false, start = performance.now(), raf = 0, exporting = false;
    const values = () => ({style:$('kmaStyle').value,intensity:Number($('kmaIntensity').value)/100,softness:Number($('kmaSoftness').value)/100,lighting:Number($('kmaLighting').value)/100});
    function setAspect() {
      const square = $('kmaAspect').value === 'square';
      canvas.width = square ? 960 : 720; canvas.height = 960;
      canvas.dataset.square = String(square);
      $('kmaPreview').parentElement.style.aspectRatio = square ? '1' : '3 / 4';
    }
    function draw(target, w, h, seconds) {
      const c = target, v = values(), phase = (seconds % 8) / 8 * Math.PI * 2;
      c.save(); c.clearRect(0,0,w,h); c.fillStyle='#101114'; c.fillRect(0,0,w,h);
      if (!loaded) { c.restore(); return; }
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
      if(v.style==='parallax'){x+=Math.sin(phase)*w*.025*move;y+=Math.cos(phase*.7)*h*.02*move;}
      if(v.style==='orbit'){x+=Math.sin(phase)*w*.035*move;y+=Math.cos(phase)*h*.025*move;scale*=1+Math.sin(phase)*.012*move;}
      const fw=iw*scale,fh=ih*scale;
      c.save();c.translate(x,y);c.rotate(v.style==='orbit'?Math.sin(phase)*.012*move:Math.sin(phase)*.003*move);
      c.shadowColor='rgba(0,0,0,.48)';c.shadowBlur=Math.min(w,h)*.035;c.shadowOffsetY=Math.min(w,h)*.012;
      c.filter='saturate(1.02)';c.drawImage(image,-fw/2,-fh/2,fw,fh);c.restore();
      if(v.style==='light'&&v.lighting>0){const sweep=((seconds%8)/8)*1.8-.4;c.save();c.globalCompositeOperation='screen';const g=c.createLinearGradient(w*sweep,0,w*(sweep+.32),h);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.5,'rgba(255,255,255,'+(.22*v.lighting)+')');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,0,w,h);c.restore();}
      if(v.lighting>0){const g=c.createRadialGradient(w*.5,h*.42,0,w*.5,h*.42,Math.max(w,h)*.78);g.addColorStop(0,'rgba(255,255,255,'+(v.lighting*.055)+')');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,0,w,h);}
      const shade=c.createLinearGradient(0,0,0,h);shade.addColorStop(0,'rgba(0,0,0,.08)');shade.addColorStop(1,'rgba(0,0,0,.2)');c.fillStyle=shade;c.fillRect(0,0,w,h);
      c.restore();
    }
    function frame(now){draw(ctx,canvas.width,canvas.height,(now-start)/1000);raf=requestAnimationFrame(frame);}
    function status(text){$('kmaStatus').textContent=text;}
    $('kmaImage').addEventListener('change',()=>{
      const file=$('kmaImage').files&&$('kmaImage').files[0];if(!file)return;
      if(!/^image\/(jpeg|png|webp)$/.test(file.type)){ $('kmaFoot').textContent='Choose a JPG, PNG or WebP image.';return; }
      const url=URL.createObjectURL(file);
      image.onload=()=>{loaded=true;URL.revokeObjectURL(url);$('kmaFileName').textContent=file.name;$('kmaExport').disabled=false;status('Artwork loaded');$('kmaFoot').textContent='Preview loops continuously. Export captures an 8-second seamless motion cycle.';};
      image.onerror=()=>{URL.revokeObjectURL(url);$('kmaFoot').textContent='This image could not be opened.';};image.src=url;
    });
    ['kmaStyle','kmaAspect'].forEach(id=>$(id).addEventListener('change',()=>{if(id==='kmaAspect')setAspect();}));
    ['kmaIntensity','kmaSoftness','kmaLighting'].forEach(id=>$(id).addEventListener('input',()=>{$(id+'Value').textContent=$(id).value+'%';}));
    $('kmaExport').addEventListener('click',async()=>{
      if(!loaded||exporting)return;
      if(!HTMLCanvasElement.prototype.captureStream||!window.MediaRecorder){$('kmaFoot').textContent='Video export is not supported in this browser.';return;}
      exporting=true;$('kmaExport').disabled=true;status('Rendering');$('kmaFoot').textContent='Rendering an 8-second loop. Keep this tab open.';
      const oldW=canvas.width,oldH=canvas.height,oldStart=start;
      const square=$('kmaAspect').value==='square',long=Number($('kmaResolution').value),w=square?long:Math.round(long*3/4),h=long;
      const out=document.createElement('canvas');out.width=w;out.height=h;
      const outCtx=out.getContext('2d');const stream=out.captureStream(30);
      const types=['video/mp4;codecs=avc1.640028','video/mp4;codecs=avc1','video/mp4','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'];
      const mime=types.find(t=>MediaRecorder.isTypeSupported(t));
      if(!mime){stream.getTracks().forEach(t=>t.stop());exporting=false;$('kmaExport').disabled=false;status('Ready');$('kmaFoot').textContent='This browser does not expose a supported video encoder.';return;}
      const chunks=[];let recorder;
      try{
        recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:long>=2160?32000000:12000000});
        recorder.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data);};
        const stopped=new Promise((resolve,reject)=>{recorder.onstop=resolve;recorder.onerror=()=>reject(new Error('Video encoding failed'));});
        const renderStart=performance.now();
        const drawExport=()=>draw(outCtx,w,h,(performance.now()-renderStart)/1000);
        recorder.start(250);
        const tick=setInterval(drawExport,1000/30);
        await new Promise(resolve=>setTimeout(resolve,8000));
        clearInterval(tick);drawExport();recorder.stop();await stopped;
        const blob=new Blob(chunks,{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');
        const ext=mime.startsWith('video/mp4')?'mp4':'webm';
        a.href=url;a.download='KEFE-Motion-Artwork.'+ext;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);
        status('Export complete');$('kmaFoot').textContent='Exported '+w+' × '+h+' '+ext.toUpperCase()+'.';
      }catch(error){status('Export failed');$('kmaFoot').textContent=error.message||'The export could not be completed.';}
      finally{stream.getTracks().forEach(t=>t.stop());canvas.width=oldW;canvas.height=oldH;start=oldStart;exporting=false;$('kmaExport').disabled=false;}
    });
    setAspect();raf=requestAnimationFrame(frame);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();