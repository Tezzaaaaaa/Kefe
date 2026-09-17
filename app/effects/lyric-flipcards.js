/* KEFE Visualiser — Flip Cards lyric effect.
   Each word flips in around a vertical axis. Trailing ghost pass for depth. */
(function(){
  'use strict';
  var u = window.kefeEffectUtils;
  window.kefeEffects = window.kefeEffects || {};
  if (!u) { console.error('[lyric-flipcards] requires core.js'); return; }
  function clamp(v,a,b){ a=a==null?0:a; b=b==null?1:b; return Math.max(a,Math.min(b,Number(v)||0)); }
  function smoother(v){ var t=clamp(v); return t*t*t*(t*(t*6-15)+10); }
  function setFlipFont(ctx,size){ ctx.font='900 '+Math.max(18,size)+'px "Inter Tight","Arial Black",system-ui,sans-serif'; }
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
    var size=Math.max(30,Math.min(140,Number(requested)||82));
    while(size>30){
      setFlipFont(ctx,size);
      var gap=size*0.30;
      var rows=wrapWords(ctx,words,maxWidth,gap);
      if(rows.length<=2) return {size:size,rows:rows,gap:gap};
      size-=2;
    }
    setFlipFont(ctx,size);
    var gap2=size*0.30;
    return {size:size,rows:wrapWords(ctx,words,maxWidth,gap2),gap:gap2};
  }
  var FLIP_DURATION=0.34;

  window.kefeEffects.flipcards = function(ctx,w,h,style,lines,time){
    var active=u.activeLine(lines,time);
    if(!active) return;
    var text=String(active.line.text||'').trim();
    if(!text) return;
    var words=u.wordsFor(active.line,active.next);
    if(!words.length) return;
    var prepared=fit(ctx,words,style.fontSize,w*0.82);
    var size=prepared.size;
    var rowHeight=size*1.26;
    var totalHeight=prepared.rows.length*rowHeight;
    var top=h*0.5-totalHeight/2+rowHeight/2;
    var lineProg=u.lineProgress(active.line,time);
    var color=style.flipcardsColor||style.textColor||'#FFFFFF';
    var ghostColor=style.flipcardsAccent||'rgba(255,255,255,0.25)';
    ctx.save();
    ctx.textAlign='left'; ctx.textBaseline='middle';
    setFlipFont(ctx,size);
    ctx.globalAlpha=lineProg.opacity;
    prepared.rows.forEach(function(row,rowIdx){
      var y=top+rowIdx*rowHeight;
      var x=w/2-row.width/2;
      row.words.forEach(function(word){
        var wordWidth=ctx.measureText(word.text).width;
        var centerX=x+wordWidth/2;
        if(time<Number(word.time)){ x+=wordWidth+prepared.gap; return; }
        var t=clamp((time-word.time)/FLIP_DURATION);
        var angle=1-smoother(t);
        var scaleX=Math.max(0.02,Math.cos(angle*Math.PI/2));
        var skew=Math.sin(angle*Math.PI/2)*0.22;
        if(angle>0.05){
          ctx.save();
          ctx.translate(centerX,y);
          ctx.transform(scaleX*0.94,0,skew*0.6,1,0,0);
          ctx.translate(-centerX,-y);
          ctx.globalAlpha=lineProg.opacity*angle*0.35;
          ctx.fillStyle=ghostColor;
          ctx.fillText(word.text,x,y);
          ctx.restore();
        }
        ctx.save();
        ctx.translate(centerX,y);
        ctx.transform(scaleX,0,skew,1,0,0);
        ctx.translate(-centerX,-y);
        ctx.globalAlpha=lineProg.opacity*clamp((t-0.12)/0.2);
        ctx.fillStyle=color;
        ctx.fillText(word.text,x,y);
        ctx.restore();
        x+=wordWidth+prepared.gap;
      });
    });
    ctx.restore();
  };
})();
