/* KEFE Visual FX — Waves (perlin-noise line field) background port.
   Native Canvas2D implementation, time-driven (no live-mouse dependency so it renders
   identically in preview and export), following the aurora-fx.js pattern. */
(() => {
  'use strict';
  class Grad{constructor(x,y,z){this.x=x;this.y=y;this.z=z;}dot2(x,y){return this.x*x+this.y*y;}}
  class Noise{
    constructor(seed=0){
      this.grad3=[new Grad(1,1,0),new Grad(-1,1,0),new Grad(1,-1,0),new Grad(-1,-1,0),new Grad(1,0,1),new Grad(-1,0,1),new Grad(1,0,-1),new Grad(-1,0,-1),new Grad(0,1,1),new Grad(0,-1,1),new Grad(0,1,-1),new Grad(0,-1,-1)];
      this.p=[151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
      this.perm=new Array(512);this.gradP=new Array(512);this.seed(seed);
    }
    seed(seed){if(seed>0&&seed<1)seed*=65536;seed=Math.floor(seed);if(seed<256)seed|=seed<<8;for(let i=0;i<256;i++){const v=i&1?this.p[i]^(seed&255):this.p[i]^((seed>>8)&255);this.perm[i]=this.perm[i+256]=v;this.gradP[i]=this.gradP[i+256]=this.grad3[v%12];}}
    fade(t){return t*t*t*(t*(t*6-15)+10);}
    lerp(a,b,t){return(1-t)*a+t*b;}
    perlin2(x,y){let X=Math.floor(x),Y=Math.floor(y);x-=X;y-=Y;X&=255;Y&=255;const n00=this.gradP[X+this.perm[Y]].dot2(x,y),n01=this.gradP[X+this.perm[Y+1]].dot2(x,y-1),n10=this.gradP[X+1+this.perm[Y]].dot2(x-1,y),n11=this.gradP[X+1+this.perm[Y+1]].dot2(x-1,y-1);const u=this.fade(x);return this.lerp(this.lerp(n00,n10,u),this.lerp(n01,n11,u),this.fade(y));}
  }
  const defaults={lineColor:'#ffffff',waveSpeedX:.0125,waveSpeedY:.005,waveAmpX:32,waveAmpY:16,xGap:10,yGap:32,intensity:1};
  const noise=new Noise(7);
  let canvas=null,ctx=null,width=1,height=1,lines=null,lastKey='';
  const resize=(w,h)=>{width=Math.max(1,w|0);height=Math.max(1,h|0);if(!canvas){canvas=document.createElement('canvas');canvas.className='kefe-waves-fx';ctx=canvas.getContext('2d');}canvas.width=width;canvas.height=height;};
  const buildLines=(xGap,yGap)=>{lines=[];const oWidth=width+200,oHeight=height+30;const totalLines=Math.ceil(oWidth/xGap),totalPoints=Math.ceil(oHeight/yGap);const xStart=(width-xGap*totalLines)/2,yStart=(height-yGap*totalPoints)/2;for(let i=0;i<=totalLines;i++){const pts=[];for(let j=0;j<=totalPoints;j++)pts.push({x:xStart+xGap*i,y:yStart+yGap*j});lines.push(pts);}};
  const renderWaves=(time,settings)=>{
    if(!canvas)return null;
    const s={...defaults,...settings};
    const key=s.xGap+':'+s.yGap+':'+width+':'+height;
    if(key!==lastKey){buildLines(s.xGap,s.yGap);lastKey=key;}
    if(!lines)return null;
    const t=time*1000;
    ctx.clearRect(0,0,width,height);
    ctx.beginPath();
    ctx.strokeStyle=s.lineColor;
    lines.forEach(points=>{
      let prev=points[0];
      let move=noise.perlin2((prev.x+t*s.waveSpeedX)*0.002,(prev.y+t*s.waveSpeedY)*0.0015)*12;
      let px=Math.round((prev.x+Math.cos(move)*s.waveAmpX)*10)/10,py=Math.round((prev.y+Math.sin(move)*s.waveAmpY)*10)/10;
      ctx.moveTo(px,py);
      for(let idx=0;idx<points.length;idx++){
        const p=points[idx];
        move=noise.perlin2((p.x+t*s.waveSpeedX)*0.002,(p.y+t*s.waveSpeedY)*0.0015)*12;
        const wx=Math.cos(move)*s.waveAmpX,wy=Math.sin(move)*s.waveAmpY;
        px=Math.round((p.x+wx)*10)/10;py=Math.round((p.y+wy)*10)/10;
        ctx.lineTo(px,py);
      }
    });
    ctx.stroke();
    return canvas;
  };
  function addButton(){const buttons=document.querySelector('.kefe-fx-button')?.parentElement;if(!buttons||buttons.querySelector('[data-fx="waves"]'))return;const b=document.createElement('button');b.type='button';b.dataset.fx='waves';b.className='kefe-fx-button';b.textContent='Waves';b.addEventListener('click',()=>{window.state.style.visualFx='waves';document.querySelectorAll('.kefe-fx-button').forEach(x=>x.classList.toggle('active-effect',x.dataset.fx==='waves'));const l=document.getElementById('visualFxLabel');if(l)l.textContent='Waves — animated line-noise field';window.redrawCurrentPreviewFrame?.();});buttons.appendChild(b);}
  function boot(){if(!window.state||typeof window.render!=='function')return;addButton();const previous=window.render;if(previous.__kefeWaves)return;const wrapped=function(ctx2,w,h,state,media){previous(ctx2,w,h,state,media);if(state?.style?.visualFx!=='waves')return;resize(w,h);const s={...defaults,lineColor:state.style.wavesLineColor||defaults.lineColor,waveSpeedX:Number(state.style.wavesSpeedX)||defaults.waveSpeedX,waveSpeedY:Number(state.style.wavesSpeedY)||defaults.waveSpeedY,waveAmpX:Number(state.style.wavesAmpX)||defaults.waveAmpX,waveAmpY:Number(state.style.wavesAmpY)||defaults.waveAmpY,xGap:Number(state.style.wavesXGap)||defaults.xGap,yGap:Number(state.style.wavesYGap)||defaults.yGap,intensity:Number(state.style.wavesIntensity)||defaults.intensity};const c=renderWaves(Number(state.playback?.currentTime)||0,s);if(!c)return;ctx2.save();ctx2.globalAlpha=Math.max(0,Math.min(1,s.intensity));ctx2.drawImage(c,0,0,w,h);ctx2.restore();};wrapped.__kefeWaves=true;window.render=wrapped;const observer=new MutationObserver(addButton);observer.observe(document.body,{childList:true,subtree:true});window.KefeWavesFX={defaults,render:renderWaves,canvas:()=>canvas};}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
