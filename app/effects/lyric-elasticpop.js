/* KEFE Visualiser — Elastic Pop lyric effect.
   Each word punches in with a spring/overshoot scale, staggered word-by-word. */
(function(){
  'use strict';
  var u = window.kefeEffectUtils;
  window.kefeEffects = window.kefeEffects || {};
  if (!u) { console.error('[lyric-elasticpop] requires core.js'); return; }
  function clamp(v,a,b){ a=a==null?0:a; b=b==null?1:b; return Math.max(a,Math.min(b,Number(v)||0)); }

  function elasticOut(t,amplitude,period){
    amplitude=amplitude==null?1.08:amplitude; period=period==null?0.42:period;
    if(t<=0) return 0; if(t>=1) return 1;
    var s=period/4;
    return amplitude*Math.pow(2,-10*t)*Math.sin((t-s)*(2*Math.PI)/period)+1;
  }
  function setElasticFont(ctx,size){ ctx.font='900 '+Math.max(18,size)+'px "Inter Tight","Arial Black",system-ui,sans-serif'; }
  function wrapWords(ctx,words,maxWidth,gapPx){
    var rows=[], row=[], rowWidth=0;
    for(var i=0;i<words.length;i++){
      var w=words[i]; var width=ctx.measureText(w.text).width;
      var proposed=row.length?rowWidth+gapPx+width:width;
      if(row.length && proposed>maxWidth){ rows.push({words:row,width:rowWidth}); row=[w]; rowWidth=width; }
      else { row.push(w); rowWidth=proposed; }
    }
    if(row.length) rows.push({words:row,width:rowWidth});
    return rows;
  }
  function fit(ctx,words,requested,maxWidth){
    var size=Math.max(30,Math.min(140,Number(requested)||84));
    while(size>30){
      setElasticFont(ctx,size);
      var gap=size*0.30;
      var rows=wrapWords(ctx,words,maxWidth,gap);
      if(rows.length<=2) return {size:size,rows:rows,gap:gap};
      size-=2;
    }
    setElasticFont(ctx,size);
    var gap2=size*0.30;
    return {size:size,rows:wrapWords(ctx,words,maxWidth,gap2),gap:gap2};
  }

  window.kefeEffects.elasticpop = function(ctx,w,h,style,lines,time){
    var active=u.activeLine(lines,time);
    if(!active) return;
    var text=String(active.line.text||'').trim();
    if(!text) return;
    var words=u.wordsFor(active.line,active.next);
    if(!words.length) return;
    var prepared=fit(ctx,words,style.fontSize,w*0.82);
    var size=prepared.size;
    var rowHeight=size*1.24;
    var totalHeight=prepared.rows.length*rowHeight;
    var top=h*0.5-totalHeight/2+rowHeight/2;
    var lineProg=u.lineProgress(active.line,time);
    var color=style.elasticpopColor||style.textColor||'#FFFFFF';
    var popDuration=0.42;

    ctx.save();
    ctx.textAlign='left'; ctx.textBaseline='middle';
    setElasticFont(ctx,size);
    ctx.fillStyle=color;
    ctx.globalAlpha=lineProg.opacity;

    prepared.rows.forEach(function(row,rowIdx){
      var y=top+rowIdx*rowHeight;
      var x=w/2-row.width/2;
      row.words.forEach(function(word){
        var wordWidth=ctx.measureText(word.text).width;
        var centerX=x+wordWidth/2;
        if(time<Number(word.time)){ x+=wordWidth+prepared.gap; return; }
        var t=clamp((time-word.time)/popDuration);
        var scale=time>=Number(word.time)+popDuration?1:elasticOut(t);
        var rise=(1-clamp(t/0.6))*size*0.18;
        ctx.save();
        ctx.translate(centerX,y-rise);
        ctx.scale(scale,scale);
        ctx.translate(-centerX,-(y-rise));
        ctx.fillText(word.text,x,y-rise);
        ctx.restore();
        x+=wordWidth+prepared.gap;
      });
    });
    ctx.restore();
  };
})();
