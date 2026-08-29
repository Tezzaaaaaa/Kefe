/* KEFE Visualiser — Slide lyric effect */
(() => {
  'use strict';
  const u=window.kefeEffectUtils; window.kefeEffects=window.kefeEffects||{};
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));
  const smoother=v=>{const t=clamp(v);return t*t*t*(t*(t*6-15)+10);};
  window.kefeEffects.slide=function(ctx,w,h,style,lines,time){
    const active=u.activeLine(lines,time); if(!active)return;
    const current=String(active.line.text||'').trim(); if(!current)return;
    const next=String(active.next?.text||'').trim();
    const size=Math.max(38,Math.min(150,Number(style.fontSize)||80)); u.setFont(ctx,'Bricolage Grotesque',size,500);
    const p=u.lineProgress(active.line,time), enter=smoother(p.hold/.22), exit=smoother((1-p.hold)/.22);
    ctx.save(); ctx.textAlign='center'; ctx.textBaseline='middle';
    const y=h*.5;
    ctx.save(); ctx.globalAlpha=exit; ctx.fillStyle=style.textColor||'#FFF'; ctx.translate((1-enter)*w*.55,0); ctx.fillText(current,w/2,y); ctx.restore();
    if(next){ctx.save();ctx.globalAlpha=(1-exit)*.95;ctx.fillStyle=style.accentColor||style.textColor||'#FFF';ctx.translate(-w*.55*exit,0);ctx.fillText(next,w/2,y);ctx.restore();}
    ctx.restore();
  };
})();
