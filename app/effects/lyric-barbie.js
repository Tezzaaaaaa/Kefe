/* KEFE Visualiser — Barbie lyric effect.
   Bigger type. Deeper pink. Hero word scales up. Movie-title energy. */
(function(){
  'use strict';
  var u = window.kefeEffectUtils;
  window.kefeEffects = window.kefeEffects || {};
  if (!u) { console.error('[lyric-barbie] requires core.js'); return; }

  function clamp(v,a,b){ a=a==null?0:a; b=b==null?1:b; return Math.max(a,Math.min(b,Number(v)||0)); }
  function smoother(v){ var t=clamp(v); return t*t*t*(t*(t*6-15)+10); }
  function springy(v){ var t=clamp(v); if(t>=1)return 1; var c=3.6; var main=1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2); var wobble=Math.sin(t*Math.PI*3)*Math.pow(1-t,2)*0.03; return main+wobble; }

  var LINE_PALETTES = [
    ['#E91E8C','#FF4FA8','#FF7DC4','#C7137A','#FF9FD0'],
    ['#FF3EB5','#FF6BCB','#FFA8DD','#E02896','#FFB3E6'],
    ['#F02B94','#FF5BB0','#FF93CF','#D01A80','#FFADDE'],
    ['#FF4FA8','#FF7DC4','#FFAEDE','#E03B94','#FFC4EC'],
    ['#EA1E8C','#FF4FA8','#FF85C8','#C91C80','#FFA0D5']
  ];

  function setFont(ctx,size){ ctx.font='800 '+Math.max(28,size)+'px "Baloo 2","Fredoka","Inter Tight",system-ui,sans-serif'; }
  function setKickerFont(ctx,size){ ctx.font='700 '+Math.max(11,size)+'px "Inter Tight",system-ui,sans-serif'; }

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
    var size=Math.max(44,Math.min(220,Number(requested)||130));
    while(size>44){
      setFont(ctx,size);
      var gap=size*0.26;
      var rows=wrapWords(ctx,words,maxWidth,gap);
      if(rows.length<=2) return {size:size,rows:rows,gap:gap};
      size-=2;
    }
    setFont(ctx,size);
    var gap2=size*0.26;
    return {size:size,rows:wrapWords(ctx,words,maxWidth,gap2),gap:gap2};
  }
  function fitRowWithSizes(ctx,rowWords,sizes,maxWidth){
    var gap=Math.max(12,(sizes[0]||40)*0.22);
    var scale=1;
    function measure(s){
      var w=0;
      for(var i=0;i<rowWords.length;i++){
        setFont(ctx,sizes[i]*s);
        w+=ctx.measureText(rowWords[i].text).width;
        if(i<rowWords.length-1) w+=gap*s;
      }
      return w;
    }
    var width=measure(scale);
    while(width>maxWidth && scale>0.4){ scale-=0.02; width=measure(scale); }
    return {scale:scale,width:width,gap:gap*scale};
  }
  function tiltFor(n){ var x=Math.sin(n*12.9898)*43758.5453; return ((x-Math.floor(x))-0.5)*0.05; }

  function parseHex(c){
    var h=String(c||'').replace('#','');
    if(h.length===3) h=h.split('').map(function(ch){return ch+ch;}).join('');
    if(h.length!==6) return {r:255,g:62,b:181};
    return {r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4,6),16)};
  }
  function lighten(c,amt){ var p=parseHex(c); function f(v){return Math.round(v+(255-v)*amt);} return 'rgb('+f(p.r)+','+f(p.g)+','+f(p.b)+')'; }
  function darken(c,amt){ var p=parseHex(c); function f(v){return Math.round(v*(1-amt));} return 'rgb('+f(p.r)+','+f(p.g)+','+f(p.b)+')'; }
  function toRgba(c,a){ var p=parseHex(c); return 'rgba('+p.r+','+p.g+','+p.b+','+a+')'; }

  function drawBarbieWord(ctx,text,x,y,size,color,style){
    var outline=style.barbieOutline==null?11:style.barbieOutline;
    var outlineColor=style.barbieOutlineColor||'#FFFFFF';
    var glow=style.barbieGlow==null?0.6:style.barbieGlow;
    var shadowY=style.barbieShadowY==null?0.18:style.barbieShadowY;
    var shadowOn=style.barbieShadow!==false;

    if(shadowOn){ ctx.save(); ctx.fillStyle=darken(color,0.42); ctx.globalAlpha*=0.9; ctx.fillText(text,x,y+size*shadowY); ctx.restore(); }
    if(glow>0){
      ctx.save(); ctx.shadowColor=toRgba(color,0.95); ctx.shadowBlur=size*1.4*glow; ctx.fillStyle=color; ctx.globalAlpha*=0.45; ctx.fillText(text,x,y); ctx.restore();
      ctx.save(); ctx.shadowColor=toRgba(lighten(color,0.35),1); ctx.shadowBlur=size*0.45*glow; ctx.fillStyle=color; ctx.fillText(text,x,y); ctx.restore();
    }
    if(outline>0){
      ctx.save(); ctx.fillStyle=outlineColor;
      var r=outline*(size/96);
      for(var a=0;a<Math.PI*2;a+=Math.PI/8){
        ctx.fillText(text,x+Math.cos(a)*r,y+Math.sin(a)*r);
        ctx.fillText(text,x+Math.cos(a+Math.PI/16)*r*0.7,y+Math.sin(a+Math.PI/16)*r*0.7);
      }
      ctx.restore();
    }
    ctx.save();
    var grad=ctx.createLinearGradient(0,y-size*0.65,0,y+size*0.65);
    grad.addColorStop(0,lighten(color,0.65));
    grad.addColorStop(0.22,lighten(color,0.25));
    grad.addColorStop(0.5,color);
    grad.addColorStop(1,darken(color,0.25));
    ctx.fillStyle=grad; ctx.fillText(text,x,y);
    ctx.restore();
  }
  function drawSparkle(ctx,cx,cy,size,color,alpha){
    if(alpha<=0.02) return;
    ctx.save(); ctx.globalAlpha=alpha; ctx.fillStyle=color; ctx.translate(cx,cy);
    ctx.beginPath();
    for(var i=0;i<4;i++){
      var a=i*Math.PI/2; var outer=size, inner=size*0.2;
      ctx.lineTo(Math.cos(a)*outer,Math.sin(a)*outer);
      var a2=a+Math.PI/4;
      ctx.lineTo(Math.cos(a2)*inner,Math.sin(a2)*inner);
    }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  function rand(n,seed){ var x=Math.sin(n*12.9898+seed*78.233)*43758.5453; return x-Math.floor(x); }
  function drawAmbientGlitter(ctx,w,h,time,density,colorA,colorB){
    var count=Math.round((density==null?0.5:density)*60);
    if(count<=0) return;
    ctx.save(); ctx.globalCompositeOperation='lighter';
    for(var i=0;i<count;i++){
      var px=rand(i*3+1,1)*w, py=rand(i*3+2,2)*h, phase=rand(i*3+3,3)*Math.PI*2, speed=0.6+rand(i,4)*1.8;
      var tw=Math.sin(time*speed*Math.PI+phase);
      var a=Math.max(0,tw)*0.75;
      if(a<0.05) continue;
      var size=1.5+rand(i,5)*2.5;
      ctx.globalAlpha=a;
      ctx.fillStyle=rand(i,6)>0.5?colorA:colorB;
      ctx.fillRect(px-size*0.5,py-0.5,size,1);
      ctx.fillRect(px-0.5,py-size*0.5,1,size);
    }
    ctx.restore();
  }
  function extractKicker(line){ var m=/\[kicker:(.+?)\]/i.exec(String((line&&line.text)||'')); return m?m[1]:null; }
  function cleanText(t){ return String(t||'').replace(/\[kicker:[^\]]+\]/gi,'').replace(/\s+/g,' ').trim(); }

  window.kefeEffects.barbie = function(ctx,w,h,style,lines,time){
    var active=u.activeLine(lines,time);
    if(!active) return;
    var text=cleanText(active.line.text);
    if(!text) return;
    var words=u.wordsFor(active.line,active.next);
    if(!words.length) return;

    var prepared=fit(ctx,words,style.fontSize,w*0.9);
    var baseSize=prepared.size;
    var lineIndex=Array.isArray(lines)?Math.max(0,lines.indexOf(active.line)):0;
    var palette=(Array.isArray(style.barbiePalette)&&style.barbiePalette.length)?style.barbiePalette:LINE_PALETTES[lineIndex%LINE_PALETTES.length];

    var heroFlatIdx=0, bestLen=-1, flat=0;
    prepared.rows.forEach(function(row){ row.words.forEach(function(w){
      var len=w.text.replace(/[^\p{L}\p{N}]/gu,'').length;
      if(len>bestLen){ bestLen=len; heroFlatIdx=flat; }
      flat++;
    });});

    var heroBoost=style.barbieHeroBoost==null?1.35:style.barbieHeroBoost;
    var flatIdx=0;
    var rowsWithSizes=prepared.rows.map(function(row){
      var sizes=row.words.map(function(){
        var s=(flatIdx===heroFlatIdx)?baseSize*heroBoost:baseSize*0.72;
        flatIdx++;
        return s;
      });
      return {row:row,sizes:sizes};
    });
    var rowHeights=rowsWithSizes.map(function(r){ return Math.max.apply(null,r.sizes)*1.15; });
    var totalHeight=rowHeights.reduce(function(a,b){return a+b;},0);
    var cursorY=h*0.5-totalHeight/2;
    var lineProg=u.lineProgress(active.line,time);
    var start=Number(active.line.time)||0;
    var end=Math.max(start+0.4,Number(active.line.endTime)||start+3);
    var exitFade=clamp((end-time)/Math.min(0.4,(end-start)*0.2));

    ctx.save();
    ctx.textAlign='left';
    ctx.textBaseline='middle';

    drawAmbientGlitter(ctx,w,h,time,style.barbieGlitter==null?0.55:style.barbieGlitter,palette[0],palette[2]);

    var kickerText=extractKicker(active.line);
    if(kickerText){
      var kElapsed=time-start;
      if(kElapsed>0){
        var kSize=Math.max(12,Math.min(22,baseSize*0.14));
        setKickerFont(ctx,kSize);
        var tracking=kSize*0.45;
        var txt=kickerText.toUpperCase();
        var kW=0;
        for(var ci=0;ci<txt.length;ci++) kW+=ctx.measureText(txt[ci]).width+tracking;
        kW-=tracking;
        var kAlpha=smoother(clamp(kElapsed/0.3))*lineProg.opacity*exitFade*0.85;
        var kDrop=(1-smoother(clamp(kElapsed/0.4)))*kSize*1.2;
        ctx.globalAlpha=kAlpha;
        ctx.fillStyle=palette[1];
        var kx=w/2-kW/2;
        var ky=cursorY-kSize*1.4+kDrop;
        for(var ci2=0;ci2<txt.length;ci2++){ ctx.fillText(txt[ci2],kx,ky); kx+=ctx.measureText(txt[ci2]).width+tracking; }
        ctx.globalAlpha=1;
      }
    }

    flatIdx=0;
    rowsWithSizes.forEach(function(rr,rowIdx){
      var row=rr.row, sizes=rr.sizes;
      var rowHeight=rowHeights[rowIdx];
      var y=cursorY+rowHeight*0.5;
      var fitInfo=fitRowWithSizes(ctx,row.words,sizes,w*0.92);
      var finalSizes=sizes.map(function(s){return s*fitInfo.scale;});
      var finalGap=fitInfo.gap;
      var rowWidth=fitInfo.width;
      var x=w/2-rowWidth/2;

      row.words.forEach(function(word,i){
        var thisIdx=flatIdx++;
        var size=finalSizes[i];
        setFont(ctx,size);
        var wordWidth=ctx.measureText(word.text).width;
        var centerX=x+wordWidth/2;
        var isHero=thisIdx===heroFlatIdx;

        if(time<Number(word.time)){ x+=wordWidth+finalGap; return; }

        var t=clamp((time-word.time)/0.5);
        var scale=springy(t);
        var tilt=(style.barbieTilt!==false && !isHero)?tiltFor(thisIdx+Math.floor(Number(word.time)*100)):0;
        var color=palette[thisIdx%palette.length];

        ctx.save();
        ctx.globalAlpha=lineProg.opacity*exitFade;
        ctx.translate(centerX,y);
        ctx.rotate(tilt);
        ctx.scale(scale,scale);
        ctx.translate(-wordWidth/2,0);

        drawBarbieWord(ctx,word.text,0,0,size,color,style);

        if(isHero){
          var sparkleT=(time-Number(word.time))-0.35;
          if(sparkleT>0){
            var sparkleA=clamp(1-sparkleT/0.9);
            var sSize=size*0.3;
            drawSparkle(ctx,wordWidth+sSize*0.3,-size*0.42,sSize,'#FFFFFF',sparkleA*0.95);
            drawSparkle(ctx,-sSize*0.4,size*0.3,sSize*0.6,'#FFFFFF',sparkleA*0.7);
            drawSparkle(ctx,wordWidth*0.4,-size*0.55,sSize*0.45,'#FFFFFF',sparkleA*0.6);
          }
        }
        ctx.restore();
        x+=wordWidth+finalGap;
      });
      cursorY+=rowHeight;
    });
    ctx.restore();
  };
})();
