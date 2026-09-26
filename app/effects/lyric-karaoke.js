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

  function font(ctx,family,size,weight){ ctx.font=(weight||800)+' '+Math.max(18,size)+'px "'+(family||'Inter Tight')+'",system-ui,sans-serif'; }
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

  window.kefeEffects.karaoke = function(ctx,w,h,style,lines,time){
    var active=u.activeLine(lines,time);
    if(!active) return;
    var words=u.wordsFor(active.line,active.next);
    if(!words.length) return;
    var family=style.kefeMotionFont||'Boogaloo';
    var maxWidth=w*0.82;
    var size=Math.max(34,Math.min(150,Number(style.fontSize)||84));
    var layout;
    while(size>30){
      font(ctx,family,size);
      layout=layoutRows(ctx,words,family,size,maxWidth);
      if(layout.rows.length<=3) break;
      size-=2;
    }
    var rows=layout.rows, gap=layout.gap;
    var rowHeight=size*1.18;
    var top=h*0.52-((rows.length-1)*rowHeight)/2;
    var inactiveColor=style.karaokeInactiveColor||'rgba(255,255,255,.38)';
    var fillColor=style.accentColor||'#3DE28A';
    var outlineColor=style.textColor||'#FFFFFF';

    ctx.save();
    ctx.textAlign='left'; ctx.textBaseline='middle';
    ctx.globalCompositeOperation='source-over';
    ctx.filter='none';
    font(ctx,family,size);

    rows.forEach(function(row,rowIndex){
      var x=(w-row.width)/2;
      var y=top+rowIndex*rowHeight;
      row.words.forEach(function(word){
        var wordStart=Number(word.time)||0;
        var wordEnd=Number(word.endTime)||wordStart+0.12;
        var fillFrac=time<wordStart?0:time>=wordEnd?1:smoother((time-wordStart)/(wordEnd-wordStart));
        var pop=time>=wordStart&&time<wordEnd?bounce((time-wordStart)/(wordEnd-wordStart)):1;

        ctx.save();
        ctx.translate(x+word.width/2,y);
        ctx.scale(pop,pop);
        ctx.translate(-word.width/2,0);

        ctx.globalAlpha=1;
        ctx.fillStyle=inactiveColor;
        ctx.fillText(word.text,0,0);

        if(fillFrac>0){
          ctx.save();
          ctx.beginPath();
          ctx.rect(0,-size,Math.max(1,word.width*fillFrac),size*2);
          ctx.clip();
          ctx.fillStyle=fillFrac>=1?fillColor:outlineColor;
          ctx.fillText(word.text,0,0);
          ctx.restore();
          if(fillFrac<1){
            ctx.save();
            ctx.beginPath();
            ctx.rect(0,-size,Math.max(1,word.width*fillFrac*0.94),size*2);
            ctx.clip();
            ctx.fillStyle=fillColor;
            ctx.fillText(word.text,0,0);
            ctx.restore();
          }
        }
        ctx.restore();
        x+=word.width+gap;
      });
    });
    ctx.restore();
  };
})();
