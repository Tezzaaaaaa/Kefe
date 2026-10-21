/* KEFE independent Apple Music-like lyric renderer.
 * Original implementation: no AMLL source or runtime dependency.
 * Preserves KEFE's renderer contract: (ctx, width, height, style, lines, time, artwork).
 */
(() => {
  'use strict';
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));
  const smooth=v=>{const t=clamp(v);return t*t*(3-2*t);};
  const smoother=v=>{const t=clamp(v);return t*t*t*(t*(t*6-15)+10);};
  const white=a=>'rgba(255,255,255,'+clamp(a).toFixed(4)+')';
  const measureCache=new Map();
  function measure(ctx,text,font){
    const key=font+'|'+text;
    if(measureCache.has(key))return measureCache.get(key);
    ctx.font=font;
    const width=ctx.measureText(text).width;
    measureCache.set(key,width);
    if(measureCache.size>3000)measureCache.delete(measureCache.keys().next().value);
    return width;
  }
  function wrap(ctx,text,font,maxWidth){
    const words=String(text||'').trim().split(/\s+/u).filter(Boolean),rows=[];
    let row='';
    for(const word of words){
      const candidate=row?row+' '+word:word;
      if(!row||measure(ctx,candidate,font)<=maxWidth){row=candidate;continue;}
      rows.push(row);row='';
      if(measure(ctx,word,font)<=maxWidth){row=word;continue;}
      for(const glyph of Array.from(word)){
        const next=row+glyph;
        if(row&&measure(ctx,next,font)>maxWidth){rows.push(row);row=glyph;}
        else row=next;
      }
    }
    if(row)rows.push(row);
    return rows;
  }
  function wordsFor(line,next,allTokens){
    const util=window.kefeEffectUtils;
    if(util?.tokenTimes){
      try{
        const times=util.tokenTimes(line,next,allTokens);
        if(times?.length===allTokens.length&&times.every(t=>Number.isFinite(Number(t.time))&&Number.isFinite(Number(t.endTime))))
          return times.map(t=>({time:Number(t.time),endTime:Math.max(Number(t.time)+.06,Number(t.endTime))}));
      }catch(_){}
    }
    if(Array.isArray(line.words)&&line.words.length===allTokens.length){
      const mapped=line.words.map((w,i)=>({time:Number(w.time??w.startTime),endTime:Number(w.endTime??w.end)}));
      if(mapped.every(w=>Number.isFinite(w.time)&&Number.isFinite(w.endTime)&&w.endTime>w.time))return mapped;
    }
    const start=Number(line.time)||0, nextStart=Number(next?.time);
    const declared=Number(line.endTime);
    const end=Number.isFinite(nextStart)&&nextStart>start?nextStart:
      Number.isFinite(declared)&&declared>start?declared:start+Math.max(1.5,allTokens.length*.42);
    const span=Math.max(.3,end-start)*.88;
    const weights=allTokens.map(t=>Math.max(1,Array.from(t.replace(/[^\p{L}\p{N}]/gu,'')).length**.7));
    const total=weights.reduce((a,b)=>a+b,0)||1;let cursor=0;
    return weights.map(weight=>{const a=start+span*cursor/total;cursor+=weight;return{time:a,endTime:Math.max(a+.06,start+span*cursor/total)};});
  }
  function render(ctx,w,h,style,lines,time){
    if(!ctx||!Array.isArray(lines)||!lines.length||!(w>0&&h>0))return;
    const util=window.kefeEffectUtils;
    const active=util?.activeLine?util.activeLine(lines,time):null;
    let activeIndex=active?.index??-1;
    if(activeIndex<0){
      for(let i=0;i<lines.length;i++){if(Number(lines[i]?.time)<=time)activeIndex=i;else break;}
    }
    if(activeIndex<0)activeIndex=0;
    const ratio=w/h,portrait=ratio<.9,landscape=ratio>=1.25;
    const fontSize=landscape?h*.063:portrait?w*.064:Math.min(w*.058,h*.09);
    const inactiveSize=fontSize*.88;
    const maxWidth=w*(landscape?.46:portrait?.86:.82);\n    const centerX=landscape?w*.75:w*.5;
    const family=style?.fontFamily||'"SF Pro Display","Inter Tight",system-ui,-apple-system,"Helvetica Neue",Arial,sans-serif';
    const weight=style?.fontWeight||700;
    const activeFont=weight+' '+fontSize+'px '+family;
    const lineGap=fontSize*.25;
    const lineHeight=fontSize*1.14;
    const stack=[];
    for(let i=Math.max(0,activeIndex-1);i<=Math.min(lines.length-1,activeIndex+1);i++){
      const line=lines[i]||{},text=String(line.text??line.lyric??'').replace(/\s+/gu,' ').trim();
      if(!text)continue;
      const isActive=i===activeIndex,fs=isActive?fontSize:inactiveSize,font=weight+' '+fs+'px '+family;
      const rows=wrap(ctx,text,font,maxWidth);
      const start=Number(line.time)||0;
      const end=Number(line.endTime)>(start)?Number(line.endTime):(Number(lines[i+1]?.time)>start?Number(lines[i+1].time):start+3);
      const entering=smoother((time-start)/.28);
      const leaving=i<activeIndex?smoother((time-end+.48)/.48):1;
      const alpha=isActive?entering:clamp(.34*(i<activeIndex?1-leaving:1));
      const yOffset=isActive?(1-entering)*fontSize*.24:(i<activeIndex?-fontSize*.16:fontSize*.2);
      stack.push({line,text,rows,fs,font,isActive,alpha,yOffset,i,start,end});
    }
    if(!stack.length)return;
    const totalHeight=stack.reduce((n,item)=>n+item.rows.length*item.fs*1.14,0)+lineGap*(stack.length-1);
    let y=(h-totalHeight)/2+stack[0].fs*.58;
    if(landscape)y=Math.max(fontSize,h*.5-totalHeight*.5+fontSize*.58);
    ctx.save();
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
    for(const item of stack){
      const {line,rows,fs,font,isActive,alpha,yOffset,i}=item;
      ctx.font=font;
      const rowHeight=fs*1.14;
      const centerY=y+(rows.length-1)*rowHeight/2+yOffset;
      if(isActive){
        const tokens=item.text.split(/\s+/u).filter(Boolean);
        const timings=wordsFor(line,lines[i+1],tokens);
        const rowEntries=[];
        let tokenIndex=0;
        for(const row of rows){
          const rowWidth=measure(ctx,row,font);
          let x=centerX-rowWidth/2;
          const entries=[];
          for(const token of row.split(' ')){
            const width=measure(ctx,token,font),tm=timings[tokenIndex]||{time:item.start,endTime:item.end};
            entries.push({token,x,width,tm,index:tokenIndex});
            x+=width+measure(ctx,' ',font);
            tokenIndex++;
          }
          rowEntries.push({row,width:rowWidth,entries});
        }
        rowEntries.forEach((row,ri)=>{
          const baseline=centerY+(ri-(rows.length-1)/2)*rowHeight;
          row.entries.forEach(entry=>{
            const {token,x,width,tm}=entry;
            const progress=clamp((time-tm.time)/Math.max(.06,tm.endTime-tm.time));
            const front=progress*1.12-.06;
            const chars=Array.from(token);
            let advance=0;
            for(let ci=0;ci<chars.length;ci++){
              const char=chars[ci],cw=measure(ctx,char,font);
              const a=advance/Math.max(1,width),b=(advance+cw)/Math.max(1,width);
              const edge=.075;
              const p=smoother((front-(a+b)/2+edge)/(edge*2));
              const lift=.10*smoother((front-(a+b)/2+edge+.035)/(edge*2));
              const gx=x+advance,gy=baseline-lift*fs;
              const g=ctx.createLinearGradient(gx,0,gx+Math.max(.01,cw),0);
              const fill=u=>white(.34+.66*smooth((front-(a+u*(b-a))+edge)/(edge*2)));
              g.addColorStop(0,fill(0));g.addColorStop(.5,fill(.5));g.addColorStop(1,fill(1));
              ctx.save();ctx.fillStyle=g;
              if(lift>.001){ctx.translate(gx+cw/2,gy);ctx.scale(1+lift*.025,1+lift*.025);ctx.translate(-(gx+cw/2),-gy);}
              ctx.fillText(char,gx,gy);ctx.restore();
              advance+=cw;
            }
          });
        });
      }else{
        ctx.fillStyle=white(alpha);
        rows.forEach((row,ri)=>ctx.fillText(row,centerX,centerY+(ri-(rows.length-1)/2)*rowHeight));
      }
      y+=rows.length*rowHeight+lineGap;
    }
    ctx.restore();
  }
  window.kefeEffects=window.kefeEffects||{};
  window.kefeEffects.apple=render;
  window.dispatchEvent(new Event('kefe-effects-ready'));
})();
