/* KEFE — Fancy: animated chromatic type with horizontal signal displacement. */
(() => {
  'use strict';
  const u=window.kefeEffectUtils;
  window.kefeEffects=window.kefeEffects||{};
  if(!u){console.error('[lyric-fancy] requires core.js');return;}
  const KEY='kefe.fancy.v1',DEFAULT={speed:1,rgbOffset:7,displacement:12,contrast:115,size:100};
  let S=Object.assign({},DEFAULT);
  try{S=Object.assign(S,JSON.parse(localStorage.getItem(KEY)||'null'));}catch(_){}
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));
  const hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
  const persist=()=>{try{localStorage.setItem(KEY,JSON.stringify(S));}catch(_){}};
  const redraw=()=>{try{window.kefeLyrics?.redraw?.();}catch(_){}};
  function font(ctx,size){ctx.font='900 '+Math.max(12,size)+'px "Anton","Arial Black",system-ui,sans-serif';}
  window.kefeEffects.fancy=function(ctx,w,h,style,lines,time){
    const active=u.activeLine(lines,time);if(!active)return;
    const text=String(active.line.text||'').trim().toUpperCase();if(!text)return;
    const lay=u.layoutText(ctx,text,{setFont:font,size:Math.min(220,(style.fontSize||140)*1.15*S.size/100),minSize:16,maxWidth:w*.84,maxHeight:h*.82,lineHeight:1.05,maxLines:5});
    const progress=u.lineProgress(active.line,time);if(progress.opacity<=.01)return;
    font(ctx,lay.size);ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.globalAlpha=progress.opacity;
    const t=(time-(Number(active.line.time)||0))*S.speed,frame=Math.floor(t*24),offset=Number(S.rgbOffset),disp=Number(S.displacement);
    ctx.filter='contrast('+Number(S.contrast)+'%)';const y0=h*.5-(lay.lines.length-1)*lay.lineH/2;
    lay.lines.forEach((line,li)=>{
      const y=y0+li*lay.lineH,phase=t*30+li*1.7,jitter=Math.sin(phase)*disp*.18;
      ctx.save();ctx.globalCompositeOperation='lighter';ctx.fillStyle='rgba(255,0,30,.9)';ctx.fillText(line,w/2-offset+jitter,y);
      ctx.fillStyle='rgba(0,235,255,.9)';ctx.fillText(line,w/2+offset-jitter,y);ctx.restore();
      ctx.save();ctx.beginPath();ctx.rect(0,y-lay.lineH*.52,w,lay.lineH*1.04);ctx.clip();
      for(let b=0;b<4;b++){const seed=frame*31+li*11+b;if(hash(seed)<=.62)continue;
        const bh=Math.max(1,lay.lineH*(.035+hash(seed+5)*.16)),by=y-lay.lineH/2+hash(seed+7)*lay.lineH,dx=(hash(seed+9)-.5)*disp*2;
        ctx.save();ctx.beginPath();ctx.rect(0,by,w,bh);ctx.clip();ctx.fillStyle=style.textColor||'#fff';ctx.fillText(line,w/2+dx,y);ctx.restore();
      }
      ctx.fillStyle=style.textColor||'#fff';ctx.fillText(line,w/2+jitter*.25,y);ctx.restore();
    });ctx.restore();
  };
  function buildControls(){
    const select=document.getElementById('lyricEffect'),host=select?.closest('.kefe-background-effect-control');
    if(!select||!host||document.getElementById('kefeFancyControls'))return;
    const group=document.createElement('div');group.id='kefeFancyControls';group.className='kefe-randomize-effect-settings';
    const title=document.createElement('div');title.className='kefe-label';title.textContent='Fancy settings';group.appendChild(title);
    const fields=[['Animation speed','speed',.1,3,.05,v=>v.toFixed(2)+'×'],['RGB separation','rgbOffset',0,24,1,v=>v+'px'],['Horizontal displacement','displacement',0,40,1,v=>v+'px'],['Contrast','contrast',50,200,5,v=>v+'%'],['Text size','size',60,150,5,v=>v+'%']];
    const syncers=[];
    fields.forEach(([label,key,min,max,step,fmt])=>{
      const wrap=document.createElement('label');wrap.className='kefe-visualiser-field';const head=document.createElement('span'),bold=document.createElement('b'),out=document.createElement('output'),input=document.createElement('input');
      bold.textContent=label;head.append(bold,out);input.type='range';input.min=min;input.max=max;input.step=step;
      const sync=()=>{input.value=S[key];out.textContent=fmt(S[key]);};input.addEventListener('input',()=>{S[key]=Number(input.value);sync();persist();redraw();});
      wrap.append(head,input);group.appendChild(wrap);sync();syncers.push(sync);
    });
    const reset=document.createElement('button');reset.type='button';reset.className='kefe-btn';reset.textContent='Reset Fancy';
    reset.addEventListener('click',()=>{S=Object.assign({},DEFAULT);syncers.forEach(fn=>fn());persist();redraw();});group.appendChild(reset);host.appendChild(group);
    const sync=()=>{group.hidden=select.value!=='fancy';};select.addEventListener('change',sync);sync();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',buildControls);else buildControls();
})();