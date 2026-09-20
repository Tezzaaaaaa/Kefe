/* KEFE Visualiser — Analog TV lyric effect.
   VT323 monospace with scanlines, glow, and a rolling tracking bar. */
(function(){
  'use strict';
  var u = window.kefeEffectUtils;
  window.kefeEffects = window.kefeEffects || {};
  if (!u) { console.error('[lyric-analogtv] requires core.js'); return; }
  function clamp(v,a,b){ a=a==null?0:a; b=b==null?1:b; return Math.max(a,Math.min(b,Number(v)||0)); }

  function font(ctx,size){ ctx.font='400 '+Math.max(8,size)+'px "VT323","Courier New",monospace'; }
  function fit(ctx,text,requested,maxWidth){
    var size=Math.max(34,Math.min(200,Number(requested)||96));
    font(ctx,size);
    while(size>34 && ctx.measureText(text).width>maxWidth){ size-=2; font(ctx,size); }
    return size;
  }

  window.kefeEffects.analogtv = function(ctx,w,h,style,lines,time){
    var active=u.activeLine(lines,time);
    if(!active) return;
    var text=String(active.line.text||'').trim();
    if(!text) return;
    var lineProg=u.lineProgress(active.line,time);
    if(lineProg.opacity<=0.01) return;
    var sp=style.fxSpacing||1;
    var B=u.textBlock(ctx,text,{font:font,tag:'analogtv',size:style.fontSize,w:w*0.94,h:h*0.92,lh:1.0*sp,maxLines:4});
    var flicker=0.88+0.08*Math.sin(time*30)+0.04*Math.sin(time*90+2);
    var top=h/2-B.blockH/2, padX=B.size*0.4, padY=B.size*0.18;
    var bw=B.blockW+padX*2, bh=B.blockH+padY*2, bx=w/2-bw/2, by=top-padY;
    ctx.save();
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.globalAlpha=lineProg.opacity*flicker;
    font(ctx,B.size);
    ctx.save();
    ctx.shadowColor='rgba(120,180,255,0.9)';
    ctx.shadowBlur=B.size*0.22;
    ctx.fillStyle=style.textColor||'#EAF2FF';
    B.rows.forEach(function(row,i){ ctx.fillText(row,w/2,top+(i+0.5)*B.rowH+Math.sin(time*2+i)*B.size*0.008); });
    ctx.restore();
    // scanlines, clipped to the text block
    ctx.save();
    ctx.beginPath(); ctx.rect(bx,by,bw,bh); ctx.clip();
    ctx.globalCompositeOperation='multiply';
    ctx.fillStyle='rgba(0,0,0,0.38)';
    var step=Math.max(3,Math.round(B.size*0.07));
    for(var sy=by;sy<by+bh;sy+=step) ctx.fillRect(bx,sy,bw,Math.max(1,step*0.4));
    // rolling tracking band: one full pass roughly every 3.2s
    var cycle=(time/3.2)%1, bandH=Math.max(10,B.size*0.22);
    var ty=by-bandH+cycle*(bh+bandH*2);
    ctx.globalCompositeOperation='screen';
    var tg=ctx.createLinearGradient(0,ty,0,ty+bandH);
    tg.addColorStop(0,'rgba(255,255,255,0)'); tg.addColorStop(0.5,'rgba(255,255,255,0.32)'); tg.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=tg; ctx.fillRect(bx,ty,bw,bandH);
    ctx.restore();
    ctx.restore();
  };
})();
