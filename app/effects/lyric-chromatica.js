/* KEFE Visualiser — Chromatica lyric effect.
   Memesique typeface, pink on green plate, poster stack with line entrance. */
(function(){
  'use strict';
  var u = window.kefeEffectUtils;
  window.kefeEffects = window.kefeEffects || {};
  if (!u) { console.error('[lyric-chromatica] requires core.js'); return; }
  function clamp(v,a,b){ a=a==null?0:a; b=b==null?1:b; return Math.max(a,Math.min(b,Number(v)||0)); }
  function smoother(v){ var t=clamp(v); return t*t*t*(t*(t*6-15)+10); }

  var SALMON='#FA7B7B';
  var GREEN='#1E6B4E';
  var BLACK='#000000';

  function setFont(ctx,size){ ctx.font='400 '+Math.max(28,size)+'px "Memesique","Anton","Archivo Black","Arial Black",system-ui,sans-serif'; }

  function wrapWords(ctx,words,maxWidth,gapPx){
    var rows=[], row=[], rowWidth=0;
    for(var i=0;i<words.length;i++){
      var word=words[i];
      var width=ctx.measureText(word.text).width;
      var proposed=row.length?rowWidth+gapPx+width:width;
      if(row.length && proposed>maxWidth){ rows.push({words:row,width:rowWidth}); row=[word]; rowWidth=width; }
      else { row.push(word); rowWidth=proposed; }
    }
    if(row.length) rows.push({words:row,width:rowWidth});
    return rows;
  }
  function fit(ctx,words,requested,maxWidth){
    var size=Math.max(40,Math.min(220,Number(requested)||130));
    while(size>40){
      setFont(ctx,size);
      var gap=size*0.10;
      var rows=wrapWords(ctx,words,maxWidth,gap);
      if(rows.length<=4) return {size:size,rows:rows,gap:gap};
      size-=3;
    }
    setFont(ctx,size);
    var gap2=size*0.10;
    return {size:size,rows:wrapWords(ctx,words,maxWidth,gap2),gap:gap2};
  }

  window.kefeEffects.chromatica = function(ctx,w,h,style,lines,time){
    var active=u.activeLine(lines,time);
    if(!active) return;
    var text=String(active.line.text||'').trim();
    if(!text) return;
    var words=u.wordsFor(active.line,active.next);
    if(!words.length) return;
    var prepared=fit(ctx,words,style.fontSize,w*0.86);
    var size=prepared.size;
    var rowHeight=size*0.92;
    var totalH=prepared.rows.length*rowHeight;
    var top=h*0.5-totalH/2+rowHeight/2;
    var lineProg=u.lineProgress(active.line,time);
    if(lineProg.opacity<=0.01) return;

    ctx.save();
    ctx.textAlign='center'; ctx.textBaseline='middle';

    // colour plate — a soft green rectangle behind the text
    var pad=size*0.5;
    var blockW=Math.max.apply(null,prepared.rows.map(function(r){return r.width;}))+pad*2;
    var blockH=totalH+pad*1.2;
    var bx=w/2-blockW/2, by=h*0.5-blockH/2;
    ctx.save();
    ctx.globalAlpha=lineProg.opacity*0.85;
    ctx.fillStyle=GREEN;
    ctx.fillRect(bx,by,blockW,blockH);
    ctx.restore();

    setFont(ctx,size);
    ctx.fillStyle=SALMON;

    prepared.rows.forEach(function(row,rowIdx){
      var y=top+rowIdx*rowHeight;
      var x=w/2-row.width/2;
      row.words.forEach(function(word){
        var wordWidth=ctx.measureText(word.text).width;
        var elapsed=time-(Number(word.time)||0);
        if(elapsed<0){ x+=wordWidth+prepared.gap; return; }
        var t=clamp(elapsed/0.7);
        var enter=smoother(t);
        var rise=(1-enter)*size*0.6;
        var blurAmt=(1-enter)*12;
        ctx.save();
        ctx.globalAlpha=lineProg.opacity*enter;
        ctx.translate(x+wordWidth/2, y+rise);
        ctx.scale(1.04-0.04*enter,1.04-0.04*enter);
        ctx.translate(-(x+wordWidth/2), -(y+rise));
        if(blurAmt>0.5){ ctx.filter='blur('+blurAmt.toFixed(1)+'px)'; }
        ctx.fillStyle=SALMON;
        ctx.fillText(word.text, x+wordWidth/2, y+rise);
        ctx.filter='none';
        ctx.restore();
        x+=wordWidth+prepared.gap;
      });
    });

    // small "OFFICIAL" corner tick — the poster feel
    ctx.save();
    ctx.globalAlpha=lineProg.opacity*0.7;
    ctx.fillStyle=SALMON;
    ctx.font='700 11px "Courier New",monospace';
    ctx.textAlign='left';
    ctx.fillText('CHROMATICA — OFFICIAL', bx+10, by+blockH-10);
    ctx.restore();

    ctx.restore();
  };
})();
