/* KEFE Visualiser — Glitch lyric effect.
   Special Elite with sliced displacement, chromatic separation and digital damage. */
(function(){
  'use strict';
  var u = window.kefeEffectUtils;
  window.kefeEffects = window.kefeEffects || {};
  if (!u) { console.error('[lyric-glitch] requires core.js'); return; }
  function clamp(v,a,b){ a=a==null?0:a; b=b==null?1:b; return Math.max(a,Math.min(b,Number(v)||0)); }
  function smoother(v){ var t=clamp(v); return t*t*t*(t*(t*6-15)+10); }

  function font(ctx,size){ ctx.font='400 '+Math.max(18,size)+'px "Special Elite","Courier New",monospace'; }
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

    var size=fit(ctx,text,style.fontSize||150,w*0.86);
    var lineProg=u.lineProgress(active.line,time);
    if(lineProg.opacity<=0.01) return;

    var start=Number(active.line.time)||0;
    var end=Math.max(start+0.5,Number(active.line.endTime)||start+3);
    var elapsed=time-start;
    var remaining=end-time;
    var entryChaos=1-smoother(elapsed/0.42);
    var exitChaos=smoother(1-clamp(remaining/0.32));
    var chaos=clamp(Math.max(entryChaos,exitChaos));
    var frame=Math.floor(time*18);
    var x=w/2;
    var y=h*0.5;

    font(ctx,size);
    var textWidth=ctx.measureText(text).width;
    var sliceHeight=Math.max(8,size*0.11);

    ctx.save();
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.globalAlpha=lineProg.opacity;

    // Main text remains stable between damage bursts.
    ctx.fillStyle=style.textColor||'#FFFFFF';
    ctx.fillText(text,x,y);

    // Horizontal data slices: each band gets its own deterministic displacement.
    if(chaos>0.02){
      for(var i=0;i<9;i++){
        var r=pseudoRand(frame*31+i*17);
        if(r<0.28) continue;
        var sliceY=y-size*0.55+i*sliceHeight;
        var sliceOffset=(pseudoRand(frame*47+i*9)*2-1)*(8+size*0.10)*chaos;
        var sliceWidth=textWidth+size*0.18;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x-sliceWidth/2,sliceY,sliceWidth,sliceHeight);
        ctx.clip();
        ctx.globalAlpha=lineProg.opacity*(0.45+0.35*r)*chaos;
        ctx.fillStyle=(i%2===0)?'rgba(255,0,70,0.95)':'rgba(0,220,255,0.95)';
        ctx.fillText(text,x+sliceOffset,y);
        ctx.restore();
      }

      // Chromatic edge separation.
      var chroma=(3+10*chaos);
      ctx.save();
      ctx.globalCompositeOperation='screen';
      ctx.globalAlpha=lineProg.opacity*(0.22+0.45*chaos);
      ctx.fillStyle='rgba(255,0,70,0.9)';
      ctx.fillText(text,x-chroma,y);
      ctx.fillStyle='rgba(0,220,255,0.9)';
      ctx.fillText(text,x+chroma,y);
      ctx.restore();

      // Small rectangular signal tears above/below the glyphs.
      for(var j=0;j<6;j++){
        var tear=pseudoRand(frame*19+j*23);
        if(tear<0.42) continue;
        var tearW=Math.max(8,textWidth*(0.04+tear*0.14));
        var tearX=x+(pseudoRand(frame*29+j*7)*2-1)*(textWidth*0.42);
        var tearY=y+(pseudoRand(frame*37+j*11)*2-1)*size*0.52;
        ctx.save();
        ctx.globalAlpha=lineProg.opacity*(0.25+0.55*chaos);
        ctx.fillStyle=j%2?'rgba(255,255,255,0.75)':'rgba(255,0,70,0.8)';
        ctx.fillRect(tearX,tearY,tearW,Math.max(2,size*0.018));
        ctx.restore();
      }
    }

    ctx.restore();
  };
})();