/* KEFE Visualiser — Trailer lyric effect.
   Bold condensed all-caps punch-in. Small tracked lead-in above one big mustard impact word. */
(function(){
  'use strict';
  var u = window.kefeEffectUtils;
  window.kefeEffects = window.kefeEffects || {};
  if (!u) { console.error('[lyric-trailer] requires core.js'); return; }
  function clamp(v,a,b){ a=a==null?0:a; b=b==null?1:b; return Math.max(a,Math.min(b,Number(v)||0)); }
  function smoother(v){ var t=clamp(v); return t*t*t*(t*(t*6-15)+10); }
  function overshoot(v){ var t=clamp(v); if(t>=1) return 1; var c=1.7; return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2); }

  function heavyFont(ctx,size){ ctx.font='900 '+Math.max(18,size)+'px "Archivo Narrow","Inter Tight",system-ui,sans-serif'; }
  function leadFont(ctx,size){ ctx.font='600 '+Math.max(14,size)+'px "Archivo Narrow","Inter Tight",system-ui,sans-serif'; }
  function fitHeavy(ctx,text,startSize,maxWidth){
    var size=startSize;
    heavyFont(ctx,size);
    while(size>28 && ctx.measureText(text.toUpperCase()).width>maxWidth){ size-=2; heavyFont(ctx,size); }
    return size;
  }

  window.kefeEffects.trailer = function(ctx,w,h,style,lines,time){
    var active=u.activeLine(lines,time);
    if(!active) return;
    var raw=String((active.line&&active.line.text)||'').trim();
    if(!raw) return;
    var start=Number(active.line.time)||0;
    var end=Math.max(start+0.5,Number(active.line.endTime)||start+3);
    var duration=Math.max(0.4,end-start);
    var p=clamp((time-start)/duration);

    var words=raw.split(/\s+/).filter(Boolean);
    var punch=(words.pop()||raw).toUpperCase();
    var lead=words.join(' ').toUpperCase();

    var enterDur=Math.min(0.32,Math.max(0.16,duration*0.18));
    var exitDur=Math.min(0.28,Math.max(0.14,duration*0.12));
    var enter=overshoot(p/(enterDur/duration));
    var fade=smoother(clamp(p/(enterDur/duration*0.6)));
    var exit=smoother(clamp((end-time)/exitDur));
    var alpha=Math.min(fade,exit);
    if(alpha<=0) return;

    var maxWidth=w*0.84;
    var punchSize=fitHeavy(ctx,punch,Math.max(46,Math.min(220,(Number(style.fontSize)*1.5)||150)),maxWidth);
    heavyFont(ctx,punchSize);
    var punchHeight=punchSize*1.02;
    var leadSize=Math.max(16,punchSize*0.22);
    var hasLead=Boolean(lead);
    var gap=hasLead?leadSize*0.9:0;
    var blockHeight=punchHeight+(hasLead?leadSize+gap:0);
    var top=h*0.52-blockHeight/2;

    ctx.save();
    ctx.globalCompositeOperation='source-over';
    ctx.filter='none';

    var bandPad=punchHeight*0.35;
    var grad=ctx.createLinearGradient(0,top-bandPad,0,top+blockHeight+bandPad);
    grad.addColorStop(0,'rgba(0,0,0,0)');
    grad.addColorStop(0.5,'rgba(0,0,0,'+(0.30*alpha)+')');
    grad.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=grad;
    ctx.fillRect(0,top-bandPad,w,blockHeight+bandPad*2);

    ctx.textAlign='center';
    ctx.textBaseline='alphabetic';

    if(hasLead){
      leadFont(ctx,leadSize);
      ctx.globalAlpha=alpha*0.92;
      ctx.fillStyle=style.textColor||'#F2F0E6';
      var leadY=top+leadSize;
      u.drawTrackedText(ctx,lead,w/2,leadY,leadSize*0.32,'fillText');
    }

    heavyFont(ctx,punchSize);
    ctx.globalAlpha=alpha;
    ctx.fillStyle=style.accentColor||'#F2D34D';
    ctx.save();
    var punchY=top+(hasLead?leadSize+gap:0)+punchHeight*0.82;
    ctx.translate(w/2,punchY);
    ctx.scale(enter,enter);
    u.drawTrackedText(ctx,punch,0,0,punchSize*-0.01,'fillText');
    ctx.restore();

    ctx.restore();
  };
})();
