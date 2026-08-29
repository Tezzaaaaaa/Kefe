/* KEFE Premium — Lightfield Typography system */
(() => {
  'use strict';
  const u=window.kefeEffectUtils;window.kefeEffects=window.kefeEffects||{};
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));
  window.kefeEffects.lightfield=function(ctx,w,h,style,lines,time){const a=u.activeLine(lines,time);if(!a)return;const text=String(a.line.text||'').trim();if(!text)return;const p=u.lineProgress(a.line,time,.08,.20),enter=u.smoother(p.enter),exit=u.smoother(p.exit);const size=Math.max(42,Math.min(150,Number(style.fontSize)||78));const intensity=clamp(style.lightfieldIntensity??.68),disp=clamp(style.lightfieldDispersion??.38);const x=w/2,y=h*.54+(1-enter)*size*.32;u.setContractFont(ctx,'apple',size);const pulse=.5+.5*Math.sin(time*5.2);ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.globalAlpha=p.opacity;ctx.globalCompositeOperation='screen';ctx.shadowColor=style.lightfieldGlowColor||style.accentColor||'#fff';ctx.shadowBlur=size*(.08+.12*intensity)*(0.8+.2*pulse);
    // Soft luminous field behind the glyphs.
    const g=ctx.createRadialGradient(x,y,0,x,y,size*2.8);g.addColorStop(0,`rgba(255,255,255,${.10*intensity})`);g.addColorStop(.45,`rgba(255,255,255,${.025*intensity})`);g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(x-size*3,y-size*2,size*6,size*4);
    const offsets=[[-1,0,'rgba(255,70,170,.24)'],[1,0,'rgba(70,190,255,.24)'],[0,0,style.textColor||'#fff']];for(const [dx,dy,c] of offsets){ctx.save();ctx.translate(x+dx*size*.018*disp,y+dy*size*.006*disp);ctx.fillStyle=c;ctx.globalAlpha=p.opacity*(dx===0?1:.55*disp);ctx.fillText(text,0,0);ctx.restore();}
    ctx.restore();
    if(a.next?.text&&exit<.45){ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';u.setContractFont(ctx,'apple',size*.78);ctx.globalAlpha=.08*(1-exit);ctx.fillStyle=style.textColor||'#fff';ctx.fillText(String(a.next.text).trim(),x,y+size*1.18);ctx.restore();}
  };
})();
