/* KEFE Visualiser — Fancy RGB Split lyric effect.
   Chunky condensed sans with animated chromatic aberration (red/cyan ghosting). */
(function(){
  'use strict';
  var u = window.kefeEffectUtils;
  window.kefeEffects = window.kefeEffects || {};
  if (!u) { console.error('[lyric-fancy] requires core.js'); return; }
  function clamp(v,a,b){ a=a==null?0:a; b=b==null?1:b; return Math.max(a,Math.min(b,Number(v)||0)); }

  function font(ctx,size){ ctx.font='900 '+Math.max(18,size)+'px "Archivo Narrow","Inter Tight",system-ui,sans-serif'; }
  function fit(ctx,text,requested,maxWidth){
    var size=Math.max(40,Math.min(220,Number(requested)||160));
    font(ctx,size);
    while(size>40 && ctx.measureText(text).width>maxWidth){ size-=2; font(ctx,size); }
    return size;
  }

  window.kefeEffects.fancy = function(ctx,w,h,style,lines,time){
    var active=u.activeLine(lines,time);
    if(!active) return;
    var text=String(active.line.text||'').trim().toUpperCase();
    if(!text) return;
    var size=fit(ctx,text,(style.fontSize||140)*1.15,w*0.9);
    var lineProg=u.lineProgress(active.line,time);
    if(lineProg.opacity<=0.01) return;
    font(ctx,size);
    var textWidth=ctx.measureText(text).width;
    var x=w/2, y=h*0.5;
    ctx.save();
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.globalAlpha=lineProg.opacity;
    var t=(time-(Number(active.line.time)||0));
    var jitter=Math.sin(t*30)*2.2;
    var sepX=6+Math.sin(t*18)*3;
    var sepY=Math.cos(t*22)*1.6;

    ctx.save();
    ctx.globalCompositeOperation='lighter';
    // red ghost
    ctx.fillStyle='rgba(255,0,0,0.85)';
    ctx.fillText(text, x-sepX+jitter, y+sepY);
    // cyan ghost
    ctx.fillStyle='rgba(0,255,255,0.85)';
    ctx.fillText(text, x+sepX-jitter, y-sepY);
    ctx.restore();

    // main white text
    ctx.fillStyle=style.textColor||'#FFFFFF';
    ctx.fillText(text, x+jitter*0.35, y-jitter*0.15);
    ctx.restore();
  };
})();
