/* KEFE Visualiser — Karaoke lyric effect */
(() => {
  'use strict';
  const u = window.kefeEffectUtils;
  window.kefeEffects = window.kefeEffects || {};
  const clamp = (v,a=0,b=1) => Math.max(a,Math.min(b,Number(v)||0));
  const smooth = v => { const t=clamp(v); return t*t*(3-2*t); };
  window.kefeEffects.karaoke = function(ctx,w,h,style,lines,time){
    const active=u.activeLine(lines,time); if(!active)return;
    const words=u.wordsFor(active.line,active.next); if(!words.length)return;
    const size=Math.max(48,Math.min(150,Number(style.fontSize)||82));
    u.setFont(ctx,'Inter Tight',size,800);
    const gap=size*.22, widths=words.map(x=>ctx.measureText(x.text).width), total=widths.reduce((a,b)=>a+b,0)+gap*(words.length-1);
    let x=(w-total)/2, y=h*.5;
    ctx.save(); ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillStyle=style.textColor||'#FFF';
    for(let i=0;i<words.length;i++){
      const word=words[i], p=u.wordProgress(word,time), glow=smooth(p.active), reveal=smooth(p.raw/.18);
      ctx.save(); ctx.globalAlpha=.22+.78*clamp(reveal); ctx.fillText(word.text,x,y); ctx.restore();
      if(glow>0){ ctx.save(); ctx.globalAlpha=.98*glow; ctx.fillStyle=style.accentColor||'#FFF'; ctx.shadowColor=ctx.fillStyle; ctx.shadowBlur=size*.08*glow; ctx.fillText(word.text,x,y); ctx.restore(); }
      x+=widths[i]+gap;
    }
    ctx.restore();
  };
})();
