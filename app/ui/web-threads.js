/* KEFE — Web Threads landing background */
(() => {
  'use strict';
  const D={color1:'#3e326d',color2:'#1d0d85',color3:'#0a0c24',speed:.1,threadCount:3,frequency:4,spread:.08,taper:2.55,fanMode:'right',thickness:3,brightness:.5,opacity:1,mirror:true,mouseInteraction:true,mouseStrength:1};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const rgb=h=>{h=String(h).replace('#','');if(h.length===3)h=h.split('').map(x=>x+x).join('');const n=parseInt(h,16);return[(n>>16)&255,(n>>8)&255,n&255]};
  function create(options={}){const s={...D,...options},c=document.createElement('canvas');c.className='kefe-web-threads';c.setAttribute('aria-hidden','true');const x=c.getContext('2d');let w=1,h=1,d=1,raf=0,run=true,start=performance.now(),mx=.5,my=.5,tx=.5,ty=.5;
    const resize=()=>{const r=c.getBoundingClientRect();w=Math.max(1,Math.round(r.width));h=Math.max(1,Math.round(r.height));d=Math.min(devicePixelRatio||1,1.5);c.width=Math.max(1,Math.round(w*d));c.height=Math.max(1,Math.round(h*d));x.setTransform(d,0,0,d,0,0)};
    const move=e=>{if(!s.mouseInteraction)return;const r=c.getBoundingClientRect();if(!r.width||!r.height)return;tx=clamp((e.clientX-r.left)/r.width,0,1);ty=clamp((e.clientY-r.top)/r.height,0,1)};
    const draw=now=>{if(!run)return;const t=(now-start)/1000*s.speed;mx+=(tx-mx)*.045*s.mouseStrength;my+=(ty-my)*.045*s.mouseStrength;x.clearRect(0,0,w,h);const g=x.createLinearGradient(0,0,w,h);g.addColorStop(0,`rgb(${a})`);g.addColorStop(.52,`rgb(${b})`);g.addColorStop(1,`rgb(${z})`);x.strokeStyle=g;x.lineCap='round';const base=s.fanMode==='left'?w*.72:w*.28,dir=s.fanMode==='left'?-1:1,count=Math.max(1,s.threadCount);for(let j=0;j<count;j++){const q=count===1?.5:j/(count-1);x.beginPath();for(let i=0;i<=90;i++){const p=i/90,y=h*(.04+p*.96),fan=p**s.taper*w*s.spread*(q-.5)*dir,wave=Math.sin(p*s.frequency*3.2+t*(1+j*.08)+q*5.4)*w*.018*(1-p*.45),mouse=(mx-.5)*w*.08*s.mouseStrength*(1-p)+(my-.5)*h*.025*(1-p),px=base+fan+wave+mouse;i?x.lineTo(px,y):x.moveTo(px,y)}x.lineWidth=s.thickness;x.globalAlpha=clamp(s.brightness*(.55+.45*Math.sin(Math.PI*q)),0,1);x.stroke();if(s.mirror){x.save();x.translate(w,0);x.scale(-1,1);x.stroke();x.restore()}}x.globalAlpha=1;raf=requestAnimationFrame(draw)};
    const a=rgb(s.color1),b=rgb(s.color2),z=rgb(s.color3);
    resize();const ro='ResizeObserver'in window?new ResizeObserver(resize):null;ro?.observe(c);window.addEventListener('resize',resize,{passive:true});window.addEventListener('pointermove',move,{passive:true});raf=requestAnimationFrame(draw);
    return{canvas:c,refresh:resize,start(){if(!run){run=true;start=performance.now();raf=requestAnimationFrame(draw)}},stop(){run=false;cancelAnimationFrame(raf)},destroy(){run=false;cancelAnimationFrame(raf);ro?.disconnect();window.removeEventListener('resize',resize);window.removeEventListener('pointermove',move);c.remove()}};
  }
  window.KefeWebThreads={create,defaults:{...D}};
})();
