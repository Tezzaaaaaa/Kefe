/* KEFE Disco Ball — audio-reactive mirror sphere visualiser. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const clamp = (v, a=0, b=1) => Math.max(a, Math.min(b, v));
  let stage, canvas, ctx, tab, view, power, active=false, enabled=true, raf=0, last=0, t=0;
  let bins=null, bass=0, mids=0, highs=0, energy=0, smooth=0;
  const reduced = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function el(tag, cls, txt) {
    const n=document.createElement(tag);
    if(cls)n.className=cls;
    if(txt!==undefined)n.textContent=txt;
    return n;
  }
  function resize(){
    if(!canvas||!stage)return;
    const r=stage.getBoundingClientRect(), dpr=Math.min(window.devicePixelRatio||1,2);
    const w=Math.max(2,Math.round(r.width*dpr)),h=Math.max(2,Math.round(r.height*dpr));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    canvas.style.width=r.width+'px';canvas.style.height=r.height+'px';
  }
  function analyse(dt){
    const a=window.kefeAudioGraph?.analyser?.();
    if(a){
      if(!bins||bins.length!==a.frequencyBinCount)bins=new Uint8Array(a.frequencyBinCount);
      a.getByteFrequencyData(bins);
      const hz=(a.context?.sampleRate||44100)/(a.fftSize||2048);
      const band=(lo,hi)=>{let sum=0,n=0;for(let i=Math.max(1,Math.floor(lo/hz));i<Math.min(bins.length,Math.ceil(hi/hz));i++){sum+=bins[i]/255;n++;}return n?sum/n:0;};
      bass=band(35,150);mids=band(180,2200);highs=band(2400,9000);
      energy=clamp(bass*.52+mids*.32+highs*.16);
    }else{
      bass=.24+.18*Math.sin(t*2.4);mids=.22+.16*Math.sin(t*1.7+1);highs=.16+.13*Math.sin(t*3.1+2);
      energy=clamp(bass*.52+mids*.32+highs*.16);
    }
    smooth+=(energy-smooth)*(1-Math.exp(-dt*5));
  }
  function spherePoint(u,v,cx,cy,r,rot){
    const lon=(u-.5)*Math.PI*2+rot, lat=(v-.5)*Math.PI;
    const cl=Math.cos(lat), x=cl*Math.sin(lon), y=Math.sin(lat), z=cl*Math.cos(lon);
    return {x:cx+x*r,y:cy+y*r,z,nx:x,ny:y};
  }
  function paint(now){
    raf=0;
    if(!active||!enabled||document.hidden){schedule();return;}
    const dt=Math.min(.05,Math.max(0,(now-(last||now))/1000));last=now;t+=dt;analyse(dt);
    const w=canvas.width,h=canvas.height,dpr=Math.min(window.devicePixelRatio||1,2);
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,w,h);
    const unit=Math.min(w,h),cx=w*.5,cy=h*.5,r=unit*.405*(1+smooth*.012);
    const rot=reduced?t*.025:t*(.11+bass*.22);
    // Dark stage and faint optical streaks around the mirrored sphere.
    const halo=ctx.createRadialGradient(cx,cy,r*.35,cx,cy,r*1.45);
    halo.addColorStop(0,'rgba(48,33,115,0.18)');halo.addColorStop(.68,'rgba(37,23,99,0.10)');halo.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=halo;ctx.fillRect(0,0,w,h);
    ctx.save();ctx.globalCompositeOperation='screen';
    for(let i=0;i<42;i++){
      const a=i*2.39996+t*.018, len=r*(1.06+(i%5)*.1), x=cx+Math.cos(a)*r*.91,y=cy+Math.sin(a)*r*.91;
      ctx.strokeStyle='rgba(109,111,255,'+(.025+(i%4)*.012)+')';ctx.lineWidth=Math.max(1,dpr*.6);
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(cx+Math.cos(a)*len,cy+Math.sin(a)*len);ctx.stroke();
    }
    ctx.restore();
    ctx.save();ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.clip();
    const bg=ctx.createRadialGradient(cx-r*.25,cy-r*.35,r*.02,cx,cy,r*1.2);
    bg.addColorStop(0,'#24245f');bg.addColorStop(.52,'#11142f');bg.addColorStop(1,'#02030a');ctx.fillStyle=bg;ctx.fillRect(cx-r,cy-r,r*2,r*2);
    // Project each mirror tile from a true sphere surface. Curved latitude bands and
    // longitude spacing create the round silhouette instead of a flat square grid.
    const cols=32, rows=24;
    for(let row=0;row<rows;row++){
      for(let col=0;col<cols;col++){
        const u0=col/cols,u1=(col+1)/cols,v0=row/rows,v1=(row+1)/rows;
        const u=(u0+u1)*.5,v=(v0+v1)*.5;
        const p=spherePoint(u,v,cx,cy,r,rot);
        if(p.z<.015)continue;
        const corners=[
          spherePoint(u0+.002,v0+.002,cx,cy,r,rot),
          spherePoint(u1-.002,v0+.002,cx,cy,r,rot),
          spherePoint(u1-.002,v1-.002,cx,cy,r,rot),
          spherePoint(u0+.002,v1-.002,cx,cy,r,rot)
        ];
        const lat=(v-.5)*Math.PI,lon=(u-.5)*Math.PI*2+rot;
        const vis=Math.pow(clamp(p.z),.42);
        const light=Math.max(0,Math.sin(lon*2.3+t*.22)*Math.cos(lat*2.8-t*.16));
        const beat=Math.max(0,Math.sin(t*2.5+col*.9+row*.48));
        // Two large, soft studio sources are reflected across the tile field.
        const spot1=Math.exp(-(((p.x-cx+r*.30)/(r*.24))**2+((p.y-cy+r*.22)/(r*.31))**2));
        const spot2=Math.exp(-(((p.x-cx-r*.35)/(r*.20))**2+((p.y-cy+r*.27)/(r*.27))**2));
        const sparkle=clamp((beat*highs*.7+(spot1+spot2)*.38)*vis);
        const purple=clamp(.34+light*.34+mids*.12+Math.sin(col*.85+row*.3+t*.55)*.08);
        const blue=clamp(.48+Math.cos(col*.48-row*.38-t*.27)*.2+bass*.16);
        const white=clamp(Math.max(spot1,spot2)*1.15*(.68+highs*.55)+beat*.16*highs);
        const rr=Math.round((18+purple*64+white*215)*vis);
        const gg=Math.round((13+blue*30+white*220)*vis);
        const bb=Math.round((48+blue*142+purple*88+white*205)*vis);
        const cxTile=corners.reduce((s,q)=>s+q.x,0)/4,cyTile=corners.reduce((s,q)=>s+q.y,0)/4;
        // Tiny dark offset beneath each facet gives the ball depth and distinct grout.
        ctx.beginPath();
        corners.forEach((q,i)=>{const x=q.x+1.2*dpr,y=q.y+1.5*dpr;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});
        ctx.closePath();ctx.fillStyle='rgba(0,0,0,'+(.42+(1-vis)*.22)+')';ctx.fill();
        ctx.beginPath();
        corners.forEach((q,i)=>{i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);});
        ctx.closePath();
        ctx.fillStyle='rgb('+rr+','+gg+','+bb+')';ctx.fill();
        // Directional reflected light follows each projected facet, not a flat grid.
        const q0=corners[0],q2=corners[2];
        const sg=ctx.createLinearGradient(q0.x,q0.y,q2.x,q2.y);
        sg.addColorStop(0,'rgba(255,255,255,'+clamp(.05+white*.72+spot1*.3)+')');
        sg.addColorStop(.32,'rgba(207,202,255,'+clamp(.025+light*.17+sparkle*.15)+')');
        sg.addColorStop(1,'rgba(65,70,180,'+clamp(.04+(1-vis)*.22)+')');
        ctx.fillStyle=sg;ctx.fill();
        ctx.strokeStyle='rgba(3,4,15,'+(.74+(1-vis)*.16)+')';
        ctx.lineWidth=Math.max(.65*dpr,.75);ctx.stroke();
        // Sparse pinprick glints make the mirror finish catch the beat.
        if(sparkle>.25&&((col*7+row*11)%5===0)){
          const size=(.7+sparkle*2.2)*dpr;
          const gl=ctx.createRadialGradient(cxTile,cyTile,0,cxTile,cyTile,size*2.8);
          gl.addColorStop(0,'rgba(255,255,255,'+clamp(sparkle*.95)+')');
          gl.addColorStop(1,'rgba(190,165,255,0)');
          ctx.fillStyle=gl;ctx.fillRect(cxTile-size*3,cyTile-size*3,size*6,size*6);
        }
        if(((col*7+row*11)%71===0)&&p.z>.15){
          ctx.fillStyle='rgba(255,48,148,'+(.3+bass*.5)+')';
          ctx.beginPath();ctx.arc(cxTile,cyTile,Math.max(1.1*dpr,2.1*dpr),0,Math.PI*2);ctx.fill();
        }
      }
    }
    // Bright rectangular specular reflections, softly feathered at their edges.
    [[-.34,-.16,.2,.18],[.34,-.19,.18,.16]].forEach(([ox,oy,sw,sh],i)=>{
      const gx=cx+ox*r+Math.sin(t*.3+i)*r*.025,gy=cy+oy*r;
      const gl=ctx.createRadialGradient(gx,gy,1,gx,gy,r*sw*1.6);
      gl.addColorStop(0,'rgba(255,255,255,'+(.5+highs*.42)+')');gl.addColorStop(.28,'rgba(242,233,255,.72)');gl.addColorStop(1,'rgba(180,150,255,0)');
      ctx.fillStyle=gl;ctx.fillRect(gx-r*sw*1.7,gy-r*sh*1.7,r*sw*3.4,r*sh*3.4);
      ctx.fillStyle='rgba(255,255,255,'+(.72+highs*.25)+')';
      const cw=r*sw/4,ch=r*sh/4;
      for(let yy=0;yy<4;yy++)for(let xx=0;xx<4;xx++)if((xx+yy+i)%4!==0)ctx.fillRect(gx-r*sw/2+xx*cw,gy-r*sh/2+yy*ch,cw*.91,ch*.91);
    });
    // Sphere vignette and cool rim.
    const vignette=ctx.createRadialGradient(cx-r*.12,cy-r*.2,r*.52,cx,cy,r*1.03);
    vignette.addColorStop(0,'rgba(0,0,0,0)');vignette.addColorStop(.72,'rgba(0,0,12,.08)');vignette.addColorStop(1,'rgba(0,0,0,.85)');
    ctx.fillStyle=vignette;ctx.fillRect(cx-r,cy-r,r*2,r*2);
    ctx.restore();
    ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.strokeStyle='rgba(157,149,255,'+(.38+smooth*.4)+')';ctx.lineWidth=1.4*dpr;ctx.stroke();
    schedule();
  }
  function schedule(){if(!raf&&active&&!document.hidden)raf=requestAnimationFrame(paint);}
  function activate(){
    active=true;enabled=true;view.hidden=false;canvas.style.visibility='visible';
    document.querySelectorAll('.kefe-vis-tabs [role="tab"]').forEach(b=>{const selected=b===tab;b.classList.toggle('primary',selected);b.setAttribute('aria-selected',String(selected));});
    ['kefeVisGradientView','kefeVisFlutedView','kefeVisSlowLightView','kefeVisHowBadView'].forEach(id=>{const n=$(id);if(n)n.hidden=true;});
    const powerSlot=$('kefeVisualiserPowerSlot');
    if(powerSlot)powerSlot.replaceChildren(power);
    const heading=$('kefeVisualiserHeading'),description=$('kefeVisualiserDescription');
    if(heading)heading.textContent='Disco Ball';
    if(description)description.textContent='Audio-reactive mirror tiles and prismatic reflections';
    ['kefeGradientPresetSet','kefeFlutedPresetSet'].forEach(id=>{const n=$(id);if(n)n.hidden=true;});
    const presetRow=$('kefeVisualiserPresetRow');if(presetRow)presetRow.hidden=true;
    window.kefeFlutedGlassActive=false;window.kefeDiscoBallActive=true;
    resize();schedule();
  }
  function deactivate(){active=false;view.hidden=true;canvas.style.visibility='hidden';tab.classList.remove('primary');tab.setAttribute('aria-selected','false');window.kefeDiscoBallActive=false;}
  function init(){
    stage=document.querySelector('.kefe-stage');const tabs=document.querySelector('.kefe-vis-tabs'),form=document.querySelector('.kefe-visualiser-form');
    if(!stage||!tabs||!form)return;
    canvas=document.createElement('canvas');canvas.id='kefeDiscoBallCanvas';canvas.setAttribute('aria-label','Disco Ball audio visualiser');canvas.style.cssText='position:absolute;inset:0;z-index:2;pointer-events:none;visibility:hidden;';stage.appendChild(canvas);ctx=canvas.getContext('2d',{alpha:true});
    view=el('div','kefe-vis-view');view.id='kefeVisDiscoBallView';view.hidden=true;
    view.appendChild(el('p','kefe-meta','A rotating mirror-ball sphere with beat-responsive reflections, violet-blue tiles and magenta sparkles.'));
    const info=el('p','kefe-meta','Audio input: KEFE shared audio analyser. The visualiser follows the loaded track; without an analyser, it uses a subtle ambient motion fallback.');
    view.appendChild(info);form.appendChild(view);
    tab=el('button','kefe-btn','Disco Ball');tab.type='button';tab.id='kefeDiscoBallTab';tab.dataset.visualiser='disco-ball';tab.dataset.icon='✦';tab.title='Disco Ball visualiser';tab.setAttribute('role','tab');tab.setAttribute('aria-controls',view.id);tab.setAttribute('aria-selected','false');
    const option=el('div','kefe-vis-option');option.appendChild(tab);tabs.appendChild(option);
    power=el('button','kefe-btn kefe-switch','');power.type='button';power.setAttribute('role','switch');power.setAttribute('aria-checked','true');power.setAttribute('aria-label','Disco Ball visualiser');power.title='Disco Ball visualiser';
    const state=el('span','kefe-switch-state','On'),track=el('span','kefe-switch-track'),thumb=el('span','kefe-switch-thumb');track.appendChild(thumb);power.append(state,track);
    power.addEventListener('click',e=>{e.stopPropagation();enabled=!enabled;power.setAttribute('aria-checked',String(enabled));power.classList.toggle('is-on',enabled);state.textContent=enabled?'On':'Off';canvas.style.visibility=active&&enabled?'visible':'hidden';window.kefeDiscoBallEnabled=enabled;if(enabled)schedule();});
    tabs.querySelectorAll('[role="tab"]').forEach(b=>{if(b!==tab)b.addEventListener('click',deactivate);});
    tab.addEventListener('click',activate);
    window.kefeDiscoBallActive=false;window.kefeDiscoBallEnabled=true;
    window.addEventListener('resize',resize);window.addEventListener('kefe-stage-resize',resize);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
    resize();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();