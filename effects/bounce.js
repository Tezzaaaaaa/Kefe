/* KEFE Visualiser — Bounce lyric effect */
(() => {
  'use strict';
  const u=window.kefeEffectUtils; window.kefeEffects=window.kefeEffects||{};
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));
  const smoother=v=>{const t=clamp(v);return t*t*t*(t*(t*6-15)+10);};
  window.kefeEffects.bounce=function(ctx,w,h,style,lines,time){
    const active=u.activeLine(lines,time); if(!active)return;
    const words=u.wordsFor(active.line,active.next); if(!words.length)return;
    const size=Math.max(36,Math.min(150,Number(style.fontSize)||80)); u.setFont(ctx,'Archivo Narrow',size,700);
    const gap=size*.20, widths=words.map(x=>ctx.measureText(x.text).width), total=widths.reduce((a,b)=>a+b,0)+gap*(words.length-1);
    let x=(w-total)/2; const y=h*.5;
    ctx.save();ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillStyle=style.textColor||'#FFF';
    for(let i=0;i<words.length;i++){
      const word=words[i],p=u.wordProgress(word,time),e=smoother(p.raw/.25),b=Math.sin(Math.PI*clamp((p.raw-.05)/.55));
      const lift=(1-e)*size*.55+Math.max(0,b)*size*.14,scale=.92+.08*e;
      ctx.save();ctx.globalAlpha=e;ctx.translate(x+widths[i]/2,y-lift);ctx.scale(scale,scale);ctx.fillText(word.text,0,0);ctx.restore();
      x+=widths[i]+gap;
    }
    ctx.restore();
  };
})();
