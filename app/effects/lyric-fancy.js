/* KEFE Visualiser — Fancy RGB Split lyric effect.
   Chunky condensed sans with animated chromatic aberration (red/cyan ghosting). */
(function(){
  'use strict';
  var u = window.kefeEffectUtils;
  window.kefeEffects = window.kefeEffects || {};
  if (!u) { console.error('[lyric-fancy] requires core.js'); return; }
  function clamp(v,a,b){ a=a==null?0:a; b=b==null?1:b; return Math.max(a,Math.min(b,Number(v)||0)); }

  function font(ctx,size){ ctx.font='400 '+Math.max(8,size)+'px "Anton","Arial Black",system-ui,sans-serif'; }
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
    var lineProg=u.lineProgress(active.line,time);
    if(lineProg.opacity<=0.01) return;
    var sp=style.fxSpacing||1;
    var B=u.textBlock(ctx,text,{font:font,tag:'fancy',size:style.fontSize,w:w*0.94,h:h*0.94,lh:1.0*sp,maxLines:3});
    var pad=B.size*0.05;
    var t=(time-(Number(active.line.time)||0));
    var jitter=Math.sin(t*30)*B.size*0.014;
    var sepX=B.size*(0.04+Math.sin(t*18)*0.02);
    var sepY=Math.cos(t*22)*B.size*0.01;
    ctx.save();
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.globalAlpha=lineProg.opacity;
    font(ctx,B.size);
    B.rows.forEach(function(row,i){
      var x=w/2, y=h/2-B.blockH/2+(i+0.5)*B.rowH;
      ctx.save();
      ctx.globalCompositeOperation='lighter';
      ctx.fillStyle='rgba(255,0,0,0.85)';
      ctx.fillText(row, x-sepX+jitter, y+sepY);
      ctx.fillStyle='rgba(0,255,255,0.85)';
      ctx.fillText(row, x+sepX-jitter, y-sepY);
      ctx.restore();
      ctx.fillStyle=style.textColor||'#FFFFFF';
      ctx.fillText(row, x+jitter*0.35, y-jitter*0.15);
    });
    ctx.restore();
  };
})();
