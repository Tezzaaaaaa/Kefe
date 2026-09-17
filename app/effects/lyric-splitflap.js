/* KEFE Visualiser — Split-Flap lyric effect.
   Each letter rolls vertically through a strip of alternatives until it lands. */
(function(){
  'use strict';
  var u = window.kefeEffectUtils;
  window.kefeEffects = window.kefeEffects || {};
  if (!u) { console.error('[lyric-splitflap] requires core.js'); return; }
  function clamp(v,a,b){ a=a==null?0:a; b=b==null?1:b; return Math.max(a,Math.min(b,Number(v)||0)); }

  function font(ctx,size){ ctx.font='900 '+Math.max(18,size)+'px "Archivo Narrow","Arial Narrow",system-ui,sans-serif'; }
  function fit(ctx,text,requested,maxWidth){
    var size=Math.max(40,Math.min(220,Number(requested)||120));
    font(ctx,size);
    while(size>40 && ctx.measureText(text).width>maxWidth){ size-=2; font(ctx,size); }
    return size;
  }
  var ALPHABET='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  function pseudoRand(n){ var x=Math.sin(n*12.9898)*43758.5453; return x-Math.floor(x); }

  window.kefeEffects.splitflap = function(ctx,w,h,style,lines,time){
    var active=u.activeLine(lines,time);
    if(!active) return;
    var text=String(active.line.text||'').trim().toUpperCase();
    if(!text) return;
    var size=fit(ctx,text,style.fontSize||120,w*0.9);
    font(ctx,size);
    var lineProg=u.lineProgress(active.line,time);
    if(lineProg.opacity<=0.01) return;
    var start=Number(active.line.time)||0;
    var elapsed=time-start;

    // measure total width using the final text
    var charWidths=[];
    var totalWidth=0;
    for(var i=0;i<text.length;i++){
      var cw=ctx.measureText(text[i]).width;
      charWidths.push(cw);
      totalWidth+=cw;
    }
    var x0=w/2-totalWidth/2;
    var y=h*0.5;

    ctx.save();
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.globalAlpha=lineProg.opacity;
    var lineHeight=size;

    for(var i=0;i<text.length;i++){
      var target=text[i];
      var x=x0+charWidths[i]/2;
      // stagger: 0.1s between letters
      var charStart=i*0.08;
      var charElapsed=elapsed-charStart;
      // final resting position after ~1s per letter
      var landAt=charStart+0.9;
      // letters roll through a few alternatives before settling
      var rollSpeed=6+Math.random()*0.5; // per-letter
      var cur=target;
      var isSettled=elapsed>=landAt;
      if(!isSettled && charElapsed>0){
        // while rolling: cycle through random letters
        var framesIn=Math.floor(charElapsed*rollSpeed*2);
        cur=ALPHABET[Math.floor(pseudoRand(i*17+framesIn)*26)];
        // occasionally show target early to hint
        if(charElapsed>landAt-charStart-0.2 && pseudoRand(i+Math.floor(charElapsed*8))>0.5) cur=target;
      }
      // vertical offset while rolling
      var offset=0;
      if(!isSettled && charElapsed>0){
        offset=(pseudoRand(i+Math.floor(charElapsed*12))*2-1)*size*0.35;
      }
      // draw ghost letter above and below (the strip feel)
      ctx.save();
      ctx.globalAlpha=lineProg.opacity*0.22;
      ctx.fillStyle=style.textColor||'#FFFFFF';
      ctx.fillText(target, x, y-lineHeight*0.35+offset);
      ctx.fillText(target, x, y+lineHeight*0.35+offset);
      ctx.restore();
      // main character
      ctx.save();
      ctx.globalAlpha=lineProg.opacity;
      ctx.fillStyle=style.textColor||'#FFFFFF';
      ctx.fillText(cur, x, y+offset);
      ctx.restore();
      // horizontal rule between flips (window slot) — subtle
      ctx.save();
      ctx.globalAlpha=lineProg.opacity*0.08;
      ctx.fillStyle='#000';
      ctx.fillRect(x-charWidths[i]/2-1, y-size*0.52, charWidths[i]+2, 2);
      ctx.fillRect(x-charWidths[i]/2-1, y+size*0.5, charWidths[i]+2, 2);
      ctx.restore();
    }
    ctx.restore();
  };
})();
