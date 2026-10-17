/* KEFE Visualiser — Trailer lyric effect.
   Cold rain-covered glass; lyrics clear the condensation as if traced by a fingertip. */
(function(){
  'use strict';
  var u=window.kefeEffectUtils;
  window.kefeEffects=window.kefeEffects||{};
  if(!u){console.error('[lyric-trailer] requires core.js');return;}

  var fogLayer=null,fogCtx=null,maskLayer=null,maskCtx=null,layerW=0,layerH=0;
  function clamp(v,a,b){return Math.max(a,Math.min(b,Number(v)||0));}
  function smooth(v){var t=clamp(v,0,1);return t*t*(3-2*t);}
  function seeded(n){var x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);}
  function ensureLayers(w,h){
    if(fogLayer&&maskLayer&&layerW===w&&layerH===h)return;
    layerW=w;layerH=h;
    fogLayer=document.createElement('canvas');maskLayer=document.createElement('canvas');
    fogLayer.width=maskLayer.width=Math.max(1,Math.ceil(w));
    fogLayer.height=maskLayer.height=Math.max(1,Math.ceil(h));
    fogCtx=fogLayer.getContext('2d');maskCtx=maskLayer.getContext('2d');
  }
  function font(ctx,size,style){
    style=style||{};
    var typography=window.KEFE_TYPE&&window.KEFE_TYPE.effects&&window.KEFE_TYPE.effects.trailer;
    var family=style.fontFamily||style.family||style.typeface||(typeof style.font==='string'?style.font:'')||(typography&&typography.family)||'sans-serif';
    family=String(family).trim()||'sans-serif';
    // Preserve supplied CSS font stacks; quote a single family so spaces and punctuation remain valid.
    if(family.indexOf(',')<0&&family.charAt(0)!=='"'&&family.charAt(0)!=="'")family=JSON.stringify(family);
    var weight=style.fontWeight||style.weight||(typography&&typography.weight)||500;
    var fontStyle=style.fontStyle||style.style||'normal';
    ctx.font=fontStyle+' '+weight+' '+size+'px '+family+', sans-serif';
  }
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
    if(row)rows.push(row);return rows;
  }
  function drawExterior(ctx,w,h,time){
    var bg=ctx.createLinearGradient(0,0,w,h);
    bg.addColorStop(0,'#101c26');bg.addColorStop(.38,'#263c49');bg.addColorStop(.72,'#172b38');bg.addColorStop(1,'#0b151e');
    ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
    // Distant city lights softened by the glass and the cold night air.
    for(var i=0;i<15;i++){
      var x=seeded(i+2)*w,y=h*(.1+seeded(i+39)*.78),r=Math.max(5,Math.min(w,h)*(.009+seeded(i+72)*.026));
      ctx.save();ctx.globalAlpha=.12+seeded(i+90)*.13;ctx.filter='blur('+(r*.18)+'px)';
      ctx.fillStyle=['#f0c98d','#9dc8dd','#e9e4d8','#7199b1'][i%4];
      ctx.beginPath();ctx.ellipse(x,y,r*1.5,r,seeded(i+17)*.5,0,Math.PI*2);ctx.fill();ctx.restore();
    }
    // Vertical rainfall on the outside face of the pane; streak speed varies naturally.
    ctx.save();ctx.lineCap='round';
    for(var j=0;j<Math.max(48,Math.round(w/9));j++){
      var rx=seeded(j+120)*w,rate=15+seeded(j+390)*49;
      var ry=((seeded(j+250)*h+time*rate)%(h+55))-25;
      var len=5+seeded(j+510)*Math.min(44,h*.12),bend=(seeded(j+610)-.5)*4;
      ctx.strokeStyle=j%5===0?'rgba(218,238,247,.29)':'rgba(3,13,20,.28)';
      ctx.lineWidth=.45+seeded(j+710)*1.45;
      ctx.beginPath();ctx.moveTo(rx,ry);ctx.bezierCurveTo(rx+bend,ry+len*.35,rx-bend*.35,ry+len*.72,rx+bend*.2,ry+len);ctx.stroke();
      if(j%7===0){ctx.fillStyle='rgba(222,241,248,.25)';ctx.beginPath();ctx.ellipse(rx+bend*.2,ry+len,ctx.lineWidth*.8,ctx.lineWidth*1.8,0,0,Math.PI*2);ctx.fill();}
    }
    ctx.restore();
  }
  function drawFog(ctx,w,h,time){
    ctx.clearRect(0,0,w,h);
    var base=ctx.createLinearGradient(0,0,w,h);
    base.addColorStop(0,'rgba(191,216,226,.20)');base.addColorStop(.38,'rgba(202,224,231,.31)');
    base.addColorStop(.68,'rgba(177,205,215,.25)');base.addColorStop(1,'rgba(116,151,167,.22)');
    ctx.fillStyle=base;ctx.fillRect(0,0,w,h);
    var haze=ctx.createRadialGradient(w*.48,h*.48,Math.min(w,h)*.04,w*.5,h*.5,Math.max(w,h)*.72);
    haze.addColorStop(0,'rgba(225,239,242,.24)');haze.addColorStop(.56,'rgba(204,223,230,.11)');haze.addColorStop(1,'rgba(7,20,29,.28)');
    ctx.fillStyle=haze;ctx.fillRect(0,0,w,h);
    // Frost crystals are restrained to the edges, keeping the writing area legible.
    var frost=ctx.createLinearGradient(0,0,w,0);
    frost.addColorStop(0,'rgba(230,245,249,.29)');frost.addColorStop(.08,'rgba(218,237,243,.12)');
    frost.addColorStop(.22,'rgba(218,237,243,0)');frost.addColorStop(.78,'rgba(218,237,243,0)');
    frost.addColorStop(.92,'rgba(218,237,243,.12)');frost.addColorStop(1,'rgba(230,245,249,.29)');
    ctx.fillStyle=frost;ctx.fillRect(0,0,w,h);
    // Fine, stationary condensation beads give the fog a physical surface.
    for(var k=0;k<Math.max(34,Math.round(w/13));k++){
      var dx=seeded(k+710)*w,dy=seeded(k+810)*h,dr=.55+seeded(k+910)*Math.max(1,Math.min(w,h)*.0032);
      ctx.beginPath();ctx.fillStyle='rgba(236,248,251,'+(.08+seeded(k+1010)*.16)+')';ctx.arc(dx,dy,dr,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.strokeStyle='rgba(250,255,255,.22)';ctx.lineWidth=.65;
      ctx.arc(dx-dr*.22,dy-dr*.22,dr*.72,Math.PI*1.05,Math.PI*1.8);ctx.stroke();
    }
    // Condensation streaks creep downward at different speeds.
    ctx.save();ctx.lineCap='round';
    for(var q=0;q<Math.max(9,Math.round(w/75));q++){
      var sx=seeded(q+1100)*w,sy=((seeded(q+1200)*h+time*(2+seeded(q+1300)*5))%(h+35))-15;
      var sh=12+seeded(q+1400)*Math.min(60,h*.16);
      ctx.strokeStyle='rgba(220,241,247,'+(.07+seeded(q+1500)*.1)+')';ctx.lineWidth=.6+seeded(q+1600)*1.8;
      ctx.beginPath();ctx.moveTo(sx,sy);ctx.bezierCurveTo(sx+1,sy+sh*.35,sx-1,sy+sh*.75,sx+.5,sy+sh);ctx.stroke();
    }
    ctx.restore();
  }
  function drawDroplets(ctx,w,h,time){
    // Drawn above the cleared lettering: raised beads catch a cool edge highlight.
    for(var k=0;k<Math.max(22,Math.round(w/23));k++){
      var x=seeded(k+1710)*w;
      var y=((seeded(k+1810)*h+time*(1.3+seeded(k+1910)*4))%(h+30))-15;
      var r=.7+seeded(k+2010)*Math.max(1,Math.min(w,h)*.004);
      ctx.save();ctx.globalAlpha=.24+seeded(k+2110)*.28;
      var g=ctx.createRadialGradient(x-r*.32,y-r*.42,.2,x,y,r*1.4);
      g.addColorStop(0,'rgba(255,255,255,.8)');g.addColorStop(.32,'rgba(211,237,246,.38)');
      g.addColorStop(1,'rgba(28,64,82,.08)');
      ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(x,y,r*.82,r*1.25,-.16,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='rgba(248,254,255,.42)';ctx.lineWidth=.55;
      ctx.beginPath();ctx.arc(x-r*.15,y-r*.2,r*.68,Math.PI*1.05,Math.PI*1.72);ctx.stroke();ctx.restore();
    }
  }
  function strokeGlyph(ctx,ch,x,y,size,progress,alpha){
    if(!ch||ch===' ')return;
    var jitter=Math.sin(x*.071+y*.037)*size*.009;
    ctx.save();ctx.translate(x,y+jitter);
    var gw=ctx.measureText(ch).width;
    ctx.beginPath();ctx.rect(-1,-size*1.08,Math.max(.1,gw*clamp(progress,0,1)+1),size*1.42);ctx.clip();
    ctx.globalAlpha=alpha;ctx.lineJoin='round';ctx.lineCap='round';
    // The cleared track is slightly irregular and darker at its damp edges.
    ctx.strokeStyle='rgba(13,34,45,.78)';ctx.lineWidth=Math.max(2,size*.075);ctx.strokeText(ch,0,0);
    ctx.strokeStyle='rgba(231,246,249,.30)';ctx.lineWidth=Math.max(1,size*.028);ctx.strokeText(ch,0,0);
    ctx.fillStyle='rgba(228,244,247,.88)';ctx.shadowColor='rgba(230,249,252,.28)';ctx.shadowBlur=size*.035;
    ctx.fillText(ch,0,0);ctx.restore();
  }
  function render(ctx,w,h,style,lines,time){
    if(!(w>0&&h>0))return;
    ensureLayers(w,h);
    ctx.save();ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.filter='none';
    drawExterior(ctx,w,h,time);
    drawFog(fogCtx,w,h,time);

    var active=u.activeLine(lines,time),raw='',rows=[],size=0,tracking=0,top=0,rowHeight=0,alpha=0,p=0;
    if(active&&active.line){
      raw=String(active.line.text||'').trim().replace(/\s+/g,' ');
      var start=Number(active.line.time)||0,end=Math.max(start+.45,Number(active.line.endTime)||start+3);
      p=clamp((time-start)/(end-start),0,1);
      alpha=smooth(clamp((time-start)/.16,0,1))*smooth(clamp((end-time)/.20,0,1));
    }
    if(raw&&alpha>.002){
      size=clamp(Math.min(w*.09,h*.17,Number(style&&style.fontSize)||76),22,112);
      tracking=size*.012;font(fogCtx,size,style);rows=wrap(fogCtx,raw,w*.80,tracking);
      while((rows.length>4||rows.some(function(r){return width(fogCtx,r,tracking)>w*.82;}))&&size>22){
        size-=2;tracking=size*.012;font(fogCtx,size,style);rows=wrap(fogCtx,raw,w*.80,tracking);
      }
      rowHeight=size*1.3;top=h*.5-(rows.length*rowHeight)*.5+size*.34;
      var weights=[],totalChars=0;
      rows.forEach(function(row){
        Array.from(row).forEach(function(ch){weights.push(ch===' '?1.9:('ilI.,!'.indexOf(ch)>=0?.65:('MW@'.indexOf(ch)>=0?1.45:1)));totalChars++;});
      });
      var totalWeight=weights.reduce(function(a,b){return a+b;},0)||1,target=p*totalWeight,used=0,index=0;
      // Remove condensation only where the lyric has actually been written, exposing the exterior through the letters.
      maskCtx.clearRect(0,0,w,h);maskCtx.textAlign='left';maskCtx.textBaseline='alphabetic';font(maskCtx,size,style);
      rows.forEach(function(row,ri){
        var x=(w-width(maskCtx,row,tracking))*.5,y=top+ri*rowHeight;
        Array.from(row).forEach(function(ch){
          var cw=maskCtx.measureText(ch).width,wt=weights[index]||1;
          var reveal=clamp((target-used)/wt,0,1);
          if(ch!==' '&&reveal>0){
            maskCtx.save();maskCtx.beginPath();maskCtx.rect(x-1,y-size*1.08,Math.max(.1,cw*reveal+1),size*1.42);maskCtx.clip();
            maskCtx.fillStyle='#fff';maskCtx.fillText(ch,x,y);maskCtx.restore();
          }
          x+=cw+tracking;used+=wt;index++;
        });
      });
      fogCtx.save();fogCtx.globalCompositeOperation='destination-out';fogCtx.drawImage(maskLayer,0,0,w,h);fogCtx.restore();
      ctx.drawImage(fogLayer,0,0,w,h);

      // Freshly displaced moisture makes each stroke visible against the still-fogged pane.
      var headX=w*.5,headY=top,remaining=target,count=0,headFound=false;
      font(ctx,size,style);ctx.textAlign='left';ctx.textBaseline='alphabetic';
      rows.forEach(function(row,ri){
        var rowWidth=width(ctx,row,tracking),x=(w-rowWidth)*.5,y=top+ri*rowHeight;
        Array.from(row).forEach(function(ch){
          var cw=ctx.measureText(ch).width,wt=weights[count]||1,reveal=clamp((target-(count?weights.slice(0,count).reduce(function(a,b){return a+b;},0):0))/wt,0,1);
          if(ch!==' '&&reveal>0)strokeGlyph(ctx,ch,x,y,size,reveal,alpha);
          if(!headFound&&remaining<=wt){headX=x+cw*clamp(remaining/wt,0,1);headY=y-size*.34;headFound=true;}
          remaining-=wt;x+=cw+tracking;count++;
        });
      });
      if(p<.998&&totalChars>0&&headFound){
        // Tiny contact glint with a soft moisture halo, not a cursor or visible hand.
        ctx.save();ctx.globalAlpha=alpha*(.35+.2*Math.sin(time*7)**2);
        ctx.fillStyle='rgba(247,255,255,.94)';ctx.shadowColor='rgba(210,244,252,.85)';ctx.shadowBlur=size*.14;
        ctx.beginPath();ctx.ellipse(headX,headY,Math.max(1.2,size*.016),Math.max(1.4,size*.026),-.24,0,Math.PI*2);ctx.fill();ctx.restore();
      }
    }
    // Pane reflections and raised droplets remain in front of the cleared writing.
    ctx.save();
    var reflection=ctx.createLinearGradient(0,0,w,h);
    reflection.addColorStop(0,'rgba(255,255,255,.045)');reflection.addColorStop(.25,'rgba(255,255,255,0)');
    reflection.addColorStop(.68,'rgba(210,237,245,.025)');reflection.addColorStop(1,'rgba(0,0,0,.10)');
    ctx.fillStyle=reflection;ctx.fillRect(0,0,w,h);drawDroplets(ctx,w,h,time);ctx.restore();
    ctx.restore();
  }
  window.kefeEffects.trailer=render;
})();
