/* KEFE Dot Matrix — lyrics built from a precise grid of luminous circles and squares. */
(() => {
  'use strict';
  const U = window.kefeEffectUtils;
  const E = window.kefeEffects = window.kefeEffects || {};
  if (!U) { console.error('[dot-matrix] effects/core.js is required'); return; }
  const clamp = U.clamp;
  const SETTINGS_KEY = 'kefe.dot-matrix.settings';
  const defaults = { shape:'mixed', density:14, motion:42, reveal:'sung' };
  const readSettings = () => {
    try { return {...defaults,...JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')}; }
    catch (_) { return {...defaults}; }
  };
  window.kefeDotMatrixSettings = readSettings();
  function font(ctx,size,style) {
    const c=window.KEFE_TYPE?.effects?.dotmatrix||{};
    U.setFont(ctx,c.family||style?.kefeMotionFont||'Arial',size,c.weight||900);
  }
  function rowsFor(ctx,text,size,maxWidth,maxLines) {
    const words=String(text||'').trim().split(/\s+/).filter(Boolean),rows=[];let row='';
    for(const word of words){const candidate=row?row+' '+word:word;if(row&&ctx.measureText(candidate).width>maxWidth){rows.push(row);row=word;}else row=candidate;}
    if(row)rows.push(row);
    while(rows.length>maxLines&&size>20){size*=.92;font(ctx,size);}
    return {rows,size};
  }
  function drawDots(ctx,w,h,item,time,settings,style) {
    const line=String(item.line.text||'').replace(/\s+/g,' ').trim();if(!line)return;
    const c=window.KEFE_TYPE?.effects?.dotmatrix||{},base=Number(item.line.fontSize)||Number(window.kefeCurrentLyricFontSize)||Math.min(w,h)*.18;
    const size=Math.min(base,Math.min(w,h)*.24),maxWidth=w*.9;
    font(ctx,size,style);const layout=rowsFor(ctx,line,size,maxWidth,3);font(ctx,layout.size);
    const lineH=layout.size*(c.lineHeight||1.02),blockH=layout.rows.length*lineH,top=(h-blockH)/2+lineH/2;
    const spacing=Math.max(5,Math.min(30,Number(settings.density)||14)),radius=spacing*.38;
    const mask=document.createElement('canvas');mask.width=Math.max(1,Math.ceil(w));mask.height=Math.max(1,Math.ceil(h));
    const m=mask.getContext('2d');m.font=ctx.font;m.textAlign='center';m.textBaseline='middle';m.fillStyle='#fff';
    layout.rows.forEach((row,i)=>m.fillText(row,w/2,top+i*lineH));
    const data=m.getImageData(0,0,mask.width,mask.height).data;
    const words=U.wordsFor(item.line,item.next),progress=U.sungProgress(words,time);
    const motion=clamp(Number(settings.motion)/100),reveal=settings.reveal==='sung';
    ctx.save();ctx.globalAlpha*=clamp(item.alpha);ctx.fillStyle=c.color||'#fff';
    const cols=Math.ceil(w/spacing),rows=Math.ceil(h/spacing),beat=Math.sin(time*8.8)*.5+.5;
    for(let gy=0;gy<rows;gy++)for(let gx=0;gx<cols;gx++){
      const x=gx*spacing+spacing/2,y=gy*spacing+spacing/2;
      const ix=Math.min(mask.width-1,Math.max(0,Math.round(x))),iy=Math.min(mask.height-1,Math.max(0,Math.round(y)));
      if(data[(iy*mask.width+ix)*4+3]<90)continue;
      const cellProgress=(gx/Math.max(1,cols-1));
      const wave=(Math.sin(gy*.32-time*3.4)+1)*.5;
      const active=reveal?clamp((progress-cellProgress+.12)/.2):1;
      if(active<=.01)continue;
      const pulse=1+motion*(.12*beat+.08*wave);
      const r=radius*pulse;
      const mixed=settings.shape==='mixed',square=settings.shape==='square'||(mixed&&((gx+gy)%2===0));
      ctx.globalAlpha*=active*(.82+.18*wave);
      if(square){ctx.fillRect(x-r,y-r,r*2,r*2);}
      else{ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
      ctx.globalAlpha=clamp(item.alpha);
    }
    ctx.restore();
  }
  E.dotmatrix=(ctx,w,h,style,lines,time)=>{
    if(!Array.isArray(lines)||!lines.length)return;
    const settings=window.kefeDotMatrixSettings||defaults;
    ctx.save();ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);
    U.lineStack(lines,Number(time)||0,.22,.2).forEach(item=>drawDots(ctx,w,h,item,Number(time)||0,settings,style));
    ctx.restore();
  };
  function mountControls(){
    const gallery=document.getElementById('lyricEffectOptions');if(!gallery||document.getElementById('kefeDotMatrixControls'))return;
    const host=document.createElement('div');host.className='kefe-text-swap-settings';host.id='kefeDotMatrixControls';
    const controls=[
      ['shape','Cell shape',[['mixed','Mixed circles + squares'],['circle','Circles'],['square','Squares']]],
      ['density','Grid spacing',[['10','Dense'],['14','Balanced'],['18','Open'],['22','Sparse']]],
      ['motion','Audio / motion intensity',[['0','Still'],['25','Subtle'],['50','Reactive'],['85','Strong']]],
      ['reveal','Lyric reveal',[['sung','Sung left-to-right'],['full','Full line']]]
    ];
    controls.forEach(([key,label,options])=>{
      const wrap=document.createElement('label');wrap.className='kefe-dot-matrix-control';
      const title=document.createElement('span');title.textContent=label;
      const select=document.createElement('select');select.className='kefe-select';select.dataset.setting=key;select.setAttribute('aria-label',label);
      options.forEach(([value,text])=>{const opt=document.createElement('option');opt.value=value;opt.textContent=text;select.appendChild(opt);});
      select.value=String(window.kefeDotMatrixSettings[key]??defaults[key]);
      select.addEventListener('change',()=>{window.kefeDotMatrixSettings[key]=key==='density'||key==='motion'?Number(select.value):select.value;try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(window.kefeDotMatrixSettings));}catch(_){}window.kefeLyrics?.redraw?.();});
      wrap.append(title,select);host.appendChild(wrap);
    });
    gallery.insertAdjacentElement('afterend',host);
    const sync=()=>{host.hidden=document.querySelector('.kefe-lyric-effect-option.active')?.dataset.effect!=='dotmatrix';};
    window.addEventListener('kefe-effect-change',sync);sync();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountControls,{once:true});else mountControls();
})();
