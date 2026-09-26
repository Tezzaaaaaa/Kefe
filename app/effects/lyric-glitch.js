/* KEFE Visualiser — Glitch lyric effect.
   Chunky sans with skew/blur/chromatic glitch on entry, then settles. */
(function(){
  'use strict';
  var u = window.kefeEffectUtils;
  window.kefeEffects = window.kefeEffects || {};
  if (!u) { console.error('[lyric-glitch] requires core.js'); return; }
  function clamp(v,a,b){ a=a==null?0:a; b=b==null?1:b; return Math.max(a,Math.min(b,Number(v)||0)); }
  function smoother(v){ var t=clamp(v); return t*t*t*(t*(t*6-15)+10); }

  function font(ctx,size){ ctx.font='400 '+Math.max(18,size)+'px "Special Elite","Courier Prime",system-ui,sans-serif'; }
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
    var size=fit(ctx,text,style.fontSize||150,w*0.88);
    var lineProg=u.lineProgress(active.line,time);
    if(lineProg.opacity<=0.01) return;
    var tStart=Number(active.line.time)||0;
    var tEnd=Math.max(tStart+0.5,Number(active.line.endTime)||tStart+3);
    var elapsed=time-tStart;
    var remaining=tEnd-time;
    // glitch intensity: strong at entry, strong at exit, mild in middle
    var entryChaos=clamp(1-elapsed/0.55);
    var exitChaos=clamp(1-remaining/0.35);
    var chaos=Math.max(entryChaos,exitChaos*0.7);

    font(ctx,size);
    var x=w/2, y=h*0.5;

    // ghost pass (behind)
    if(chaos>0.05){
      var ghostOffX=(pseudoRand(Math.floor(time*30))*2-1)*14*chaos;
      var ghostOffY=(pseudoRand(Math.floor(time*30)+7)*2-1)*6*chaos;
      ctx.save();
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.globalAlpha=lineProg.opacity*0.5*chaos;
      ctx.fillStyle='rgba(255,255,255,0.9)';
      ctx.translate(x+ghostOffX, y+ghostOffY);
      ctx.transform(1,0,-0.25*chaos,1,0,0);
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }

    // red/cyan split
    var redOff=(2+6*chaos), cyanOff=(2+6*chaos);
    var jitterX=(pseudoRand(Math.floor(time*40))*2-1)*6*chaos;
    var jitterY=(pseudoRand(Math.floor(time*40)+3)*2-1)*3*chaos;

    ctx.save();
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.globalAlpha=lineProg.opacity;
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    ctx.fillStyle='rgba(255,0,60,'+(0.7*chaos+0.15)+')';
    ctx.fillText(text, x-redOff+jitterX, y+jitterY);
    ctx.fillStyle='rgba(0,220,255,'+(0.7*chaos+0.15)+')';
    ctx.fillText(text, x+cyanOff-jitterX, y-jitterY);
    ctx.restore();
    // main
    ctx.fillStyle=style.textColor||'#FFFFFF';
    ctx.fillText(text, x+jitterX*0.25, y+jitterY*0.2);
    ctx.restore();
  };
})();
