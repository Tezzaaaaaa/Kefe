/* KEFE Visualiser — Trailer lyric effect.
   Lyrics are finger-written into condensation on a cold, rain-streaked window. */
(function(){
  'use strict';
  var u=window.kefeEffectUtils;
  window.kefeEffects=window.kefeEffects||{};
  if(!u){console.error('[lyric-trailer] requires core.js');return;}

  function clamp(v,a,b){return Math.max(a,Math.min(b,Number(v)||0));}
  function smooth(v){var t=clamp(v,0,1);return t*t*(3-2*t);}
  function font(ctx,size){ctx.font='500 '+size+'px "Segoe Print","Bradley Hand","Comic Sans MS",cursive';}
  function width(ctx,text,tracking){
    var chars=Array.from(text||'');if(!chars.length)return 0;
    return chars.reduce(function(n,ch){return n+ctx.measureText(ch).width;},0)+Math.max(0,chars.length-1)*tracking;
  }
  function wrap(ctx,text,maxWidth,tracking){
    var words=String(text||'').trim().split(/\s+/).filter(Boolean),rows=[],row='';
    words.forEach(function(word){
      var candidate=row?row+' '+word:word;
      if(row&&width(ctx,candidate,tracking)>maxWidth){rows.push(row);row=word;}
      else row=candidate;
    });
    if(row)rows.push(row);
    return rows;
  }
  function seeded(n){var x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);}

  function drawRain(ctx,w,h,time){
    var bg=ctx.createLinearGradient(0,0,w,h);
    bg.addColorStop(0,'#182a38');bg.addColorStop(.48,'#344956');bg.addColorStop(1,'#101e2a');
    ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);

    // Soft, defocused lights beyond the wet glass.
    for(var i=0;i<11;i++){
      var x=seeded(i+2)*w,y=h*(.12+seeded(i+39)*.72),r=Math.max(8,Math.min(w,h)*(.018+seeded(i+72)*.035));
      ctx.save();ctx.globalAlpha=.10+seeded(i+90)*.12;
      ctx.fillStyle=['#f0c98d','#9dc8dd','#e9e4d8','#718fa2'][i%4];
      ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.restore();
    }
    // Fine rain trails on the exterior surface.
    ctx.save();ctx.lineCap='round';
    for(var j=0;j<Math.max(32,Math.round(w/12));j++){
      var rx=seeded(j+120)*w,ry=((seeded(j+250)*h+time*(18+seeded(j+390)*35))%(h+40))-20;
      var len=7+seeded(j+510)*Math.min(34,h*.09);
      ctx.strokeStyle=j%4===0?'rgba(218,236,244,.25)':'rgba(8,22,31,.23)';
      ctx.lineWidth=.5+seeded(j+610)*1.1;
      ctx.beginPath();ctx.moveTo(rx,ry);ctx.bezierCurveTo(rx-1,ry+len*.35,rx+1.5,ry+len*.7,rx+.5,ry+len);ctx.stroke();
    }
    // Cold frost gathers at the pane edges, while the centre stays clear enough to write.
    var frost=ctx.createLinearGradient(0,0,w,0);
    frost.addColorStop(0,'rgba(221,237,242,.23)');frost.addColorStop(.12,'rgba(221,237,242,.07)');
    frost.addColorStop(.5,'rgba(221,237,242,0)');frost.addColorStop(.88,'rgba(221,237,242,.07)');frost.addColorStop(1,'rgba(221,237,242,.23)');
    ctx.fillStyle=frost;ctx.fillRect(0,0,w,h);
    // Condensation haze, brighter around the centre where the finger clears the glass.
    var fog=ctx.createRadialGradient(w*.5,h*.48,Math.min(w,h)*.05,w*.5,h*.5,Math.max(w,h)*.76);
    fog.addColorStop(0,'rgba(218,232,235,.24)');fog.addColorStop(.55,'rgba(193,213,220,.12)');fog.addColorStop(1,'rgba(4,14,22,.36)');
    ctx.fillStyle=fog;ctx.fillRect(0,0,w,h);
    // Condensation beads; deterministic placement prevents visual flicker.
    for(var k=0;k<Math.max(20,Math.round(w/20));k++){
      var dx=seeded(k+710)*w,dy=seeded(k+810)*h,dr=.6+seeded(k+910)*Math.max(1,Math.min(w,h)*.0035);
      ctx.beginPath();ctx.fillStyle='rgba(223,240,245,'+(.10+seeded(k+1010)*.18)+')';ctx.arc(dx,dy,dr,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.strokeStyle='rgba(245,250,251,.18)';ctx.lineWidth=.6;ctx.arc(dx-dr*.18,dy-dr*.18,dr*.72,Math.PI*1.05,Math.PI*1.8);ctx.stroke();
    }
    ctx.restore();
  }

  function drawLetter(ctx,ch,x,y,size,progress,alpha){
    if(!ch||ch===' ')return;
    var jitter=Math.sin(x*.071+y*.037)*size*.012;
    ctx.save();ctx.translate(x,y+jitter);
    // Reveal each glyph progressively, so the writing head advances through the stroke.
    var glyphWidth=ctx.measureText(ch).width;
    ctx.beginPath();ctx.rect(0,-size,glyphWidth*clamp(progress,0,1)+.5,size*1.35);ctx.clip();
    // Dark wet edge where a fingertip has pushed condensation aside.
    ctx.globalAlpha=alpha;
    ctx.lineJoin='round';ctx.lineCap='round';
    ctx.font=ctx.font;
    ctx.strokeStyle='rgba(18,38,48,.62)';ctx.lineWidth=Math.max(1.8,size*.055);
    ctx.strokeText(ch,0,0);
    // Cool, translucent cleared-glass trail with a subtle edge highlight.
    ctx.fillStyle='rgba(225,242,244,.78)';ctx.shadowColor='rgba(219,244,250,.45)';ctx.shadowBlur=size*.075;
    ctx.fillText(ch,0,0);
    ctx.shadowBlur=0;ctx.strokeStyle='rgba(250,255,255,.42)';ctx.lineWidth=Math.max(.55,size*.012);ctx.strokeText(ch,0,0);
    ctx.restore();
  }

  window.kefeEffects.trailer=function(ctx,w,h,style,lines,time){
    var active=u.activeLine(lines,time);if(!active)return;
    var raw=String((active.line&&active.line.text)||'').trim().replace(/\s+/g,' ');
    if(!raw)return;
    var start=Number(active.line.time)||0;
    var end=Math.max(start+.45,Number(active.line.endTime)||start+3);
    var p=clamp((time-start)/(end-start),0,1);
    var enter=smooth(clamp((time-start)/.22,0,1));
    var exit=smooth(clamp((end-time)/.22,0,1));
    var alpha=enter*exit;if(alpha<=.005)return;

    ctx.save();
    ctx.globalCompositeOperation='source-over';ctx.filter='none';
    drawRain(ctx,w,h,time);
    var size=clamp(Math.min(w*.095,h*.19,Number(style.fontSize)||76),24,112);
    var tracking=size*.015, maxWidth=w*.82, rows=[];
    font(ctx,size);
    rows=wrap(ctx,raw,maxWidth,tracking);
    while(rows.length>4&&size>24){size-=2;tracking=size*.015;font(ctx,size);rows=wrap(ctx,raw,maxWidth,tracking);}
    var rowHeight=size*1.28,totalHeight=rows.length*rowHeight;
    var top=h*.5-totalHeight*.5+size*.34;
    var totalChars=rows.reduce(function(n,row){return n+Array.from(row).length;},0);
    // Handwriting has natural pauses: narrow strokes take less time than wide curves.
    var weights=[];
    rows.forEach(function(row){Array.from(row).forEach(function(ch){weights.push(ch===' '?1.8:('ilI.,!'.indexOf(ch)>=0?0.65:('MW@'.indexOf(ch)>=0?1.5:1)));});});
    var totalWeight=weights.reduce(function(a,b){return a+b;},0),target=p*totalWeight,used=0,index=0;
    ctx.textAlign='left';ctx.textBaseline='alphabetic';font(ctx,size);
    // A faint, still-condensed ghost impression is only visible just ahead of the finger.
    var allText=rows.join(' ');
    ctx.save();ctx.globalAlpha=alpha*.045;ctx.fillStyle='#e4f3f5';font(ctx,size);
    rows.forEach(function(row,ri){ctx.fillText(row,(w-width(ctx,row,tracking))*.5,top+ri*rowHeight);});
    ctx.restore();

    rows.forEach(function(row,ri){
      var rowWidth=width(ctx,row,tracking),x=(w-rowWidth)*.5,y=top+ri*rowHeight;
      var chars=Array.from(row),cursorX=x;
      chars.forEach(function(ch){
        var cw=ctx.measureText(ch).width;
        var weight=weights[index]||1;
        var reveal=clamp((target-used)/weight,0,1);
        if(ch!==' '&&reveal>0)drawLetter(ctx,ch,cursorX,y,size,reveal,alpha);
        if(reveal>0&&reveal<1){cursorX+=cw*reveal+tracking*reveal;}
        else cursorX+=cw+tracking;
        used+=weight;index++;
      });
    });

    // A small wet glint follows the writing head, like fresh moisture along the fingertip path.
    if(p<.995&&totalChars>0){
      var count=0,weightBefore=0,headX=w*.5,headY=top;
      var rowIndex=0,remaining=target;
      for(var ri=0;ri<rows.length;ri++){
        var rw=width(ctx,rows[ri],tracking),cx=(w-rw)*.5,cy=top+ri*rowHeight;
        var chars=Array.from(rows[ri]);
        for(var ci=0;ci<chars.length;ci++){
          var ch=chars[ci],cw=ctx.measureText(ch).width,wt=weights[count]||1;
          if(remaining<=wt){headX=cx+cw*clamp(remaining/wt,0,1);headY=cy-size*.30;rowIndex=ri;ri=rows.length;break;}
          remaining-=wt;cx+=cw+tracking;count++;
        }
      }
      ctx.save();ctx.globalAlpha=alpha*(.35+.3*Math.sin(time*8)**2);ctx.fillStyle='rgba(246,255,255,.92)';
      ctx.shadowColor='rgba(211,244,251,.8)';ctx.shadowBlur=size*.12;
      ctx.beginPath();ctx.ellipse(headX,headY,Math.max(1.2,size*.018),Math.max(1.5,size*.028),-.3,0,Math.PI*2);ctx.fill();ctx.restore();
    }
    ctx.restore();
  };
})();
