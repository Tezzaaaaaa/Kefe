/* KEFE — Gradient Waves background video visual.
   Native Canvas recreation of the supplied GradientWaves visual.
   Exposed only as a reusable animated background source for the editor. */
(() => {
  'use strict';
  const DEFAULTS={horizonColor:'#370ee1',waveColor:'#000000',crestColor:'#35365b',speed:.15,amplitude:5,waveScale:.3,waveRatio:.85,swell:0,turbulence:60,tilt:1.3,zoom:2.5,height:2,fogDepth:60,detail:'low',brightness:1.25,opacity:.34,mouseInteraction:false,parallaxStrength:0,grain:true,grainIntensity:.03};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const hex=value=>{const h=String(value||'').replace('#',''),n=h.length===3?h.split('').map(x=>x+x).join(''):h,i=parseInt(n,16);if(!Number.isFinite(i))return[1,1,1];return[(i>>16&255)/255,(i>>8&255)/255,(i&255)/255];};
  function createGradientWaves(options={}){
    const s={...DEFAULTS,...options},canvas=document.createElement('canvas');canvas.className='kefe-gradient-waves';canvas.setAttribute('aria-hidden','true');
    const ctx=canvas.getContext('2d',{alpha:true}),horizon=hex(s.horizonColor),wave=hex(s.waveColor),crest=hex(s.crestColor);let raf=0,running=true,width=1,height=1,start=performance.now();
    const renderScale=s.detail==='high'?.55:s.detail==='medium'?.42:.32;
    const resize=()=>{const r=canvas.getBoundingClientRect();width=Math.max(1,Math.round(r.width||canvas.clientWidth||1));height=Math.max(1,Math.round(r.height||canvas.clientHeight||1));const dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.max(1,Math.round(width*renderScale*dpr));canvas.height=Math.max(1,Math.round(height*renderScale*dpr));};
    const draw=now=>{if(!running)return;const w=canvas.width,h=canvas.height,t=(now-start)/1000*s.speed,image=ctx.createImageData(w,h),data=image.data,horizonY=h*(.34+s.waveRatio*.22),zoom=Math.max(.15,s.zoom),scale=Math.max(.04,s.waveScale),amp=s.amplitude*.018,turb=s.turbulence/100,bright=s.brightness,depth=Math.max(1,s.fogDepth),detail=s.detail==='high'?3:s.detail==='medium'?2:1;
      for(let y=0;y<h;y++){const ny=y/h,dy=(y-horizonY)/h;for(let x=0;x<w;x++){const nx=x/w,sx=(nx-.5)*zoom,sy=dy*zoom*s.tilt;let n=Math.sin(sx*8*scale+t*2.1+sy*3.4)+Math.sin(sx*16*scale-t*1.2+sy*6.1)*.48+Math.sin((sx+sy)*25*scale+t*.7)*.2*turb;if(detail>1)n+=Math.sin((sx*43+sy*11)*scale-t*.5)*.09;if(detail>2)n+=Math.sin((sx*71-sy*19)*scale+t*.35)*.045;n/=1.75;const ridge=Math.pow(clamp((n+1)*.5,0,1),1.7),waveMix=clamp(.20+ridge*.72+Math.sin(n*3+t)*amp,0,1),crestMix=Math.pow(clamp((ridge-.62)/.38,0,1),1.25),vertical=clamp((ny-.06)/.94,0,1),fog=clamp(Math.abs(dy)*depth*.006,0,.82);let r=horizon[0]*(1-waveMix)+wave[0]*waveMix,g=horizon[1]*(1-waveMix)+wave[1]*waveMix,b=horizon[2]*(1-waveMix)+wave[2]*waveMix;r=r*(1-crestMix)+crest[0]*crestMix;g=g*(1-crestMix)+crest[1]*crestMix;b=b*(1-crestMix)+crest[2]*crestMix;r=r*(1-fog)+horizon[0]*fog;g=g*(1-fog)+horizon[1]*fog;b=b*(1-fog)+horizon[2]*fog;const glow=(1-vertical)*.16*s.height,grain=s.grain?(Math.sin((x+17)*12.9898+(y+31)*78.233+now*.001)-.5)*s.grainIntensity:0,i=(y*w+x)*4;data[i]=clamp((r+glow+grain)*bright,0,1)*255;data[i+1]=clamp((g+glow+grain)*bright,0,1)*255;data[i+2]=clamp((b+glow+grain)*bright,0,1)*255;data[i+3]=s.opacity*255;}}
      ctx.putImageData(image,0,0);raf=requestAnimationFrame(draw);
    };
    resize();window.addEventListener('resize',resize,{passive:true});raf=requestAnimationFrame(draw);
    return{canvas,start(){if(!running){running=true;start=performance.now();raf=requestAnimationFrame(draw);}},stop(){running=false;cancelAnimationFrame(raf);},destroy(){running=false;cancelAnimationFrame(raf);window.removeEventListener('resize',resize);canvas.remove();}};
  }
  window.KefeGradientWaves={create:createGradientWaves,defaults:{...DEFAULTS}};
})();
