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
    const activeStart=Number(lines[activeIndex]?.time)||0;
    const nextStart=Number(lines[activeIndex+1]?.time);
    const transitionDuration=Number.isFinite(nextStart)&&nextStart>activeStart
      ?clamp((nextStart-activeStart)*.16,.18,.30):0;
    const scrollProgress=transitionDuration
      ?smoother((time-(nextStart-transitionDuration))/transitionDuration):0;
    const focus=activeIndex+scrollProgress;
    for(let i=Math.max(0,activeIndex-4);i<=Math.min(lines.length-1,activeIndex+5);i++){
      const line=lines[i]||{},text=String(line.text??line.lyric??'').replace(/\s+/gu,' ').trim();
      if(!text)continue;
      const isActive=i===activeIndex,fs=isActive?fontSize:inactiveSize,font=weight+' '+fs+'px '+family;
      const rows=wrap(ctx,text,font,maxWidth);
      const start=Number(line.time)||0;
      const end=Number(line.endTime)>(start)?Number(line.endTime):(Number(lines[i+1]?.time)>start?Number(lines[i+1].time):start+3);
      const entering=smoother((time-start)/.28);
      const leaving=i<activeIndex?smoother((time-end+.48)/.48):1;
      const distance=i-focus;
      const alpha=isActive?entering:clamp(.34*Math.max(0,1-Math.max(0,Math.abs(distance)-1)*.22)*(i<activeIndex?1-leaving:1));
      const yOffset=isActive?(1-entering)*fontSize*.12:0;
      stack.push({line,text,rows,fs,font,isActive,alpha,yOffset,i,start,end,distance});
    }
    if(!stack.length)return;
    let cursor=0;
    for(let i=0;i<stack.length;i++){
      const item=stack[i];
      item.blockHeight=item.rows.length*item.fs*1.14;
      item.offset=cursor+item.blockHeight/2;
      cursor+=item.blockHeight+lineGap;
    }
    const offsetFor=index=>{
      if(index<=stack[0].i)return stack[0].offset;
      if(index>=stack[stack.length-1].i)return stack[stack.length-1].offset;
      const left=stack.find(item=>item.i===Math.floor(index));
      const right=stack.find(item=>item.i===Math.ceil(index));
      if(!left)return right?.offset||0;
      if(!right)return left.offset;
      return left.offset+(right.offset-left.offset)*(index-Math.floor(index));
    };
    const focusOffset=offsetFor(focus);
    ctx.save();
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
    for(const item of stack){
      const {line,rows,fs,font,isActive,alpha,yOffset,i}=item;
      ctx.font=font;
      const rowHeight=fs*1.14;
      const centerY=h*.5+item.offset-focusOffset+yOffset;
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
            let prefix='';
            for(let ci=0;ci<chars.length;ci++){
              const char=chars[ci],before=measure(ctx,prefix,font);
              prefix+=char;
              const after=measure(ctx,prefix,font),gx=x+before,cw=Math.max(.01,after-before);
              const a=before/Math.max(1,width),b=after/Math.max(1,width);
              const edge=.075;
              const lift=.10*smoother((front-(a+b)/2+edge+.035)/(edge*2));
              const gy=baseline-lift*fs;
              const g=ctx.createLinearGradient(gx,0,gx+cw,0);
              const fill=u=>white(.34+.66*smooth((front-(a+u*(b-a))+edge)/(edge*2)));
              g.addColorStop(0,fill(0));g.addColorStop(.5,fill(.5));g.addColorStop(1,fill(1));
              ctx.save();ctx.fillStyle=g;
              if(lift>.001){ctx.translate(gx+cw/2,gy);ctx.scale(1+lift*.025,1+lift*.025);ctx.translate(-(gx+cw/2),-gy);}
              ctx.fillText(char,gx,gy);ctx.restore();
            }
          });
        });
      }else{
        ctx.fillStyle=white(alpha);
        rows.forEach((row,ri)=>ctx.fillText(row,centerX,centerY+(ri-(rows.length-1)/2)*rowHeight));
      }
      
    }
    ctx.restore();
  }
  window.kefeEffects=window.kefeEffects||{};
  window.kefeEffects.apple=render;
  window.dispatchEvent(new Event('kefe-effects-ready'));
})();
