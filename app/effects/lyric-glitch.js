/* KEFE Visualiser — Glitch lyric effect.
   Chunky sans with skew/blur/chromatic glitch on entry, then settles. */
(function(){
  'use strict';
  var u = window.kefeEffectUtils;
  window.kefeEffects = window.kefeEffects || {};
  if (!u) { console.error('[lyric-glitch] requires core.js'); return; }
  function clamp(v,a,b){ a=a==null?0:a; b=b==null?1:b; return Math.max(a,Math.min(b,Number(v)||0)); }
  function smoother(v){ var t=clamp(v); return t*t*t*(t*(t*6-15)+10); }

  function font(ctx,size){ ctx.font='400 '+Math.max(8,size)+'px "Anton","Arial Black",system-ui,sans-serif'; }
  function fit(ctx,text,requested,maxWidth){
    var size=Math.max(40,Math.min(220,Number(requested)||150));
    font(ctx,size);
    while(size>40 && ctx.measureText(text).width>maxWidth){ size-=2; font(ctx,size); }
    return size;
  }
  function pseudoRand(n){ var x=Math.sin(n*12.9898)*43758.5453; return x-Math.floor(x); }

  window.kefeEffects.glitch = function(ctx,w,h,style,lines,time){
    var active=u.activeLine(lines,time);
    if(!active) return;
    var text=String(active.line.text||'').trim().toUpperCase();
    if(!text) return;
    var lineProg=u.lineProgress(active.line,time);
    if(lineProg.opacity<=0.01) return;
    var sp=style.fxSpacing||1;
    var B=u.textBlock(ctx,text,{font:font,tag:'glitch',size:style.fontSize,w:w*0.92,h:h*0.92,lh:1.0*sp,maxLines:3});
    var tStart=Number(active.line.time)||0;
    var tEnd=Math.max(tStart+0.5,Number(active.line.endTime)||tStart+3);
    var elapsed=time-tStart, remaining=tEnd-time;
    var chaos=Math.max(clamp(1-elapsed/0.55),clamp(1-remaining/0.35)*0.7);
    var k=B.size/150;
    var fr=Math.floor(time*30);
    font(ctx,B.size);
    ctx.save();
    ctx.textAlign='center'; ctx.textBaseline='middle';
    var jitterX=(pseudoRand(Math.floor(time*40))*2-1)*6*chaos*k;
    var jitterY=(pseudoRand(Math.floor(time*40)+3)*2-1)*3*chaos*k;
    B.rows.forEach(function(row,i){
      var x=w/2, y=h/2-B.blockH/2+(i+0.5)*B.rowH;
      if(chaos>0.05){
        var gx=(pseudoRand(fr+i*5)*2-1)*14*chaos*k, gy=(pseudoRand(fr+7+i)*2-1)*6*chaos*k;
        ctx.save(); ctx.globalAlpha=lineProg.opacity*0.5*chaos; ctx.fillStyle='rgba(255,255,255,0.9)';
        ctx.translate(x+gx,y+gy); ctx.transform(1,0,-0.25*chaos,1,0,0); ctx.fillText(row,0,0); ctx.restore();
      }
      var off=(2+6*chaos)*k;
      ctx.save(); ctx.globalAlpha=lineProg.opacity;
      ctx.save(); ctx.globalCompositeOperation='lighter';
      ctx.fillStyle='rgba(255,0,60,'+(0.7*chaos+0.15)+')'; ctx.fillText(row,x-off+jitterX,y+jitterY);
      ctx.fillStyle='rgba(0,220,255,'+(0.7*chaos+0.15)+')'; ctx.fillText(row,x+off-jitterX,y-jitterY);
      ctx.restore();
      ctx.fillStyle=style.textColor||'#FFFFFF'; ctx.fillText(row,x+jitterX*0.25,y+jitterY*0.2);
      ctx.restore();
    });
    ctx.restore();
  };
})();
