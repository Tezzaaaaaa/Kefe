/* KEFE Premium — KINETIC
 * System-first kinetic typography: deterministic composition, word hierarchy,
 * spatial choreography, physical easing and controlled variation.
 */
(() => {
  'use strict';
  const u = window.kefeEffectUtils;
  window.kefeEffects = window.kefeEffects || {};
  const clamp = (v,a=0,b=1) => Math.max(a,Math.min(b,Number(v)||0));
  const smoother = v => { const t=clamp(v); return t*t*t*(t*(t*6-15)+10); };
  const hash = s => { let h=2166136261; for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);} return (h>>>0)/4294967295; };
  const easeOut = v => 1-Math.pow(1-clamp(v),3);
  const easeInOut = v => { const t=clamp(v); return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2; };
  const fit = (ctx,text,size,max) => u.fitContractText(ctx,'mixedmedia',text,size,max);
  const measure = (items,gap) => items.reduce((n,x)=>n+x.width,0)+Math.max(0,items.length-1)*gap;
  const wrapWords = (ctx,words,size,maxWidth,gap) => {
    u.setContractFont(ctx,'mixedmedia',size);
    const rows=[]; let row=[]; let width=0;
    for(const word of words){
      const widthWord=ctx.measureText(word.text).width;
      const proposed=width + (row.length?gap:0) + widthWord;
      if(row.length && proposed>maxWidth){ rows.push(row); row=[]; width=0; }
      row.push({...word,width:widthWord}); width += (row.length>1?gap:0) + widthWord;
    }
    if(row.length)rows.push(row);
    return rows;
  };
  const layout = (ctx,words,size,maxWidth,gap,seed) => {
    let rows=wrapWords(ctx,words,size,maxWidth,gap);
    if(rows.length>3 && size>42) rows=wrapWords(ctx,words,size*.86,maxWidth,gap*.9);
    const rowGap=size*.08;
    return rows.map((row,r)=>{
      const total=measure(row,gap); let x=-total/2;
      return row.map((word,i)=>{
        const center=x+word.width/2;
        const jitter=(hash(seed+':'+r+':'+i)-.5)*size*.018;
        const item={...word,x:center+jitter,y:(r-(rows.length-1)/2)*(size+rowGap),row:r,index:i};
        x+=word.width+gap; return item;
      });
    });
  };
  function drawWord(ctx,word,time,params,seed){
    const p=u.wordProgress(word,time);
    const enter=smoother(p.raw/.20);
    const active=smoother((p.raw-.04)/.34);
    const exit=smoother((p.raw-.78)/.22);
    const n=hash(seed+':'+word.text+':'+word.index);
    const dir=n>.66?1:n<.33?-1:0;
    const travel=params.travel*(.65+.7*n);
    const fromX=dir*travel*(1-enter);
    const fromY=(n-.5)*params.travelY*(1-enter);
    const settle=1+.025*params.energy*Math.sin(Math.PI*clamp((p.raw-.12)/.65));
    const emphasis=1+params.hierarchy*.09*active;
    const scale=(.86+.14*enter)*settle*emphasis;
    const rotation=(n-.5)*params.rotation*(1-enter);
    const alpha=enter*(1-.42*exit);
    ctx.save();
    ctx.translate(word.x+fromX,word.y+fromY); ctx.rotate(rotation); ctx.scale(scale,scale);
    ctx.globalAlpha=alpha; ctx.fillStyle=params.color; ctx.fillText(word.text,0,0);
    if(active>0){
      ctx.save(); ctx.globalAlpha=.10*active*params.hierarchy; ctx.shadowColor=params.accent;
      ctx.shadowBlur=params.glow*(.5+active); ctx.fillStyle=params.accent; ctx.fillText(word.text,0,0); ctx.restore();
    }
    ctx.restore();
  }
  window.kefeEffects.kinetic = function(ctx,w,h,style,lines,time){
    const a=u.activeLine(lines,time); if(!a)return;
    const text=String(a.line.text||'').trim(); if(!text)return;
    const words=u.wordsFor(a.line,a.next); if(!words.length)return;
    const energy=clamp(style.kineticEnergy ?? .72), hierarchy=clamp(style.kineticHierarchy ?? .78);
    const motion=clamp(style.kineticMotion ?? .68), density=clamp(style.kineticDensity ?? .55);
    const glow=clamp(style.kineticGlow ?? .18), sizeBase=Number(style.fontSize)||82;
    const maxWidth=w*(.80+.08*(1-density)), gap=sizeBase*(.055+.035*density);
    const size=fit(ctx,text,sizeBase*(.96+energy*.12),maxWidth);
    const rows=layout(ctx,words,size,maxWidth,gap,text+'|'+a.index);
    const lineP=u.lineProgress(a.line,time,.10,.20), enter=easeOut(lineP.enter), exit=easeInOut(lineP.exit);
    const lineY=h*(.50 + .025*(hash(text)-.5));
    const drift=(1-enter)*w*.035*(.5+motion);
    const params={energy,hierarchy,motion,density,glow,travel:w*(.018+.035*motion),travelY:h*(.008+.018*motion),rotation:.018*motion,color:style.textColor||'#fff',accent:style.accentColor||'#fff'};
    ctx.save(); ctx.translate(w/2+drift,lineY); ctx.scale(.96+.04*enter,.96+.04*enter);
    ctx.textAlign='center'; ctx.textBaseline='middle'; u.setContractFont(ctx,'mixedmedia',size);
    for(const row of rows) for(const word of row) drawWord(ctx,word,time,params,text+'|'+a.index);
    ctx.restore();
    if(a.next?.text && exit<.82){
      const nextText=String(a.next.text).trim(), nextSize=fit(ctx,nextText,size*.72,maxWidth);
      u.setContractFont(ctx,'mixedmedia',nextSize); ctx.save(); ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.globalAlpha=.055*(1-exit); ctx.fillStyle=params.accent; ctx.translate(w/2,h*(.50+.22*(1-exit))); ctx.fillText(nextText,0,0); ctx.restore();
    }
  };
})();
