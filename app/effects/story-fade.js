/* KEFE Visualiser — Fade Up + Rise / Slide / Drop / Drift lyric effects */
(() => {
  'use strict';
  const u = window.kefeEffectUtils;
  window.kefeEffects = window.kefeEffects || {};
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));
  const smooth=v=>{const t=clamp(v);return t*t*(3-2*t);};
  const smoother=v=>{const t=clamp(v);return t*t*t*(t*(t*6-15)+10);};
  const BASE_FONTS=[
    {value:'Open Sans',label:'Open Sans',weight:700,group:'KEFE Fonts'},
    {value:'Archivo Narrow',label:'Archivo Narrow',weight:700,group:'KEFE Fonts'},
    {value:'Bricolage Grotesque',label:'Bricolage Grotesque',weight:700,group:'KEFE Fonts'},
    {value:'Courier Prime',label:'Courier Prime',weight:700,group:'KEFE Fonts'},
    {value:'Inter Tight',label:'Inter Tight',weight:700,group:'KEFE Fonts'},
    {value:'Momo Trust Display',label:'Momo Trust Display',weight:400,group:'KEFE Fonts'},
    {value:'Homemade Apple',label:'Homemade Apple',weight:400,group:'KEFE Fonts'},
    {value:'system-ui',label:'System UI — Default',weight:700,group:'System Fonts'},
    {value:'-apple-system',label:'Apple System',weight:700,group:'System Fonts'},
    {value:'BlinkMacSystemFont',label:'macOS System',weight:700,group:'System Fonts'},
    {value:'sans-serif',label:'Sans Serif',weight:700,group:'System Fonts'},
    {value:'serif',label:'Serif',weight:700,group:'System Fonts'},
    {value:'monospace',label:'Monospace',weight:700,group:'System Fonts'},
    {value:'cursive',label:'Cursive',weight:400,group:'System Fonts'},
    {value:'fantasy',label:'Fantasy',weight:700,group:'System Fonts'}
  ];
  const FONT_KEY='kefe-motion-font-v2';
  const getFont=name=>BASE_FONTS.find(f=>f.value===name)||BASE_FONTS[0];
  function setMotionFont(ctx,family,size){const f=getFont(family);ctx.font=`${f.weight} ${Math.max(18,size)}px "${f.value}", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;return f;}
  function trackedWidth(ctx,text,tracking){const chars=Array.from(String(text));if(!chars.length)return 0;return chars.reduce((s,c)=>s+ctx.measureText(c).width,0)+Math.max(0,chars.length-1)*tracking;}
  const __motionFitCache=new Map();
function fitMotionText(ctx,text,requested,tracking,maxWidth,family){
  const key=(text||'')+'|'+(requested||0)+'|'+(tracking||0)+'|'+(maxWidth|0)+'|'+(family||'');
  const hit=__motionFitCache.get(key);
  if(hit)return hit;
  let size=Math.max(30,Math.min(150,Number(requested)||76));
  setMotionFont(ctx,family,size);
  while(size>30&&trackedWidth(ctx,text,tracking*size)>maxWidth){size--;setMotionFont(ctx,family,size);}
  const result={size,width:trackedWidth(ctx,text,tracking*size)};
  if(__motionFitCache.size>800)__motionFitCache.clear();
  __motionFitCache.set(key,result);
  return result;
}
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>__motionFitCache.clear());
  function wrapWords(ctx,words,size,tracking,maxWidth,family){setMotionFont(ctx,family,size);const gap=Math.max(12,size*.16),rows=[];let row=[],width=0;for(const word of words){const wordWidth=trackedWidth(ctx,word.text,tracking),proposed=row.length?width+gap+wordWidth:wordWidth;if(row.length&&proposed>maxWidth){rows.push({words:row,width});row=[];width=0;}row.push({...word,width:wordWidth});width=row.length===1?wordWidth:width+gap+wordWidth;}if(row.length)rows.push({words:row,width});return rows;}
  function fit(ctx,words,requested,tracking,maxWidth,family){let size=Math.max(34,Math.min(150,Number(requested)||78));while(size>34){const rows=wrapWords(ctx,words,size,tracking*size,maxWidth,family);if(rows.length<=2)return{size,rows};size-=2;}return{size,rows:wrapWords(ctx,words,size,tracking*size,maxWidth,family)};}
  window.kefeEffects.fadeup = function(ctx, w, h, style, lines, time) {
    const active = u.activeLine(lines, time);
    if (!active) return;
    const words = u.wordsFor(active.line, active.next);
    if (!words.length) return;

    const contract = u.contract('fadeup');
    const tracking = Number(contract.tracking) || 0;
    const family = getFont(style.kefeMotionFont).value;
    const line = String(active.line.text || '').trim();

    // ---- Font sizing: fit the whole line to width ----
    let size = Math.max(34, Math.min(150, Number(style.fontSize) || 78));
    setMotionFont(ctx, family, size);
    while (size > 34 && trackedWidth(ctx, line, tracking * size) > w * 0.86) {
      size -= 2;
      setMotionFont(ctx, family, size);
    }
    const trackingPx = tracking * size;

    // ---- Lay out words on ONE row, evenly spaced ----
    // Instagram/Apple-style lyric motion works best with a single row of
    // words centred; wrapping mid-animation reads as bunched-up chaos.
    // For genuinely long lines we allow a second row, but only at full
    // word boundaries and only when we have to.
    const maxRowWidth = w * 0.88;
    const spaceW = ctx.measureText(' ').width + trackingPx;
    const measured = words.map(word => ({
      ...word,
      width: trackedWidth(ctx, word.text, trackingPx)
    }));

    const rows = [];
    let cur = [], curWidth = 0;
    for (const word of measured) {
      const proposed = cur.length ? curWidth + spaceW + word.width : word.width;
      if (cur.length && proposed > maxRowWidth) {
        rows.push({ words: cur, width: curWidth });
        cur = [];
        curWidth = 0;
      }
      cur.push(word);
      curWidth = cur.length === 1 ? word.width : curWidth + spaceW + word.width;
    }
    if (cur.length) rows.push({ words: cur, width: curWidth });

    // ---- Vertical layout: two rows maximum, evenly spaced ----
    const rowHeight = size * 1.24;
    const blockH = rows.length * rowHeight;
    const centreY = h * 0.50;
    const topRow = centreY - blockH / 2 + rowHeight / 2;

    // ---- Per-word animation ----
    // Each word fades up with a short stagger so the line reads left-to-right.
    // The stagger is bounded so even a 12-word line finishes within ~45% of
    // the line's duration. No bouncing, no scaling, just a soft rise.
    const start = Number(active.line.time) || 0;
    const end = Math.max(start + 0.4, Number(active.line.endTime) || start + 3);
    const duration = end - start;
    const totalWords = rows.reduce((sum, r) => sum + r.words.length, 0);
    const staggerWindow = Math.min(0.55, duration * 0.35);
    const perWordDelay = totalWords > 1 ? staggerWindow / (totalWords - 1) : 0;
    const fadeDur = Math.min(0.42, duration * 0.32);

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const y = topRow + r * rowHeight;
      const rowLeft = (w - row.width) / 2;
      let x = rowLeft;

      for (const word of row.words) {
        const delay = perWordDelay * (r * 1000 + row.words.indexOf(word)); // sequential across rows
        const elapsed = time - start - delay;
        let p = elapsed / fadeDur;
        if (p < 0) p = 0;
        if (p > 1) p = 1;
        const eased = smoother(p);

        const alpha = eased;
        // Small upward rise — 6% of font size, settles cleanly.
        const rise = (1 - eased) * size * 0.06;
        // Narrow glow that peaks in the middle of the entrance.
        const glow = Math.sin(eased * Math.PI) * size * 0.05;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = style.textColor || '#FFFFFF';
        ctx.shadowColor = style.accentColor || style.textColor || '#FFFFFF';
        ctx.shadowBlur = glow;
        setMotionFont(ctx, family, size);
        ctx.fillText(word.text, x, y + rise);
        ctx.restore();

        x += word.width + spaceW;
      }
    }

    ctx.restore();
  };
  const MOTION={
    rise:{label:'Rise — soft upward lift with a clean cinematic settle',tracking:-.006,distance:.72,direction:'up',rotation:0,overshoot:.018,ghost:.06},
    slide:{label:'Slide — smooth lateral glide with a precise stop',tracking:-.006,distance:.76,direction:'left',rotation:0,overshoot:.012,ghost:.055},
    drop:{label:'Drop — controlled downward arrival with a subtle weighty settle',tracking:-.006,distance:.70,direction:'down',rotation:0,overshoot:.024,ghost:.045},
    drift:{label:'Drift — gentle diagonal float with barely-there rotation',tracking:-.006,distance:.66,direction:'diagonal',rotation:.020,overshoot:.010,ghost:.075}
  };
  function motionLine(ctx,w,h,style,active,time,mode){
    const line=String(active?.line?.text||'').trim(); if(!line)return;
    const meta=MOTION[mode],family=getFont(style.kefeMotionFont).value,tracking=Number(meta?.tracking??-.006)||0;
    const B=u.textBlock(ctx,line,{font:(c,sz)=>setMotionFont(c,family,sz),tag:'motion:'+family,size:style.fontSize,w:w*.96,h:h*.96,lh:1.16*(style.fxSpacing||1),maxLines:3});
    const size=B.size,trackingPx=tracking*size;
    const start=Number(active.line.time)||0,end=Math.max(start+.35,Number(active.line.endTime)||start+3),duration=end-start;
    const enterDuration=Math.min(.46,Math.max(.20,duration*.19)),exitDuration=Math.min(.34,Math.max(.18,duration*.14));
    const enter=smoother((time-start)/enterDuration),exit=smoother((end-time)/exitDuration),opacity=enter*exit;
    if(opacity<=.002)return;
    const settle=smoother((time-start-enterDuration*.48)/Math.max(.16,enterDuration*.68));
    const anticipation=1-smoother((time-start)/Math.max(.08,enterDuration*.22));
    const distance=Math.min(h*.5,w*.2,size*meta.distance);
    let dx=0,dy=0,rotation=0;
    if(meta.direction==='up')dy=(1-enter)*distance-anticipation*size*.035;
    else if(meta.direction==='left')dx=(1-enter)*distance-anticipation*size*.035;
    else if(meta.direction==='down')dy=-(1-enter)*distance+anticipation*size*.035;
    else{dx=(1-enter)*distance*.72;dy=(1-enter)*distance*.28;rotation=(1-enter)*meta.rotation;}
    const wave=Math.sin(clamp((time-start)/Math.max(.01,enterDuration))*Math.PI)*(1-enter)*meta.overshoot*size;
    if(meta.direction==='up')dy-=wave;else if(meta.direction==='down')dy+=wave;else dx-=wave*(meta.direction==='left'?1:.55);
    const scale=.985+.015*settle,colour=style.textColor||'#FFFFFF',accent=style.accentColor||colour;
    const drawBlock=()=>B.rows.forEach((row,i)=>u.drawTrackedText(ctx,row,0,-B.blockH/2+(i+.5)*B.rowH,trackingPx,'fillText'));
    ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.globalCompositeOperation='source-over';ctx.filter='none';
    setMotionFont(ctx,family,size);
    if(meta.ghost>0&&enter<.92){ctx.save();ctx.globalAlpha=opacity*meta.ghost*(1-enter);ctx.fillStyle=accent;ctx.translate(w/2+dx*.35,h/2+dy*.35);ctx.rotate(rotation*.35);ctx.scale(scale,scale);drawBlock();ctx.restore();}
    ctx.globalAlpha=opacity;ctx.fillStyle=colour;ctx.translate(w/2+dx,h/2+dy);ctx.rotate(rotation);ctx.scale(scale,scale);drawBlock();
    ctx.restore();
  }
  function __makeMotionRenderer(name) {
    return function(ctx, w, h, style, lines, time) {
      const active = u.activeLine(lines, time);
      if (active) motionLine(ctx, w, h, style, active, time, name);
    };
  }
  window.kefeEffects.rise = __makeMotionRenderer('rise');
  window.kefeEffects.slide = __makeMotionRenderer('slide');
  window.kefeEffects.drop = __makeMotionRenderer('drop');
  window.kefeEffects.drift = __makeMotionRenderer('drift');
  function installMotionEffects(){if(window.__kefeMotionEffectsInstalled)return true;if(typeof window.render!=='function')return false;const originalRender=window.render,extra=new Set(Object.keys(MOTION));window.render=function(ctx,w,h,appState,mediaCache){const effect=appState?.style?.effect;if(!extra.has(effect))return originalRender(ctx,w,h,appState,mediaCache);const style=appState.style,lines=appState.captions?.mode==='captions'&&Array.isArray(appState.captions.lines)&&appState.captions.lines.length?appState.captions.lines:(Array.isArray(appState.lyrics?.lines)?appState.lyrics.lines:[]),time=Number(appState.playback?.currentTime)||0;const originalEffect=style.effect,originalText=style.textColor,originalAccent=style.accentColor,originalOpacity=style.appleInactiveOpacity;try{style.effect='apple';style.textColor='rgba(0,0,0,0)';style.accentColor='rgba(0,0,0,0)';style.appleInactiveOpacity=0;originalRender(ctx,w,h,appState,mediaCache);}finally{style.effect=originalEffect;style.textColor=originalText;style.accentColor=originalAccent;style.appleInactiveOpacity=originalOpacity;}if(lines.length)window.kefeEffects[effect](ctx,w,h,style,lines,time);};window.__kefeMotionEffectsInstalled=true;return true;}
  function addMotionButtons(){ /* buttons owned by app/effects/effects.js */ }
function addMotionFontControl(){if(document.getElementById('kefeMotionFontControl'))return;const styleBlock=document.getElementById('lyricStyleBlock');if(!styleBlock)return;const row=document.createElement('label');row.id='kefeMotionFontControl';row.className='kefe-motion-font-control';row.textContent='Font';const select=document.createElement('select');select.id='kefeMotionFont';select.setAttribute('aria-label','Font for Rise, Slide, Drop and Drift');const groups={};for(const font of BASE_FONTS){const group=font.group||'Fonts';if(!groups[group]){groups[group]=document.createElement('optgroup');groups[group].label=group;select.appendChild(groups[group]);}const option=document.createElement('option');option.value=font.value;option.textContent=font.label;option.style.fontFamily=`"${font.value}",sans-serif`;groups[group].appendChild(option);}let saved=window.state?.style?.kefeMotionFont;try{saved=saved||localStorage.getItem(FONT_KEY);}catch(_){}select.value=BASE_FONTS.some(f=>f.value===saved)?saved:'Open Sans';if(window.state?.style)window.state.style.kefeMotionFont=select.value;select.addEventListener('change',()=>{if(window.state?.style)window.state.style.kefeMotionFont=select.value;try{localStorage.setItem(FONT_KEY,select.value);}catch(_){}window.redrawCurrentPreviewFrame?.();});row.appendChild(select);styleBlock.querySelector('.effect-buttons')?.insertAdjacentElement('afterend',row);}
  function updateMotionFontVisibility(){const control=document.getElementById('kefeMotionFontControl');if(!control)return;const selected=window.state?.style?.effect;control.style.display=Object.prototype.hasOwnProperty.call(MOTION,selected)?'grid':'none';}
  function initExtras(){addMotionButtons();updateMotionFontVisibility();if(!window.__kefeMotionEffectsInstalled||!document.querySelector('[data-effect="rise"]'))setTimeout(initExtras,50);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(initExtras,0),{once:true});else setTimeout(initExtras,0);
  const loadScrollLines=()=>{if(document.querySelector('script[data-kefe-scroll-lines]'))return;if(!document.head)return;const s=document.createElement('script');s.src='./app/effects/scroll-lines.js';s.dataset.kefeScrollLines='true';document.head.appendChild(s);};
  
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{loadScrollLines();},{once:true});else{loadScrollLines();}
})();
