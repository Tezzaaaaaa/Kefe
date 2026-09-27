/* KEFE Visualiser — Split-Flap lyric effect.
   Mechanical character cells with deterministic rolling flaps. */
(function(){
  'use strict';
  var u = window.kefeEffectUtils;
  window.kefeEffects = window.kefeEffects || {};
  if (!u) { console.error('[lyric-splitflap] requires core.js'); return; }
  function clamp(v,a,b){ a=a==null?0:a; b=b==null?1:b; return Math.max(a,Math.min(b,Number(v)||0)); }
  function smoother(v){ var t=clamp(v); return t*t*t*(t*(t*6-15)+10); }

  function font(ctx,size){ ctx.font='900 '+Math.max(18,size)+'px "Big Shoulders Stencil Display","Arial Narrow",system-ui,sans-serif'; }
  function fit(ctx,text,requested,maxWidth){
    var size=Math.max(40,Math.min(220,Number(requested)||120));
    while(size>40){
      font(ctx,size);
      var total=0;
      for(var i=0;i<text.length;i++) total+=Math.max(ctx.measureText(text[i]).width,size*0.58);
      total+=Math.max(0,text.length-1)*size*0.07;
      if(total<=maxWidth) return size;
      size-=2;
    }
    font(ctx,size);
    return size;
  }
  var ALPHABET='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  window.kefeEffects.splitflap = function(ctx,w,h,style,lines,time){
    var active=u.activeLine(lines,time);
    if(!active) return;
    var text=String(active.line.text||'').trim().toUpperCase();
    if(!text) return;

    var size=fit(ctx,text,style.fontSize||120,w*0.88);
    font(ctx,size);
    var lineProg=u.lineProgress(active.line,time);
    if(lineProg.opacity<=0.01) return;

    var start=Number(active.line.time)||0;
    var elapsed=Math.max(0,time-start);
    var gap=size*0.07;
    var cellWidth=size*0.58;
    var totalWidth=text.length*cellWidth+Math.max(0,text.length-1)*gap;
    var x0=w/2-totalWidth/2;
    var y=h*0.5;
    var cellHeight=size*1.02;
    var color=style.textColor||'#FFFFFF';

    ctx.save();
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.globalAlpha=lineProg.opacity;

    for(var i=0;i<text.length;i++){
      var target=text[i];
      var x=x0+cellWidth/2+i*(cellWidth+gap);
      var charStart=i*0.055;
      var p=clamp((elapsed-charStart)/0.72);
      var settled=p>=1;
      var frame=Math.floor(Math.max(0,elapsed-charStart)*16);
      var current=target;
      var next=target;

      if(!settled){
        current=ALPHABET[Math.floor(Math.abs(Math.sin((i+1)*91+frame*13))*ALPHABET.length)%ALPHABET.length];
        next=ALPHABET[(Math.floor(Math.abs(Math.sin((i+1)*137+frame*17))*ALPHABET.length)+1)%ALPHABET.length];
      }

      // Mechanical dark cell.
      ctx.save();
      ctx.fillStyle='rgba(0,0,0,0.72)';
      ctx.fillRect(x-cellWidth/2,y-cellHeight/2,cellWidth,cellHeight);
      ctx.strokeStyle='rgba(255,255,255,0.16)';
      ctx.lineWidth=Math.max(1,size*0.012);
      ctx.strokeRect(x-cellWidth/2,y-cellHeight/2,cellWidth,cellHeight);
      ctx.restore();

      var flip=smoother(p);
      var topChar=settled?target:current;
      var bottomChar=settled?target:next;

      // Upper flap folds down.
      ctx.save();
      ctx.beginPath();
      ctx.rect(x-cellWidth/2,y-cellHeight/2,cellWidth,cellHeight/2);
      ctx.clip();
      var topScale=settled?1:Math.max(0.08,1-flip);
      ctx.save();
      ctx.translate(x,y);
      ctx.scale(1,topScale);
      ctx.translate(-x,-y);
      ctx.fillStyle=color;
      ctx.fillText(topChar,x,y-cellHeight*0.25);
      ctx.restore();
      ctx.restore();

      // Lower flap folds up to meet it.
      ctx.save();
      ctx.beginPath();
      ctx.rect(x-cellWidth/2,y,cellWidth,cellHeight/2);
      ctx.clip();
      var bottomScale=settled?1:Math.max(0.08,flip);
      ctx.save();
      ctx.translate(x,y);
      ctx.scale(1,bottomScale);
      ctx.translate(-x,-y);
      ctx.fillStyle=color;
      ctx.fillText(bottomChar,x,y+cellHeight*0.25);
      ctx.restore();
      ctx.restore();

      // Centre hinge/slot.
      ctx.save();
      ctx.fillStyle='rgba(0,0,0,0.72)';
      ctx.fillRect(x-cellWidth/2,y-Math.max(1,size*0.018),cellWidth,Math.max(2,size*0.035));
      ctx.restore();
    }

    ctx.restore();
  };
})();