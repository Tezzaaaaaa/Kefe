/* KEFE — four Signature treatments adapted from the supplied standalone reference.
   Renderers use KEFE's song-time canvas contract, so preview and export stay in sync. */
(() => {
  'use strict';
  const U = window.kefeEffectUtils;
  const E = window.kefeEffects = window.kefeEffects || {};
  if (!U) { console.error('[signature-four] effects/core.js is required'); return; }
  const clamp = U.clamp;
  const FONTS = {
    sigfrost: { family: 'Open Sans', weight: 650, lineHeight: .94, tracking: -.055 },
    sigvoid: { family: 'Inter Tight', weight: 800, lineHeight: .92, tracking: -.06 },
    sigscript: { family: 'Homemade Apple', weight: 400, lineHeight: 1.12, tracking: -.025 },
    sigbrat: { family: 'Archivo Narrow', weight: 400, lineHeight: .92, tracking: 0 }
  };
  const setFont = (ctx, key, size) => {
    const c = FONTS[key];
    U.setFont(ctx, c.family, size, c.weight);
    if ('letterSpacing' in ctx) ctx.letterSpacing = (c.tracking || 0) * size + 'px';
  };
  function background(ctx, w, h, key, time) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    if (key === 'sigfrost') {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#d9e2eb'); g.addColorStop(.52, '#899bab'); g.addColorStop(1, '#e2e8ed');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      const glow = ctx.createRadialGradient(w*.18,h*.12,0,w*.18,h*.12,w*.7);
      glow.addColorStop(0,'rgba(255,255,255,.7)'); glow.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
    } else if (key === 'sigvoid') {
      const g=ctx.createRadialGradient(w*.5,h*.46,0,w*.5,h*.46,Math.max(w,h)*.72);
      g.addColorStop(0,'#151b2e');g.addColorStop(.62,'#0a0d16');g.addColorStop(1,'#07090e');
      ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    } else if (key === 'sigscript') {
      const g=ctx.createRadialGradient(w*.5,h*.42,0,w*.5,h*.42,Math.max(w,h)*.8);
      g.addColorStop(0,'#2d3642');g.addColorStop(.58,'#141920');g.addColorStop(1,'#0d1015');
      ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    } else {
      ctx.fillStyle = (window.kefeBratBackground === 'white') ? '#FFFFFF' : '#8ACE00';
      ctx.fillRect(0,0,w,h);
    }
    ctx.restore();
    if (key === 'sigvoid') {
      ctx.save(); ctx.globalAlpha=.55;
      for(let i=0;i<18;i++){
        const x=((i*73.7)%997)/997*w, y=((i*139.3+31)%991)/991*h;
        ctx.fillStyle='rgba(220,229,246,.75)';
        ctx.beginPath();ctx.arc(x,y, i%5===0?1.35:.8,0,Math.PI*2);ctx.fill();
      }
      ctx.restore();
    }
    if (key === 'sigfrost') {
      ctx.save();ctx.globalAlpha=.12;
      const x=((time%8)/8)*w*2-w;
      const g=ctx.createLinearGradient(x-w*.18,0,x+w*.18,h);
      g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.5,'#fff');g.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle=g;ctx.fillRect(0,0,w,h);ctx.restore();
    }
  }
  function drawLine(ctx, w, h, key, item, time) {
    const text = String(item.line.text || '').replace(/\\s+/g,' ').trim();
    if (!text) return;
    const c=FONTS[key], words=U.wordsFor(item.line,item.next);
    const sizeBase=Number(window.KEFE_TYPE?.effects?.[key]?.max)||Math.min(w,h)*.15;
    const lay=U.layoutText(ctx,text,{
      setFont:(target,size)=>setFont(target,key,size),
      size:Math.min(Number(item.line.fontSize)||Number(window.kefeCurrentLyricFontSize)||sizeBase,Math.min(w,h)*.22),
      minSize:18,maxWidth:w*(key==='sigbrat'?.94:.86),maxHeight:h*.54,
      lineHeight:c.lineHeight,maxLines:3,tracking:c.tracking
    });
    setFont(ctx,key,lay.size);
    ctx.save();
    ctx.globalAlpha*=clamp(item.alpha);
    ctx.textAlign='center';ctx.textBaseline='middle';
    const rows=lay.lines, top=(h-lay.blockH)/2+lay.lineH*.5;
    const progress=U.sungProgress(words,time);
    if(key==='sigbrat'){
      ctx.save();ctx.translate(w/2,h/2);ctx.scale(.94,1);ctx.translate(-w/2,-h/2);
      ctx.filter='blur(1.05px)';
      rows.forEach((row,i)=>{
        if(time < (Number(item.line.time)||0))return;
        ctx.fillStyle='#000';ctx.fillText(row.toLowerCase(),w/2,top+i*lay.lineH);
      });
      ctx.restore();
    } else {
      rows.forEach((row,i)=>{
        const y=top+i*lay.lineH, width=ctx.measureText(row).width;
        if(key==='sigfrost'){
          ctx.fillStyle='rgba(23,33,43,.28)';ctx.fillText(row,w/2,y);
          ctx.save();ctx.beginPath();ctx.rect(w/2-width/2-2,y-lay.size*.72,width*progress+4,lay.size*1.45);ctx.clip();
          ctx.fillStyle='#17212b';ctx.shadowColor='rgba(255,255,255,.65)';ctx.shadowBlur=lay.size*.16;ctx.fillText(row,w/2,y);ctx.restore();
        } else if(key==='sigvoid'){
          ctx.lineWidth=Math.max(1.2,lay.size*.018);ctx.strokeStyle='rgba(220,229,246,.3)';ctx.strokeText(row,w/2,y);
          ctx.save();ctx.beginPath();ctx.rect(w/2-width/2-2,y-lay.size*.72,width*progress+4,lay.size*1.45);ctx.clip();
          ctx.strokeStyle='#dce5f6';ctx.shadowColor='rgba(169,199,255,.5)';ctx.shadowBlur=lay.size*.2;ctx.strokeText(row,w/2,y);
          ctx.fillStyle='rgba(169,199,255,.1)';ctx.fillText(row,w/2,y);ctx.restore();
        } else {
          const g=ctx.createLinearGradient(w/2,y-lay.size*.6,w/2,y+lay.size*.55);
          g.addColorStop(0,'#fff8ea');g.addColorStop(.55,'#ecdcc0');g.addColorStop(1,'#c9ae82');
          ctx.save();ctx.globalAlpha*=.3;ctx.fillStyle=g;ctx.fillText(row,w/2,y);ctx.restore();
          ctx.save();ctx.beginPath();ctx.rect(w/2-width/2-2,y-lay.size*.72,width*progress+4,lay.size*1.45);ctx.clip();
          ctx.fillStyle=g;ctx.shadowColor='rgba(0,0,0,.48)';ctx.shadowBlur=lay.size*.18;ctx.fillText(row,w/2,y);ctx.restore();
        }
      });
    }
    ctx.restore();
  }
  ['sigfrost','sigvoid','sigscript','sigbrat'].forEach(key => {
    E[key]=(ctx,w,h,style,lines,time)=>{
      if(!Array.isArray(lines)||!lines.length)return;
      const t=Number(time)||0;
      ctx.save();ctx.textBaseline='middle';ctx.textAlign='center';
      background(ctx,w,h,key,t);
      U.lineStack(lines,t,.26,.24).forEach(item=>drawLine(ctx,w,h,key,item,t));
      ctx.restore();
    };
  });
  function mountBratControl(){
    const gallery=document.getElementById('lyricEffectOptions');
    if(!gallery||document.getElementById('kefeBratBackgroundSelect'))return;
    const host=document.createElement('label');host.className='kefe-text-swap-settings';host.id='kefeBratBackgroundSettings';
    const title=document.createElement('span');title.textContent='Brat background';
    const select=document.createElement('select');select.className='kefe-select';select.id='kefeBratBackgroundSelect';select.setAttribute('aria-label','Brat background');
    [['green','Brat Green'],['white','Pure White']].forEach(([value,label])=>{const option=document.createElement('option');option.value=value;option.textContent=label;select.appendChild(option);});
    let saved='green';try{saved=localStorage.getItem('kefe.brat.background')||saved;}catch(_){}
    window.kefeBratBackground=saved==='white'?'white':'green';select.value=window.kefeBratBackground;
    select.addEventListener('change',()=>{window.kefeBratBackground=select.value==='white'?'white':'green';try{localStorage.setItem('kefe.brat.background',window.kefeBratBackground);}catch(_){}window.kefeLyrics?.redraw?.();});
    host.append(title,select);gallery.insertAdjacentElement('afterend',host);
    const sync=()=>{host.hidden=document.querySelector('.kefe-lyric-effect-option.active')?.dataset.effect!=='sigbrat';};
    window.addEventListener('kefe-effect-change',sync);sync();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountBratControl,{once:true});else mountBratControl();
})();