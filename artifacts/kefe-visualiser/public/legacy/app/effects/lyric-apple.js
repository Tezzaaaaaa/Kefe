/* =========================================================================
 * APPLE MUSIC LYRICS EFFECT
 * The lyric presentation is replaced with the synced, focus-line treatment.
 * Backgrounds, title card, metadata, visualiser, editor controls and timing
 * source remain owned by KEFE's existing editor pipeline.
 * ========================================================================= */
(() => {
  'use strict';
  const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,Number(v)||0));
  const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
  const springOut=t=>{t=clamp(t);const c1=1.2,c3=c1+1,u=t-1;return 1+c3*u*u*u+c1*u*u;};
  const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
  function wordsFor(line,next){
    if(Array.isArray(line.words)&&line.words.length)return line.words.map((word,i,all)=>({
      text:String(word.text||'').trim(),start:Number(word.time),
      end:finite(word.endTime)&&Number(word.endTime)>Number(word.time)?Number(word.endTime):
        finite(all[i+1]?.time)&&Number(all[i+1].time)>Number(word.time)?Number(all[i+1].time):
        finite(line.endTime)&&Number(line.endTime)>Number(word.time)?Number(line.endTime):Number(word.time)+.32
    })).filter(word=>word.text);
    const tokens=String(line.text||'').trim().split(/\s+/).filter(Boolean);
    const start=Number(line.time)||0,end=finite(next?.time)&&Number(next.time)>start?Number(next.time):finite(line.endTime)&&Number(line.endTime)>start?Number(line.endTime):start+3;
    const weights=tokens.map(s=>Math.max(1,Array.from(s.replace(/[^\p{L}\p{N}]/gu,'')).length**.72));
    const total=weights.reduce((a,b)=>a+b,0)||1;let consumed=0;
    return tokens.map((text,i)=>{const from=start+(end-start)*consumed/total;consumed+=weights[i];return{text,start:from,end:start+(end-start)*consumed/total};});
  }
  function drawAppleEffect(ctx,w,h,style,lines,time){
    if(!Array.isArray(lines)||!lines.length)return;
    const usable=lines.map((line,i)=>({...line,_words:wordsFor(line,lines[i+1]),_index:i})).filter(line=>String(line.text||'').trim());
    if(!usable.length)return;
    let active=-1;
    const leadIn=1;
    for(let i=0;i<usable.length;i++){if(finite(usable[i].time)&&time>=Number(usable[i].time)-leadIn)active=i;else if(Number(usable[i].time)-leadIn>time)break;}
    if(active<0)return;
    const unit=Math.min(w,h),portrait=w/h<.75,wide=w/h>1.25;
    const maxWidth=w*(wide?.76:portrait?.84:.78),left=(w-maxWidth)/2;
    const fontSize=unit*(wide?.075:portrait?.082:.079);
    const inactiveSize=fontSize*.94,lineGap=unit*.058;
    const activeLine=usable[active],activeWords=activeLine._words;
    const fontFamily=style?.fontFamily||style?.font||'"SF Pro Display",-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif';
    const weight=style?.fontWeight||700;
    const wrap=(tokens,size)=>{
      ctx.font=weight+' '+size+'px '+fontFamily;
      const rows=[];let row=[],width=0;
      for(const token of tokens){
        const tw=ctx.measureText(token.text).width,space=row.length?ctx.measureText(' ').width:0;
        if(row.length&&width+space+tw>maxWidth){rows.push(row);row=[];width=0;}
        row.push(token);width+=(row.length>1?space:0)+tw;
      }
      if(row.length)rows.push(row);
      return rows;
    };
    const measured=usable.map(line=>{
      const tokens=line._words.length?line._words:String(line.text||'').split(/\s+/).filter(Boolean).map(text=>({text,start:Number(line.time)||0,end:Number(line.endTime)||Number(line.time)+3}));
      const rows=wrap(tokens,fontSize);
      return {...line,_tokens:tokens,_rows:rows,_height:Math.max(1,rows.length)*fontSize*1.18};
    });
    const current=measured[active];
    const headerClearance=h*.18;
    const anchor=Math.max(h*.53,headerClearance+current._height*.5);
    const previous=measured[active-1];
    const transitionDuration=leadIn;
    const shift=(time-(Number(activeLine.time)-leadIn))/transitionDuration;
    const settle=springOut(shift);
    let offset=0;
    const positions=new Map([[active,anchor]]);
    for(let i=active+1;i<measured.length;i++){offset+=(measured[i-1]._height+measured[i]._height)/2+lineGap;positions.set(i,anchor+offset);}
    offset=0;
    for(let i=active-1;i>=0;i--){offset+=(measured[i+1]._height+measured[i]._height)/2+lineGap;positions.set(i,anchor-offset);}
    const transitionDistance=previous?(previous._height+current._height)/2+lineGap:current._height+lineGap;
    positions.set(active,anchor+(1-settle)*transitionDistance);
    if(previous)positions.set(active-1,anchor-settle*transitionDistance);
    const from=Math.max(0,active-3),to=Math.min(measured.length-1,active+4);
    ctx.save();ctx.textBaseline='middle';ctx.textAlign='left';
    for(let i=from;i<=to;i++){
      const line=measured[i],distance=i-active,isActive=distance===0;
      const y=positions.get(i);
      if(y+line._height<h*.10||y-line._height>h*.94)continue;
      const alpha=isActive?1:clamp(.72-Math.abs(distance)*.14,.24,.62);
      const size=isActive?fontSize:inactiveSize;
      ctx.save();ctx.globalAlpha=alpha;ctx.font=weight+' '+size+'px '+fontFamily;ctx.fillStyle=isActive?'rgba(255,255,255,.46)':'rgba(255,255,255,.78)';
      if(!isActive){ctx.filter='blur('+Math.min(2.4,Math.abs(distance)*.55)+'px)';}
      const rowHeight=size*1.18;
      line._rows.forEach((row,ri)=>{
        const rowWidth=row.reduce((sum,word,j)=>sum+ctx.measureText(word.text).width+(j?ctx.measureText(' ').width:0),0);
        let x=wide?(w-rowWidth)/2:left;
        const baseline=y+(ri-(line._rows.length-1)/2)*rowHeight;
        row.forEach((word,j)=>{
          const wordWidth=ctx.measureText(word.text).width;
          ctx.fillText(word.text,x,baseline);
          if(isActive){
            const start=Number(word.start),end=Number(word.end);
            const progress=finite(start)&&time>=start?(finite(end)&&end>start?smooth((time-start)/Math.min(.11,end-start)):1):0;
            if(progress>0){
              ctx.save();ctx.beginPath();ctx.rect(x-1,baseline-rowHeight*.62,wordWidth*progress+2,rowHeight*1.24);ctx.clip();
              ctx.filter='none';ctx.globalAlpha=1;ctx.fillStyle='#FFFFFF';ctx.fillText(word.text,x,baseline);ctx.restore();
            }
          }
          x+=wordWidth+(j<row.length-1?ctx.measureText(' ').width:0);
        });
      });
      ctx.restore();
    }
    ctx.restore();
  }
  window.kefeEffects=window.kefeEffects||{};
  window.kefeEffects.apple=drawAppleEffect;
  window.dispatchEvent(new Event('kefe-effects-ready'));
})();
