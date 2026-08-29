/* KEFE Premium — Liquid Typography system */
(() => {
  'use strict';
  const u=window.kefeEffectUtils;window.kefeEffects=window.kefeEffects||{};
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));
  function drawWarped(ctx,text,cx,cy,size,progress,distortion,viscosity,colour){
    const chars=Array.from(text);u.setContractFont(ctx,'aurora',size);const widths=chars.map(c=>ctx.measureText(c).width);const gap=size*.005,total=widths.reduce((a,b)=>a+b,0)+gap*(chars.length-1);let x=cx-total/2;
    for(let i=0;i<chars.length;i++){const c=chars[i],mid=i/Math.max(1,chars.length-1),phase=progress*Math.PI*2+mid*4.2;const wave=Math.sin(phase)*size*.11*distortion;const sx=1+Math.sin(phase*.8)*.13*distortion;const sy=1-Math.sin(phase*.8)*.08*distortion;const squeeze=1+Math.sin(mid*Math.PI)*.06*viscosity;ctx.save();ctx.translate(x+widths[i]/2,cy+wave);ctx.scale(sx*squeeze,sy);ctx.globalAlpha=.82+.18*(1-Math.abs(mid-.5)*2);ctx.fillText(c,0,0);ctx.restore();x+=widths[i]+gap;}
  }
  window.kefeEffects.liquid=function(ctx,w,h,style,lines,time){const a=u.activeLine(lines,time);if(!a)return;const text=String(a.line.text||'').trim();if(!text)return;const distortion=clamp(style.liquidDistortion??.55),viscosity=clamp(style.liquidViscosity??.62),flow=Math.max(.2,Number(style.liquidFlow)||1);const p=u.lineProgress(a.line,time,.08,.20),enter=u.smoother(p.enter),exit=u.smoother(p.exit);const size=Math.max(42,Math.min(150,Number(style.fontSize)||78));ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.globalAlpha=p.opacity;ctx.fillStyle=style.textColor||'#fff';ctx.shadowColor=style.liquidGlowColor||style.accentColor||'#fff';ctx.shadowBlur=size*.045*distortion;ctx.translate(w/2,h*.54+(1-enter)*size*.35);ctx.scale(.94+.06*enter,1);drawWarped(ctx,text,0,0,size,time*flow%1,distortion,viscosity,ctx.fillStyle);ctx.restore();};
})();
