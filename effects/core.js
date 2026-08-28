/* Shared lyric timing/text helpers for KEFE production effects. */
(() => {
  'use strict';
  window.kefeEffects = window.kefeEffects || {};
  const type = () => window.KEFE_TYPE?.effects || {};
  window.kefeEffectUtils = {
    clamp(v,min=0,max=1){ return Math.max(min,Math.min(max,Number(v)||0)); },
    smooth(v){ const t=this.clamp(v); return t*t*(3-2*t); },
    smoother(v){ const t=this.clamp(v); return t*t*t*(t*(t*6-15)+10); },
    activeLine(lines,time){
      let index=-1;
      for(let i=0;i<(lines||[]).length;i++){
        if(Number.isFinite(Number(lines[i]?.time)) && time>=Number(lines[i].time)) index=i; else break;
      }
      if(index<0)return null;
      const line=lines[index]||{},next=lines[index+1]||null;
      const start=Number(line.time)||0;
      const nextTime=Number(next?.time);
      const explicitEnd=Number(line.endTime);
      const end=Number.isFinite(explicitEnd)&&explicitEnd>start ? explicitEnd : (Number.isFinite(nextTime)&&nextTime>start ? nextTime : start+3);
      return {index,line:{...line,time:start,endTime:end},next};
    },
    lineProgress(line,time,lead=.12,tail=.18){
      const start=Number(line?.time)||0,end=Math.max(start+.05,Number(line?.endTime)||start+3);
      const duration=end-start;
      const enter=this.smoother((time-start)/Math.min(.22,duration*.18+lead));
      const exit=this.smoother((end-time)/Math.min(.28,duration*.16+tail));
      return {enter,exit,hold:this.clamp((time-start)/duration),opacity:enter*exit};
    },
    wordsFor(line,next){
      if(Array.isArray(line?.words)&&line.words.length){
        const base=Number(line.time)||0;
        return line.words.map((word,i,all)=>{
          const start=Number.isFinite(Number(word?.time))?Number(word.time):base;
          const nextWord=Number(all[i+1]?.time);
          const lineEnd=Number(line.endTime);
          const end=Number.isFinite(Number(word?.endTime))&&Number(word.endTime)>start ? Number(word.endTime) : (Number.isFinite(nextWord)&&nextWord>start ? nextWord : (Number.isFinite(lineEnd)&&lineEnd>start ? lineEnd : start+.12));
          return {text:String(word.text||'').trim(),time:start,endTime:Math.max(start+.06,end)};
        }).filter(word=>word.text);
      }
      const tokens=String(line?.text||'').trim().split(/\s+/).filter(Boolean); if(!tokens.length)return [];
      const start=Number(line.time)||0,end=Math.max(start+.25,Number(next?.time)||Number(line.endTime)||start+3);
      const weights=tokens.map(token=>Math.max(1,Array.from(token.replace(/[^\p{L}\p{N}]/gu,'')).length**.72));
      const total=weights.reduce((a,b)=>a+b,0)||tokens.length; let cursor=0;
      return tokens.map((text,i)=>{const time=start+(end-start)*cursor/total;cursor+=weights[i];const endTime=start+(end-start)*cursor/total;return{text,time,endTime:Math.max(time+.06,endTime)};});
    },
    wordProgress(word,time){
      const start=Number(word?.time)||0,end=Math.max(start+.06,Number(word?.endTime)||start+.12);
      const p=this.clamp((time-start)/(end-start));
      return {raw:p,enter:this.smoother(p/.22),active:this.smoother((p-.08)/.35),exit:this.smoother((p-.72)/.28)};
    },
    contract(name,fallback={}){ return {...fallback,...(type()[name]||{})}; },
    setFont(ctx,family,size,weight=700){ctx.font=`${weight} ${Math.max(18,size)}px "${family}", Arial, sans-serif`;},
    setContractFont(ctx,name,size){const c=this.contract(name);this.setFont(ctx,c.family,Math.max(c.min,Math.min(c.max,Number(size)||c.max)),c.weight);return c;},
    fitText(ctx,family,text,size,maxWidth,weight=700){let fitted=Math.max(18,Number(size)||76);this.setFont(ctx,family,fitted,weight);while(fitted>24&&ctx.measureText(text).width>maxWidth){fitted-=1;this.setFont(ctx,family,fitted,weight);}return fitted;},
    fitContractText(ctx,name,text,size,maxWidth){const c=this.contract(name);let fitted=Math.max(c.min,Math.min(c.max,Number(size)||c.max));this.setFont(ctx,c.family,fitted,c.weight);while(fitted>c.min&&ctx.measureText(text).width>maxWidth){fitted-=1;this.setFont(ctx,c.family,fitted,c.weight);}return fitted;},
    drawTrackedText(ctx,text,x,y,trackingPx,method='fillText'){
      const chars=Array.from(String(text));
      if(!trackingPx||chars.length<2){ctx[method](text,x,y);return;}
      const widths=chars.map(char=>ctx.measureText(char).width);
      const total=widths.reduce((sum,width)=>sum+width,0)+trackingPx*(chars.length-1);
      let cursor=x;
      if(ctx.textAlign==='center') cursor=x-total/2;
      else if(ctx.textAlign==='right') cursor=x-total;
      const previous=ctx.textAlign;ctx.textAlign='left';
      for(let i=0;i<chars.length;i++){ctx[method](chars[i],cursor,y);cursor+=widths[i]+trackingPx;}
      ctx.textAlign=previous;
    },
    fillTrackedText(ctx,text,x,y,trackingPx){this.drawTrackedText(ctx,text,x,y,trackingPx,'fillText');},
    fitTextBinary(ctx,family,text,size,maxWidth,weight=700,minSize=24){
      let lo=minSize,hi=Math.max(minSize,Number(size)||76);
      for(let i=0;i<8;i++){const mid=(lo+hi)/2;this.setFont(ctx,family,mid,weight);if(ctx.measureText(text).width<=maxWidth)lo=mid;else hi=mid;}
      this.setFont(ctx,family,lo,weight);return lo;
    }
  };
})();
