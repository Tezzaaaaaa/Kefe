/* KEFE Visualiser — Rain on Glass lyric effect.
   Modern rain-on-glass: many small beads, short crisp trails, occasional
   merging. Displacement composite for the droplets that fall across the
   lyric text. Ambient micro-drops drawn once to a static layer. */
(function(){
  'use strict';
  var u = window.kefeEffectUtils;
  window.kefeEffects = window.kefeEffects || {};
  if (!u) { console.error('[lyric-rain] requires core.js'); return; }

  function clamp(v,a,b){ a=a==null?0:a; b=b==null?1:b; return Math.max(a,Math.min(b,Number(v)||0)); }
  function smoother(v){ var t=clamp(v); return t*t*t*(t*(t*6-15)+10); }
  function rand(n,seed){ var x=Math.sin(n*12.9898+seed*78.233)*43758.5453; return x-Math.floor(x); }

  function createRainState(w,h,count){
    var drops=[], mist=[];
    for(var i=0;i<count;i++){
      drops.push({
        x:rand(i*11+1,1)*w, y:rand(i*11+2,2)*h,
        r:1.5+rand(i*11+3,3)*3.5,
        vy:6+rand(i*11+4,4)*22,
        wobble:rand(i*11+5,5)*Math.PI*2,
        wobbleSpeed:0.4+rand(i*11+6,6)*0.9,
        trailLen:8+rand(i*11+7,7)*30,
        trailWidth:1.2+rand(i*11+8,8)*1.8
      });
    }
    var mistCount=Math.round(count*4);
    for(var j=0;j<mistCount;j++){
      mist.push({
        x:rand(j*13+100,20)*w, y:rand(j*13+200,21)*h,
        r:0.6+rand(j*13+300,22)*1.4,
        a:0.15+rand(j*13+400,23)*0.35
      });
    }
    return {drops:drops,mist:mist,w:w,h:h};
  }
  function updateRain(state,dt,t){
    for(var i=0;i<state.drops.length;i++){
      var d=state.drops[i];
      d.x+=Math.sin(t*d.wobbleSpeed+d.wobble)*5*dt;
      d.y+=d.vy*dt;
      if(d.y-d.trailLen>state.h+20){
        d.y=-d.r-Math.random()*state.h*0.5;
        d.x=Math.random()*state.w;
        d.vy=6+Math.random()*22;
        d.trailLen=8+Math.random()*30;
      }
    }
  }

  var textBuffer=null,textCtx=null,rainBuffer=null,rainCtx=null,mistBuffer=null,mistCtx=null,composeBuffer=null,composeCtx=null;
  var lastW=0,lastH=0;

  function ensureBuffers(w,h){
    if(w===lastW&&h===lastH) return;
    lastW=w; lastH=h;
    function mk(freq){ var c=document.createElement('canvas'); c.width=w; c.height=h; return {c:c,x:c.getContext('2d',freq?{willReadFrequently:true}:undefined)}; }
    var t=mk(false); textBuffer=t.c; textCtx=t.x;
    var r=mk(true); rainBuffer=r.c; rainCtx=r.x;
    var m=mk(false); mistBuffer=m.c; mistCtx=m.x;
    var co=mk(false); composeBuffer=co.c; composeCtx=co.x;
  }

  function drawLyricToBuffer(ctx,w,h,style,active,words,time){
    ctx.clearRect(0,0,w,h);
    var size=Math.max(40,Math.min(180,Number(style.fontSize)||96));
    ctx.font='200 '+size+'px "Inter Tight",system-ui,sans-serif';
    var lineHeight=size*1.4;
    var gap=size*0.36;
    var maxW=w*0.82;
    var rows=[], row=[], rowW=0;
    for(var i=0;i<words.length;i++){
      var word=words[i]; var ww=ctx.measureText(word.text).width;
      var proposed=row.length?rowW+gap+ww:ww;
      if(row.length && proposed>maxW){ rows.push({words:row,width:rowW}); row=[word]; rowW=ww; }
      else { row.push(word); rowW=proposed; }
    }
    if(row.length) rows.push({words:row,width:rowW});
    var totalH=rows.length*lineHeight;
    var top=h*0.5-totalH/2+lineHeight/2;
    var lineProg=u.lineProgress(active.line,time);
    var color=style.rainColor||'#E0EAF4';
    ctx.save();
    ctx.textAlign='left'; ctx.textBaseline='middle';
    ctx.fillStyle=color;
    ctx.globalAlpha=lineProg.opacity;
    rows.forEach(function(r,ri){
      var y=top+ri*lineHeight;
      var x=w/2-r.width/2;
      r.words.forEach(function(word){
        var ww=ctx.measureText(word.text).width;
        var elapsed=time-(Number(word.time)||0);
        if(elapsed<0){ x+=ww+gap; return; }
        var wt=clamp(elapsed/0.9);
        ctx.globalAlpha=lineProg.opacity*smoother(wt);
        ctx.fillText(word.text,x,y);
        x+=ww+gap;
      });
    });
    ctx.restore();
  }

  function drawMistToBuffer(ctx,w,h,state){
    ctx.clearRect(0,0,w,h);
    for(var i=0;i<state.mist.length;i++){
      var m=state.mist[i];
      var g=ctx.createRadialGradient(m.x,m.y,0,m.x,m.y,m.r);
      g.addColorStop(0,'rgba(200,220,240,'+m.a+')');
      g.addColorStop(0.6,'rgba(140,170,200,'+(m.a*0.4)+')');
      g.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=g;
      ctx.beginPath();
      ctx.arc(m.x,m.y,m.r,0,Math.PI*2);
      ctx.fill();
    }
  }

  function drawRainToBuffer(ctx,w,h,state){
    ctx.clearRect(0,0,w,h);
    for(var i=0;i<state.drops.length;i++){
      var d=state.drops[i];
      var tg=ctx.createLinearGradient(d.x,d.y-d.trailLen,d.x,d.y);
      tg.addColorStop(0,'rgba(120,0,40,0)');
      tg.addColorStop(0.65,'rgba(170,20,60,0.6)');
      tg.addColorStop(1,'rgba(220,40,80,1)');
      ctx.fillStyle=tg;
      ctx.fillRect(d.x-d.trailWidth/2,d.y-d.trailLen,d.trailWidth,d.trailLen);
      var g=ctx.createRadialGradient(d.x,d.y,0,d.x,d.y,d.r*2.4);
      g.addColorStop(0,'rgba(255,255,180,1)');
      g.addColorStop(0.35,'rgba(230,180,80,0.75)');
      g.addColorStop(0.75,'rgba(140,90,20,0.3)');
      g.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=g;
      ctx.beginPath();
      ctx.arc(d.x,d.y,d.r*2.4,0,Math.PI*2);
      ctx.fill();
    }
  }

  var SAMPLE_STEP=3;
  var outImageData=null;

  function compositeDisplaced(w,h){
    var textData=textCtx.getImageData(0,0,w,h);
    var rainData=rainCtx.getImageData(0,0,w,h);
    if(!outImageData||outImageData.width!==w||outImageData.height!==h){
      outImageData=composeCtx.createImageData(w,h);
    }
    var out=outImageData;
    var td=textData.data, rd=rainData.data, od=out.data;
    for(var i=3;i<od.length;i+=4) od[i]=0;
    for(var y=0;y<h;y+=SAMPLE_STEP){
      for(var x=0;x<w;x+=SAMPLE_STEP){
        var ridx=(y*w+x)*4;
        var rDisp=rd[ridx]/255;
        var gHigh=rd[ridx+1]/255;
        var dispY=rDisp*9;
        var sy=Math.min(h-1,Math.max(0,Math.round(y+dispY)));
        var tidx=(sy*w+x)*4;
        var a=td[tidx+3]/255;
        var r0=td[tidx], g0=td[tidx+1], b0=td[tidx+2];
        var hl=gHigh*0.5;
        var r=Math.min(255,r0+160*hl);
        var gg=Math.min(255,g0+200*hl);
        var bb=Math.min(255,b0+230*hl);
        for(var dy=0;dy<SAMPLE_STEP&&y+dy<h;dy++){
          for(var dx=0;dx<SAMPLE_STEP&&x+dx<w;dx++){
            var oidx=((y+dy)*w+(x+dx))*4;
            od[oidx]=r;
            od[oidx+1]=gg;
            od[oidx+2]=bb;
            od[oidx+3]=Math.round(a*255*(0.8+gHigh*0.6));
          }
        }
      }
    }
    composeCtx.putImageData(out,0,0);
  }

  var rainState=null;
  var lastUpdateTime=0;
  var mistDirty=true;

  window.kefeEffects.rain = function(ctx,w,h,style,lines,time){
    var active=u.activeLine(lines,time);
    ensureBuffers(w,h);
    if(!rainState||rainState.w!==w||rainState.h!==h){
      rainState=createRainState(w,h,90);
      mistDirty=true;
      lastUpdateTime=time;
    }
    if(mistDirty){ drawMistToBuffer(mistCtx,w,h,rainState); mistDirty=false; }
    var dt=Math.min(0.05,Math.max(0,time-lastUpdateTime));
    lastUpdateTime=time;
    updateRain(rainState,dt,time);

    ctx.fillStyle=style.rainBackground||'#04060a';
    ctx.fillRect(0,0,w,h);

    ctx.save();
    ctx.globalAlpha=0.35;
    ctx.drawImage(mistBuffer,0,0);
    ctx.restore();

    if(active){
      var words=u.wordsFor(active.line,active.next);
      if(words.length){
        drawLyricToBuffer(textCtx,w,h,style,active,words,time);
        drawRainToBuffer(rainCtx,w,h,rainState);
        compositeDisplaced(w,h);
        ctx.drawImage(composeBuffer,0,0);
      }
    } else {
      drawRainToBuffer(rainCtx,w,h,rainState);
    }

    ctx.save();
    ctx.globalCompositeOperation='lighter';
    ctx.globalAlpha=0.28;
    ctx.drawImage(rainBuffer,0,0);
    ctx.restore();
  };
})();
