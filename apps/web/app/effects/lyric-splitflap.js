/* KEFE Visualiser — Split-Flap lyric effect.
   Mechanical character cells with deterministic rolling flaps. */
(function(){
  'use strict';
  var u = window.kefeEffectUtils;
  window.kefeEffects = window.kefeEffects || {};
  if (!u) { console.error('[lyric-splitflap] requires core.js'); return; }
  function clamp(v,a,b){ a=a==null?0:a; b=b==null?1:b; return Math.max(a,Math.min(b,Number(v)||0)); }
  function smoother(v){ var t=clamp(v); return t*t*t*(t*(t*6-15)+10); }

  function font(ctx,size){ ctx.font='900 '+Math.max(12,size)+'px "Big Shoulders Stencil Display","Arial Narrow",system-ui,sans-serif'; }
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

  function drawBoard(ctx,w,h,style,line,next,time,phase){
    var active={line:line,next:next};
    var text=String(active.line.text||'').trim().toUpperCase();
    if(!text) return;

    var maxW=w*0.86, size=Math.min(220,Number(style.fontSize)||120), rowsArr, cols;
    function wrapCells(sz){
      var cw=sz*0.58, gp=sz*0.07;
      cols=Math.max(1,Math.floor((maxW+gp)/(cw+gp)));
      var out=[], cur='', tooLong=false;
      text.split(/\s+/).forEach(function(wd){
        if(wd.length>cols) tooLong=true;
        var t=cur?cur+' '+wd:wd;
        if(cur&&t.length>cols){ out.push(cur); cur=wd; } else cur=t;
      });
      if(cur) out.push(cur);
      return {rows:out,tooLong:tooLong};
    }
    var wr=wrapCells(size);
    while((wr.tooLong||wr.rows.length>5||wr.rows.length*size*1.12>h*0.8)&&size>14){ size-=2; wr=wrapCells(size); }
    if(wr.tooLong){ // last resort: hard-break long words
      var flat=[], cur2=''; text.split('').forEach(function(ch){ if(cur2.length>=cols){ flat.push(cur2.trim()); cur2=''; } cur2+=ch; }); if(cur2.trim()) flat.push(cur2.trim());
      wr={rows:flat};
    }
    rowsArr=wr.rows;
    font(ctx,size);
    var lineProg={opacity:phase.alpha};
    if(lineProg.opacity<=0.01) return;
    var map=u.charMap(rowsArr,u.wordsFor(active.line,active.next));

    var start=Number(active.line.time)||0;
    var elapsed=Math.max(0,time-start);
    var gap=size*0.07;
    var cellWidth=size*0.58;
    var cellHeight=size*1.02;
    var rowStep=size*1.12;
    var yTop=h*0.5-(rowsArr.length-1)*rowStep/2;
    var color=style.textColor||'#FFFFFF';

    ctx.save();
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.globalAlpha=lineProg.opacity;

    var gi=0;
    rowsArr.forEach(function(rowText,ri){
    var y=yTop+ri*rowStep;
    var rowW=rowText.length*cellWidth+Math.max(0,rowText.length-1)*gap;
    var x0=w/2-rowW/2;
    var cells=map[ri]||[];
    for(var k=0;k<rowText.length;k++){
      var i=gi++;
      var target=rowText[k];
      if(target===' ') continue;
      var x=x0+cellWidth/2+k*(cellWidth+gap);
      /* Each cell flips when ITS word is sung: stagger across the first half of the word, three quick flaps (blank -> A -> B -> letter),
         finishing inside the word's duration so the full word is readable by the time it ends. */
      var cell=cells[k]||{word:{time:Number(active.line.time)||0,endTime:(Number(active.line.time)||0)+1},j:0,n:1};
      var wd=cell.word, wdur=Math.max(0.06,wd.endTime-wd.time);
      var cs=wd.time+wdur*0.5*(cell.j/Math.max(1,cell.n));
      var fd=Math.min(0.56,Math.max(0.2,wd.endTime-cs));
      var el=time-cs, FLAPS=3;
      var settled=el>=fd, blank=el<0;
      var cp=0, current=target, next=target;
      if(blank){ current=' '; next=' '; }
      else if(!settled){
        var per=fd/FLAPS, c=Math.min(FLAPS-1,Math.floor(el/per));
        cp=Math.min(1,(el-c*per)/per);
        var L=function(n){ return n<=0?' ':n>=FLAPS?target:ALPHABET[Math.floor(Math.abs(Math.sin((i+1)*91+n*37.7))*ALPHABET.length)%ALPHABET.length]; };
        current=L(c); next=L(c+1);
      }
      var p=settled?1:cp;

      // Mechanical dark cell.
      ctx.save();
      ctx.fillStyle='rgba(0,0,0,0.72)';
      ctx.fillRect(x-cellWidth/2,y-cellHeight/2,cellWidth,cellHeight);
      ctx.strokeStyle='rgba(255,255,255,0.16)';
      ctx.lineWidth=Math.max(1,size*0.012);
      ctx.strokeRect(x-cellWidth/2,y-cellHeight/2,cellWidth,cellHeight);
      ctx.restore();

      /* Real split-flap mechanics: the static upper half already shows the NEXT letter, the static lower half still shows the CURRENT one;
         the current letter's upper flap falls (first half of the flap), then the next letter's lower flap lands (second half). */
      var flip=smoother(p), animating=!settled&&!blank;
      var half=function(ch,top,sy){
        ctx.save();
        ctx.beginPath();
        ctx.rect(x-cellWidth/2,top?y-cellHeight/2:y,cellWidth,cellHeight/2);
        ctx.clip();
        ctx.translate(x,y); ctx.scale(1,Math.max(0.001,sy)); ctx.translate(-x,-y);
        ctx.fillStyle=color;
        ctx.fillText(ch,x,y);
        ctx.restore();
      };
      if(!animating){
        half(target===' '?' ':(blank?' ':target),true,1);
        half(target===' '?' ':(blank?' ':target),false,1);
      } else {
        half(next,true,1);                                   // upper half revealed behind the falling flap
        half(current,false,1);                               // lower half not yet replaced
        if(flip<0.5) half(current,true,1-flip*2);            // upper flap falling toward the hinge
        else half(next,false,(flip-0.5)*2);                  // lower flap swinging down to land
      }

      // Centre hinge/slot.
      ctx.save();
      ctx.fillStyle='rgba(0,0,0,0.72)';
      ctx.fillRect(x-cellWidth/2,y-Math.max(1,size*0.018),cellWidth,Math.max(2,size*0.035));
      ctx.restore();
    }
    });

    ctx.restore();
  }

  window.kefeEffects.splitflap = function(ctx,w,h,style,lines,time){
    var stack=u.lineStack(lines,time,0.10,0.18);
    for(var i=0;i<stack.length;i++) drawBoard(ctx,w,h,style,stack[i].line,stack[i].next,time,stack[i]);
  };

})();