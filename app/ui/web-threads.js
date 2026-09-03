/* KEFE — Web Threads
   Native canvas adaptation of the supplied WebThreads visual. */
(() => {
  'use strict';

  const DEFAULTS = {
    color1: '#3e326d', color2: '#1d0d85', color3: '#0a0c24', speed: 0.1,
    threadCount: 3, frequency: 4, spread: 0.08, taper: 2.55, position: 0,
    fanMode: 'right', glow: 0.003, falloff: 1.2, thickness: 3, brightness: 0.5,
    opacity: 1, mirror: true, shimmer: false, grain: true, grainIntensity: 0,
    mouseInteraction: true, mouseStrength: 1
  };

  const clamp = (v,a,b) => Math.max(a, Math.min(b,v));
  const rgb = hex => { const h=String(hex).replace('#',''); const n=h.length===3?h.split('').map(x=>x+x).join(''):h; const i=parseInt(n,16); return [(i>>16&255)/255,(i>>8&255)/255,(i&255)/255]; };

  function createWebThreads(options={}) {
    const s={...DEFAULTS,...options};
    const canvas=document.createElement('canvas'); canvas.className='kefe-web-threads'; canvas.setAttribute('aria-hidden','true');
    const ctx=canvas.getContext('2d',{alpha:true}); const c1=rgb(s.color1),c2=rgb(s.color2),c3=rgb(s.color3);
    let w=1,h=1,dpr=1,raf=0,running=true,start=performance.now(),mx=.5,my=.5,tmx=.5,tmy=.5;
    const resize=()=>{const r=canvas.getBoundingClientRect();w=Math.max(1,Math.round(r.width));h=Math.max(1,Math.round(r.height));dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);};
    const move=e=>{if(!s.mouseInteraction)return;const r=canvas.getBoundingClientRect();tmx=clamp((e.clientX-r.left)/r.width,0,1);tmy=clamp((e.clientY-r.top)/r.height,0,1);};
    const draw=now=>{if(!running)return;const t=(now-start)/1000*s.speed;mx+=(tmx-mx)*.045*s.mouseStrength;my+=(tmy-my)*.045*s.mouseStrength;ctx.clearRect(0,0,w,h);const grad=ctx.createLinearGradient(0,0,w,h);grad.addColorStop(0,`rgba(${c1[0]*255},${c1[1]*255},${c1[2]*255},${s.opacity})`);grad.addColorStop(.52,`rgba(${c2[0]*255},${c2[1]*255},${c2[2]*255},${s.opacity})`);grad.addColorStop(1,`rgba(${c3[0]*255},${c3[1]*255},${c3[2]*255},${s.opacity})`);ctx.strokeStyle=grad;ctx.lineCap='round';
      const baseX=s.fanMode==='left'?w*.72:w*.28; const dir=s.fanMode==='left'?-1:1; const count=Math.max(1,s.threadCount); for(let j=0;j<count;j++){const q=count===1?.5:j/(count-1);ctx.beginPath();for(let i=0;i<=80;i++){const p=i/80;const y=h*(.08+p*.92);const fan=(p**s.taper)*w*s.spread*(q-.5)*dir;const wave=Math.sin(p*s.frequency*3.2+t*(1+j*.08)+q*5.4)*w*.018*(1-p*.45);const mouse=(mx-.5)*w*.08*s.mouseStrength*(1-p);const x=baseX+fan+wave+mouse; i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.lineWidth=s.thickness*(1+.35*Math.sin(t+j));ctx.globalAlpha=clamp(s.brightness*(.55+.45*Math.sin(Math.PI*q)),0,1);ctx.stroke();if(s.mirror){ctx.save();ctx.translate(w,0);ctx.scale(-1,1);ctx.stroke();ctx.restore();}}
      ctx.globalAlpha=1;raf=requestAnimationFrame(draw);};
    const onResize=()=>resize(); resize(); canvas.addEventListener('pointermove',move,{passive:true}); window.addEventListener('resize',onResize,{passive:true}); raf=requestAnimationFrame(draw);
    return {canvas,start(){if(!running){running=true;start=performance.now();raf=requestAnimationFrame(draw);}},stop(){running=false;cancelAnimationFrame(raf);},destroy(){running=false;cancelAnimationFrame(raf);canvas.removeEventListener('pointermove',move);window.removeEventListener('resize',onResize);canvas.remove();}};
  }
  window.KefeWebThreads={create:createWebThreads,defaults:{...DEFAULTS}};
})();
