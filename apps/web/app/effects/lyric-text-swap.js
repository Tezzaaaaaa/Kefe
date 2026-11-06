/* KEFE Text Swap — six Remotion-inspired transitions on KEFE's timed lyric canvas. */
(() => {
  'use strict';
  const U = window.kefeEffectUtils;
  const E = window.kefeEffects = window.kefeEffects || {};
  if (!U) { console.error('[text-swap] effects/core.js is required'); return; }
  const PRESETS = ['fly-through','fade-through','crossfade','shared-axis-y','shared-axis-z','cut'];
  const STORAGE_KEY = 'kefe.text-swap.preset';
  const clamp = (v,a=0,b=1) => Math.max(a,Math.min(b,Number(v)||0));
  const easeOut = t => 1-Math.pow(1-clamp(t),3);
  const easeInOut = t => { t=clamp(t); return t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2; };
  const spring = t => { t=clamp(t); const w=9,z=.72,wd=w*Math.sqrt(1-z*z); return 1-Math.exp(-z*w*t)*(Math.cos(wd*t)+(z*w/wd)*Math.sin(wd*t)); };
  const getPreset = () => PRESETS.includes(window.kefeTextSwapPreset)?window.kefeTextSwapPreset:'fly-through';
  function setupFont(ctx,style,w,h) {
    const c=window.KEFE_TYPE?.effects?.textswap||{},family=style?.kefeMotionFont||c.family||'Open Sans',weight=c.weight||750;
    let size=clamp(style?.fontSize||Math.min(w,h)*.105,24,Math.min(w,h)*.22);
    U.setFont(ctx,family,size,weight);
    return {family,weight,size,lineHeight:c.lineHeight||1.06};
  }
  function wrap(ctx,text,maxWidth) {
    const words=String(text||'').replace(/\s+/g,' ').trim().split(' ').filter(Boolean),rows=[];let row='';
    words.forEach(word=>{const next=row?row+' '+word:word;if(row&&ctx.measureText(next).width>maxWidth){rows.push(row);row=word;}else row=next;});
    if(row)rows.push(row);return rows;
  }
  function drawLine(ctx,text,w,h,type,o={}) {
    const rows=wrap(ctx,text,w*.84),lineH=type.size*type.lineHeight,blockH=rows.length*lineH,top=-blockH/2+lineH/2;
    ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=o.color||'#fff';
    ctx.globalAlpha*=clamp(o.alpha==null?1:o.alpha);
    if(o.blur>0&&'filter' in ctx)ctx.filter='blur('+o.blur.toFixed(2)+'px)';
    ctx.translate(w/2+(o.x||0),h/2+(o.y||0));
    ctx.scale(o.scaleX==null?(o.scale||1):o.scaleX,o.scaleY==null?(o.scale||1):o.scaleY);
    rows.forEach((row,i)=>ctx.fillText(row,0,top+i*lineH));ctx.restore();
  }
  function drawCut(ctx,text,w,h,type,p,incoming) {
    const words=String(text||'').split(/\s+/).filter(Boolean);if(!words.length)return;
    ctx.save();ctx.font=type.weight+' '+type.size+'px "'+type.family+'", Arial, sans-serif';
    const gap=type.size*.28,widths=words.map(word=>ctx.measureText(word).width);
    let x=(w-(widths.reduce((a,b)=>a+b,0)+gap*(words.length-1)))/2;
    words.forEach((word,i)=>{const stagger=words.length>1?i/words.length*.38:0,q=clamp((p-stagger)/.62);
      ctx.save();ctx.globalAlpha*=incoming?(q>0?1:0):(q>=1?0:1);ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillStyle='#fff';ctx.fillText(word,x,h/2);ctx.restore();x+=widths[i]+gap;});
    ctx.restore();
  }
  E.textswap = function(ctx,w,h,style,lines,time) {
    if(!Array.isArray(lines)||!lines.length)return;
    const active=U.activeLine(lines,time);if(!active)return;
    const current=active.line,previous=lines[active.index-1]||null,elapsed=Math.max(0,time-(Number(current.time)||0)),duration=.62,p=clamp(elapsed/duration),preset=getPreset(),type=setupFont(ctx,style||{},w,h);
    ctx.save();
    if(!previous||elapsed>=duration)drawLine(ctx,current.text,w,h,type);
    else if(preset==='fly-through'){
      const enter=spring(clamp((p-.34)/.66)),exitAlpha=p<.72?1:1-(p-.72)/.28;
      drawLine(ctx,current.text,w,h,type,{scale:1.35-.35*enter,alpha:enter});
      drawLine(ctx,previous.text,w,h,type,{scale:1/Math.max(.1,1-p*.9),alpha:exitAlpha,blur:p>.6?(p-.6)*18:0});
    } else if(preset==='fade-through'){
      const q=clamp((p-.36)/.64);drawLine(ctx,current.text,w,h,type,{y:8*(1-q),alpha:q,blur:(1-q)*5});drawLine(ctx,previous.text,w,h,type,{y:-8*p,alpha:1-p});
    } else if(preset==='crossfade'){
      const q=clamp((p-.18)/.82);drawLine(ctx,current.text,w,h,type,{y:6*(1-q),alpha:q});drawLine(ctx,previous.text,w,h,type,{y:-6*p,alpha:1-p});
    } else if(preset==='shared-axis-y'){
      const out=easeOut(p),enter=spring(clamp((p-.25)/.75));drawLine(ctx,current.text,w,h,type,{y:24*(1-enter),alpha:enter});drawLine(ctx,previous.text,w,h,type,{y:-24*out,alpha:1-out});
    } else if(preset==='shared-axis-z'){
      const out=easeInOut(p),enter=spring(clamp((p-.25)/.75));drawLine(ctx,current.text,w,h,type,{scale:1.35-.35*enter,alpha:enter,blur:5*(1-enter)});drawLine(ctx,previous.text,w,h,type,{scale:1+.35*out,alpha:1-out,blur:5*out});
    } else { drawCut(ctx,current.text,w,h,type,p,true);drawCut(ctx,previous.text,w,h,type,p,false); }
    ctx.restore();
  };
  function mountControl() {
    const gallery=document.getElementById('lyricEffectOptions');if(!gallery||document.getElementById('kefeTextSwapPreset'))return;
    const host=document.createElement('label');host.className='kefe-text-swap-settings';host.id='kefeTextSwapSettings';
    const title=document.createElement('span');title.textContent='Text Swap transition';
    const select=document.createElement('select');select.className='kefe-select';select.id='kefeTextSwapPreset';select.setAttribute('aria-label','Text Swap transition');
    const labels={'fly-through':'Fly Through','fade-through':'Fade Through',crossfade:'Crossfade','shared-axis-y':'Shared Axis Y','shared-axis-z':'Shared Axis Z',cut:'Cut'};
    PRESETS.forEach(value=>{const option=document.createElement('option');option.value=value;option.textContent=labels[value];select.appendChild(option);});
    let saved='fly-through';try{saved=localStorage.getItem(STORAGE_KEY)||saved;}catch(_){}
    window.kefeTextSwapPreset=PRESETS.includes(saved)?saved:'fly-through';select.value=window.kefeTextSwapPreset;
    select.addEventListener('change',()=>{window.kefeTextSwapPreset=PRESETS.includes(select.value)?select.value:'fly-through';try{localStorage.setItem(STORAGE_KEY,window.kefeTextSwapPreset);}catch(_){}window.kefeLyrics?.redraw?.();});
    host.append(title,select);gallery.insertAdjacentElement('afterend',host);
    window.addEventListener('kefe-effect-change',event=>{host.hidden=event.detail?.effect!=='textswap';});
    host.hidden=document.querySelector('.kefe-lyric-effect-option.active')?.dataset.effect!=='textswap';
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountControl,{once:true});else mountControl();
})();