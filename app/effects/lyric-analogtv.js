/* KEFE Visualiser — Analog TV lyric effect.
   VT323 monospace with scanlines, glow, and a rolling tracking bar. */
(function(){
  'use strict';
  var u = window.kefeEffectUtils;
  window.kefeEffects = window.kefeEffects || {};
  if (!u) { console.error('[lyric-analogtv] requires core.js'); return; }
  function clamp(v,a,b){ a=a==null?0:a; b=b==null?1:b; return Math.max(a,Math.min(b,Number(v)||0)); }

  function font(ctx,size){ ctx.font='400 '+Math.max(18,size)+'px "VT323","Courier New",monospace'; }
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
    var size=fit(ctx,text,style.fontSize||96,w*0.82);
    font(ctx,size);
    var x=w/2, y=h*0.5;
    var lineProg=u.lineProgress(active.line,time);
    if(lineProg.opacity<=0.01) return;

    // glow flicker
    var flicker=0.85+0.15*Math.sin(time*30)+0.05*Math.sin(time*90+2);
    ctx.save();
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.globalAlpha=lineProg.opacity*flicker;

    // scanlines across text
    ctx.save();
    ctx.shadowColor='rgba(120,180,255,0.9)';
    ctx.shadowBlur=size*0.5;
    ctx.fillStyle=style.textColor||'#EAF2FF';
    ctx.fillText(text,x,y+Math.sin(time*2)*0.8);
    ctx.restore();

    // scanline overlay (thin dark horizontal stripes)
    ctx.save();
    ctx.beginPath();
    var textW=ctx.measureText(text).width;
    ctx.rect(x-textW/2-30, y-size*0.85, textW+60, size*1.7);
    ctx.clip();
    ctx.globalCompositeOperation='multiply';
    ctx.fillStyle='rgba(0,0,0,0.35)';
    for(var sy=y-size;sy<y+size;sy+=4){
      ctx.fillRect(x-textW/2-30, sy, textW+60, 1.6);
    }
    ctx.restore();

    // tracking bar (horizontal bright band that rolls through the text)
    var trackY=y-size*0.9+((time*0.6)%(size*1.8));
    ctx.save();
    ctx.beginPath();
    ctx.rect(x-w/2, trackY-6, w, 14);
    ctx.clip();
    ctx.globalCompositeOperation='screen';
    var tg=ctx.createLinearGradient(0,trackY-6,0,trackY+8);
    tg.addColorStop(0,'rgba(255,255,255,0)');
    tg.addColorStop(0.5,'rgba(255,255,255,0.35)');
    tg.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=tg;
    ctx.fillRect(x-w/2, trackY-6, w, 14);
    ctx.restore();

    ctx.restore();
  };
})();
