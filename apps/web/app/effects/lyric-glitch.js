/* KEFE Visualiser — Glitch lyric effect.
   Special Elite with sliced displacement, chromatic separation and digital damage. */
(function(){
  'use strict';
  var u = window.kefeEffectUtils;
  window.kefeEffects = window.kefeEffects || {};
  if (!u) { console.error('[lyric-glitch] requires core.js'); return; }
  function clamp(v,a,b){ a=a==null?0:a; b=b==null?1:b; return Math.max(a,Math.min(b,Number(v)||0)); }
  function smoother(v){ var t=clamp(v); return t*t*t*(t*(t*6-15)+10); }

  function font(ctx,size){ ctx.font='400 '+Math.max(12,size)+'px "Special Elite","Courier New",monospace'; }
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
    var lay=u.layoutText(ctx,text,{setFont:font,size:Math.min(220,style.fontSize||150),minSize:16,maxWidth:w*0.8,maxHeight:h*0.82,lineHeight:1.12,maxLines:5});
    var size=lay.size;
    var lineProg=u.lineProgress(active.line,time);
    if(lineProg.opacity<=0.01) return;
    var startTime=Number(active.line.time)||0;
    var end=Math.max(startTime+0.5,Number(active.line.endTime)||startTime+3);
    var elapsed=Math.max(0,time-startTime),remaining=Math.max(0,end-time);
    var entry=1-smoother(elapsed/0.30),exit=smoother(1-clamp(remaining/0.24));
    var frame=Math.floor(time*30),x=w/2;
    // Real signal corruption is intermittent: a clean, readable base interrupted by short tearing bursts.
    var cycle=Math.floor(elapsed*2.4),burstPhase=(elapsed*2.4)%1;
    var burst=pseudoRand(cycle*17)>.58&&burstPhase<.22?Math.sin(Math.PI*clamp(burstPhase/.22)):0;
    var chaos=clamp(Math.max(entry,exit,burst*.88));
    var y0=h*0.5-(lay.lines.length-1)*lay.lineH/2;
    font(ctx,size);
    ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.globalAlpha=lineProg.opacity;
    lay.lines.forEach(function(txt,li){
      var y=y0+li*lay.lineH;
      font(ctx,size);
      var textWidth=ctx.measureText(txt).width;
      // Clean text is the visual anchor; corruption should never make the lyric unreadable.
      ctx.save();
      ctx.globalAlpha=lineProg.opacity*(1-burst*.10);
      ctx.fillStyle=style.textColor||'#F4F7FF';
      ctx.shadowColor='rgba(0,220,255,0.14)';ctx.shadowBlur=size*.018;
      ctx.fillText(txt,x,y);ctx.restore();
      if(chaos>0.035){
        var chroma=(2+size*.035+size*.065*chaos);
        ctx.save();ctx.globalCompositeOperation='screen';
        ctx.globalAlpha=lineProg.opacity*(.12+.28*chaos);
        ctx.fillStyle='#FF3EA5';ctx.fillText(txt,x-chroma,y);
        ctx.fillStyle='#36E7FF';ctx.fillText(txt,x+chroma,y);
        ctx.restore();
        // Uneven horizontal slices, with gaps and independent displacement like a damaged signal.
        var sliceCount=8;
        for(var i=0;i<sliceCount;i++){
          var seed=frame*31+li*101+i*17;
          var r=pseudoRand(seed);
          if(r<.36-chaos*.14) continue;
          var sliceY=y-size*.56+i*(size*1.12/sliceCount);
          var sliceH=Math.max(1,size*(.035+pseudoRand(seed+5)*.075));
          var dx=(pseudoRand(seed+9)*2-1)*(size*.025+size*.13*chaos);
          ctx.save();ctx.beginPath();ctx.rect(x-textWidth*.58,sliceY,textWidth*1.16,sliceH);ctx.clip();
          ctx.globalAlpha=lineProg.opacity*(.14+.48*chaos)*(.65+r*.35);
          ctx.fillStyle=(i%2===0)?'#FF3EA5':'#36E7FF';
          if(chaos>.55&&r>.78)ctx.filter='blur('+Math.max(.2,size*.008)+'px)';
          ctx.fillText(txt,x+dx,y);
          ctx.restore();
        }
        // Short dropout/scan tears are confined to the text zone, never full-screen noise.
        for(var j=0;j<4;j++){
          var tear=pseudoRand(frame*19+li*53+j*23);
          if(tear<.67-chaos*.22) continue;
          var tearW=Math.max(5,textWidth*(.05+tear*.17));
          var tearX=x+(pseudoRand(frame*29+li*41+j*7)*2-1)*(textWidth*.40);
          var tearY=y+(pseudoRand(frame*37+li*37+j*11)*2-1)*size*.52;
          ctx.save();ctx.globalAlpha=lineProg.opacity*(.16+.45*chaos);
          ctx.fillStyle=j%2?'rgba(245,250,255,.72)':'#36E7FF';
          ctx.fillRect(tearX,tearY,tearW,Math.max(1,size*.014));ctx.restore();
        }
      }
      // Faint scanline detail makes the stable state feel like a display, not a static text preset.
      if(li===0&&pseudoRand(Math.floor(elapsed*7))>.62){
        ctx.save();ctx.globalAlpha=lineProg.opacity*.12;ctx.fillStyle='#8BEFFF';
        ctx.fillRect(x-textWidth*.52,y-size*.43,textWidth*1.04,Math.max(1,size*.006));ctx.restore();
      }
    });
    ctx.restore();
  };
})();