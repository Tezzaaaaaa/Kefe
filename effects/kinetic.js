/* KEFE Premium — Kinetic Typography system */
(() => {
  'use strict';
  const u = window.kefeEffectUtils;
  window.kefeEffects = window.kefeEffects || {};
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));
  const ease=v=>u.smoother(v);
  function fit(ctx,text,size,max){let s=Math.max(40,Math.min(156,size));u.setContractFont(ctx,'mixedmedia',s);while(s>40&&ctx.measureText(text).width>max){s-=1;u.setContractFont(ctx,'mixedmedia',s);}return s;}
  window.kefeEffects.kinetic=function(ctx,w,h,style,lines,time){
    const a=u.activeLine(lines,time);if(!a)return;
    const text=String(a.line.text||'').trim();if(!text)return;
    const words=u.wordsFor(a.line,a.next);const energy=clamp(style.kineticEnergy??.62);const beat=clamp(style.kineticBeat??.55);
    const base=Number(style.fontSize)||78; const max=w*.84; const size=fit(ctx,text,base*(.94+energy*.14),max);
    const p=u.lineProgress(a.line,time,.08,.16), enter=ease(p.enter), exit=ease(p.exit);
    const drift=(1-enter)*w*.075; const scale=(.90+.10*enter)*(1+Math.sin(time*9.0)*.004*beat);
    ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.globalAlpha=p.opacity;ctx.fillStyle=style.textColor||'#fff';
    u.setContractFont(ctx,'mixedmedia',size);ctx.translate(w/2+drift,h*.53);ctx.scale(scale,scale);
    // Per-word emphasis remains subtle when word timing is available.
    if(words.length>1 && Array.isArray(a.line.words)){
      const total=words.reduce((n,x)=>n+ctx.measureText(x.text).width,0)+size*.035*(words.length-1);let x=-total/2;
      for(const word of words){const wp=u.wordProgress(word,time);const active=ease((wp.raw-.04)/.25);ctx.save();ctx.translate(x+ctx.measureText(word.text)/2,0);ctx.scale(1+active*.07*energy,1+active*.07*energy);ctx.globalAlpha=.74+.26*active;ctx.fillText(word.text,0,0);ctx.restore();x+=ctx.measureText(word.text).width+size*.035;}
    }else ctx.fillText(text,0,0);
    ctx.restore();
    if(exit<.55){const n=a.next;if(n?.text){const np=ease((1-exit)*.65);ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.globalAlpha=.10*np;ctx.fillStyle=style.accentColor||'#fff';u.setContractFont(ctx,'mixedmedia',size*.82);ctx.translate(w/2,-h*.055);ctx.fillText(String(n.text).trim(),0,h*.53);ctx.restore();}}
  };
})();
