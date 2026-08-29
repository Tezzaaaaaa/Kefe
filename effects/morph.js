/* KEFE Premium — MORPH
 * A continuous letterform choreography system. The current and next lyric share
 * a deterministic deformation field so the transition reads as one transformation.
 */
(() => {
  'use strict';
  const u=window.kefeEffectUtils; window.kefeEffects=window.kefeEffects||{};
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));
  const ease=v=>{const t=clamp(v);return t*t*(3-2*t);};
  const smoother=v=>{const t=clamp(v);return t*t*t*(t*(t*6-15)+10);};
  const hash=s=>{let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return(h>>>0)/4294967295;};
  const chars=text=>Array.from(String(text||''));
  const fontSize=(ctx,text,base,maxWidth)=>u.fitContractText(ctx,'morph',text,base,maxWidth);
  function glyphs(ctx,text,size){u.setContractFont(ctx,'morph',size);const list=chars(text);const widths=list.map(c=>ctx.measureText(c).width);const total=widths.reduce((a,b)=>a+b,0);let x=-total/2;return list.map((char,i)=>{const width=widths[i];const out={char,x:x+width/2,width,index:i,count:list.length};x+=width;return out;});}
  function draw(ctx,text,size,maxWidth,x,y,alpha,phase,style,seed,transition){
    if(!text||alpha<=0)return;const gs=glyphs(ctx,text,size),total=gs.reduce((n,g)=>n+g.width,0),fit=Math.min(1,maxWidth/Math.max(1,total));
    const power=clamp(style.morphIntensity??.88),flow=clamp(style.morphFlow??.58),glow=clamp(style.morphGlow??.12);ctx.save();ctx.translate(x,y);ctx.scale(fit,fit);ctx.textAlign='center';ctx.textBaseline='middle';
    for(const g of gs){const q=g.index/Math.max(1,g.count-1)-.5,n=hash(seed+':'+g.index),wave=Math.sin(phase*Math.PI*2+q*6+n*4)*size*.065*flow*power,arc=Math.sin(phase*Math.PI+q*Math.PI)*size*.045*power;const scaleX=1+Math.sin(phase*Math.PI+n*3.1)*.22*power;const skew=Math.sin(phase*Math.PI*2+q*4+n)*.10*power;
      ctx.save();ctx.globalAlpha=alpha;ctx.translate(g.x,wave+arc);ctx.transform(scaleX,0,skew,1,0,0);ctx.fillStyle=style.textColor||'#fff';ctx.fillText(g.char,0,0);
      if(glow&&transition){ctx.globalAlpha=alpha*glow*(.35+.65*transition);ctx.shadowColor=style.accentColor||'#fff';ctx.shadowBlur=size*glow*1.8;ctx.fillText(g.char,0,0);}ctx.restore();}
    ctx.restore();
  }
  window.kefeEffects.morph=function(ctx,w,h,style,lines,time){
    const a=u.activeLine(lines,time);if(!a)return;const current=String(a.line.text||'').trim(),next=String(a.next?.text||'').trim();if(!current)return;
    const lp=u.lineProgress(a.line,time,.08,.24),base=Number(style.fontSize)||88,maxWidth=w*.84,currentSize=fontSize(ctx,current,base,maxWidth),nextSize=next?fontSize(ctx,next,base,maxWidth):currentSize;
    const nextTime=Number(a.next?.time),gap=nextTime-(Number(a.line.time)||time),duration=Math.max(.22,Math.min(.62,gap*.34||.34)),t=Number.isFinite(nextTime)?clamp((time-(nextTime-duration))/duration):0;
    const inP=smoother(t),outP=smoother(clamp(t/.82)),power=clamp(style.morphIntensity??.88),phase=clamp(lp.hold)+Math.sin(Math.PI*clamp(lp.hold))*.3;
    ctx.save();
    if(next&&t>0){
      // Shared centreline: both phrases briefly occupy the same field, then resolve cleanly.
      const collapse=ease(inP), drift=w*.045*power*(1-collapse), y=h*.5;
      draw(ctx,current,currentSize,maxWidth,w/2-drift,y,.98*(1-outP),phase,style,current+'|shared',inP);
      draw(ctx,next,nextSize,maxWidth,w/2+drift,y,.05+.95*inP,phase+.42,style,next+'|shared',inP);
      if(inP>.08&&inP<.92){
        // Fine deformation veil, deliberately restrained: it visually bridges the two glyph fields.
        ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=.045*power*inP;ctx.filter=`blur(${Math.max(1,currentSize*.035)}px)`;draw(ctx,current,currentSize*.99,maxWidth,w/2,y,1,phase+.15,style,current+'|veil',inP);ctx.restore();
      }
    }else{
      const breathe=1+Math.sin(Math.PI*clamp(lp.hold))*.018*power;ctx.translate(w/2,h*.5);ctx.scale(breathe,breathe);draw(ctx,current,currentSize,maxWidth,0,0,lp.opacity,phase,style,current+'|rest',0);
    }
    ctx.restore();
  };
})();
