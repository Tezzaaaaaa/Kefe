/* KEFE Visualiser — Karaoke lyric effect.
   Word-by-word colour-fill sweep. Unsung words dim, current word fills left to right. */
(function(){
  'use strict';
  var u = window.kefeEffectUtils;
  window.kefeEffects = window.kefeEffects || {};
  if (!u) { console.error('[lyric-karaoke] requires core.js'); return; }
  function clamp(v,a,b){ a=a==null?0:a; b=b==null?1:b; return Math.max(a,Math.min(b,Number(v)||0)); }
  function smoother(v){ var t=clamp(v); return t*t*t*(t*(t*6-15)+10); }
  function bounce(v){ var t=clamp(v); return t<1?1-Math.pow(1-t,3)*Math.cos(t*6)*0.12:1; }

  function font(ctx,family,size,weight){ ctx.font=(weight||800)+' '+Math.max(14,size)+'px "'+(family||'Inter Tight')+'",system-ui,sans-serif'; }
  function layoutRows(ctx,words,family,size,maxWidth){
    var gap=Math.max(10,size*0.22);
    var rows=[], row=[], width=0;
    for(var i=0;i<words.length;i++){
      var word=words[i]; var wordWidth=ctx.measureText(word.text).width;
      var proposed=row.length?width+gap+wordWidth:wordWidth;
      if(row.length && proposed>maxWidth){ rows.push({words:row,width:width}); row=[]; width=0; }
      var item={text:word.text,time:word.time,endTime:word.endTime,width:wordWidth};
      row.push(item);
      width=row.length===1?wordWidth:width+gap+wordWidth;
    }
    if(row.length) rows.push({words:row,width:width});
    return {rows:rows,gap:gap};
  }

  /* Draw one karaoke line. phase: {enter,leave,alpha}. Words sweep with a soft edge across exactly word.time..word.endTime
     (Apple-Music/AMLL style) and the sung word lifts + scales on its own pulse, settling by its end. */
  function drawLine(ctx,w,h,style,line,next,time,phase){
    var words=u.wordsFor(line,next);
    if(!words.length) return;
    var family='Boogaloo';
    var maxWidth=w*0.84;
    var size=Math.max(16,Math.min(150,Number(style.fontSize)||84));
    var layout;
    while(true){
      font(ctx,family,size);
      layout=layoutRows(ctx,words,family,size,maxWidth);
      var widest=0; layout.rows.forEach(function(r){ widest=Math.max(widest,r.width); });
      if((layout.rows.length<=4 && widest<=maxWidth*1.001 && layout.rows.length*size*1.18<=h*0.8) || size<=16) break;
      size-=2;
    }
    var rows=layout.rows, gap=layout.gap;
    var rowHeight=size*1.18;
    var top=h*0.52-((rows.length-1)*rowHeight)/2;
    var inactiveColor=style.karaokeInactiveColor||'rgba(255,255,255,.38)';
    var fillColor=style.accentColor||'#3DE28A';
    /* whole-line motion: rise in from below, drift up and out when replaced */
    var lineY=(1-phase.enter)*size*0.32 - phase.leave*size*0.30;
    var lineScale=0.96+0.04*phase.enter;

    ctx.save();
    ctx.globalAlpha=Math.max(0,Math.min(1,phase.alpha));
    ctx.translate(w/2,h*0.52+lineY); ctx.scale(lineScale,lineScale); ctx.translate(-w/2,-h*0.52);
    ctx.textAlign='left'; ctx.textBaseline='middle';
    ctx.globalCompositeOperation='source-over';
    ctx.filter='none';
    font(ctx,family,size);

    rows.forEach(function(row,rowIndex){
      var x=(w-row.width)/2;
      var y=top+rowIndex*rowHeight;
      row.words.forEach(function(word){
        var wp=u.wordProgress(word,time,0.08);
        /* pre-roll: an unsung word eases up a hair just before it is sung; the pulse peaks mid-word and is gone by endTime */
        var lift=wp.pulse*size*0.055 + wp.pre*(1-wp.started)*size*0.012;
        var pop=1+wp.pulse*0.055;
        ctx.save();
        ctx.translate(x+word.width/2,y-lift);
        ctx.scale(pop,pop);
        ctx.translate(-word.width/2,0);
        ctx.fillStyle=u.sweepFill(ctx,0,word.width,wp.sweep,fillColor,inactiveColor,0.28);
        ctx.fillText(word.text,0,0);
        ctx.restore();
        x+=word.width+gap;
      });
    });
    ctx.restore();
  }

  window.kefeEffects.karaoke = function(ctx,w,h,style,lines,time){
    var stack=u.lineStack(lines,time);
    for(var i=0;i<stack.length;i++){
      var it=stack[i];
      drawLine(ctx,w,h,style,it.line,it.next,time,it);
    }
  };
})();
