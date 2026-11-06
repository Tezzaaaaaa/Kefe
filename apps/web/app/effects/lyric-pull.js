/* KEFE Lyric Pull — cinematic word-by-word focus pull on the timed lyric canvas. */
(() => {
  'use strict';
  const U=window.kefeEffectUtils;
  const E=window.kefeEffects=window.kefeEffects||{};
  if(!U){console.error('[lyric-pull] effects/core.js is required');return;}
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));
  const ease=t=>{t=clamp(t);return 1-Math.pow(1-t,4);};
  const palette=['#1e3a8a','#312e81','#4c1d95','#334155','#0f766e','#1e40af'];
  function font(ctx,style,w,h){
    const c=window.KEFE_TYPE?.effects?.lyricpull||{};
    const family=style?.kefeMotionFont||c.family||'Open Sans',weight=c.weight||800;
    const size=clamp(style?.fontSize||Math.min(w,h)*.105,24,Math.min(w,h)*.2);
    U.setFont(ctx,family,size,weight);
    return {family,weight,size,lineHeight:c.lineHeight||1.12};
  }
  function drawWord(ctx,word,w,h,type,o){
    if(o.alpha<=.002)return;
    ctx.save();
    ctx.globalAlpha*=clamp(o.alpha);
    ctx.filter='blur('+Math.max(0,o.blur).toFixed(2)+'px)';
    ctx.font=type.weight+' '+(type.size*o.scale).toFixed(2)+'px "'+type.family+'", Arial, sans-serif';
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=o.color;
    const tracking=type.size*o.tracking;
    U.fillTrackedText(ctx,word,w/2+o.x,h/2,tracking);
    ctx.restore();
  }
  function background(ctx,w,h,wordIndex,fade){
    const color=palette[Math.max(0,wordIndex)%palette.length];
    const g=ctx.createRadialGradient(w*.5,h*.46,0,w*.5,h*.46,Math.max(w,h)*.72);
    g.addColorStop(0,color);g.addColorStop(.55,'rgba(8,12,30,.74)');g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.save();ctx.globalAlpha=.72*clamp(fade);ctx.fillStyle=g;ctx.fillRect(0,0,w,h);ctx.restore();
  }
  E.lyricpull=function(ctx,w,h,style,lines,time){
    if(!Array.isArray(lines)||!lines.length)return;
    const active=U.activeLine(lines,time);if(!active)return;
    const line=active.line,words=U.wordsFor(line,active.next);if(!words.length)return;
    const start=Number(line.time)||0,end=Math.max(start+.2,Number(line.endTime)||words[words.length-1].endTime);
    const elapsed=Math.max(0,time-start);
    const fade=clamp((end-time)/.5),type=font(ctx,style||{},w,h);
    const latest=U.activeWordIndex(words,time);
    background(ctx,w,h,latest<0?0:latest,fade);
    const finalEnd=words[words.length-1].endTime;
    words.forEach((word,i)=>{
      const age=time-Number(word.time),duration=Math.max(.06,Number(word.endTime)-Number(word.time));
      if(age<0)return;
      const p=clamp(age/1.8),enter=ease(p),isCurrent=i===latest;
      const settled=clamp((age-1.8)/.2);
      const alpha=isCurrent?Math.min(1,age/.18):Math.max(.15,1-settled*.85);
      const o=isCurrent
        ?{x:200*(1-enter),scale:2.5-1.5*enter,blur:25*(1-enter),tracking:.08-.11*enter,alpha,color:'#ffffff'}
        :{x:-30,scale:.92,blur:3,tracking:-.025,alpha:Math.min(.15,alpha),color:'#cccccc'};
      o.alpha*=fade;
      drawWord(ctx,word.text,w,h,type,o);
    });
    if(elapsed<.4){
      const q=1-clamp(elapsed/.4);
      ctx.save();ctx.globalAlpha*=q*.16;ctx.fillStyle='#1e3a8a';ctx.fillRect(0,0,w,h);ctx.restore();
    }
  };
})();
