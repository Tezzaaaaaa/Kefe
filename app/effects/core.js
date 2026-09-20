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
    /* ---- Box fitting (shared by every lyric effect) ----------------------
       fitRows(ctx, tokens, o) wraps word tokens into balanced rows that are
       guaranteed to fit inside maxW x maxH, shrinking the font as far as
       needed. Nothing is ever allowed to overflow.
         o.font(ctx,size)  sets ctx.font for a given px size
         o.tag             cache tag identifying the font
         o.size            requested (maximum) size
         o.maxW, o.maxH    box the text must fit
         o.lineHeight      row height as a multiple of size (default 1.15)
         o.gap             word gap as a multiple of size (default .26; 0 = use a space)
         o.maxLines        preferred max rows (relaxed only if text would get tiny)
         o.min             smallest size before the line limit is relaxed   */
    fitRows(ctx,tokens,o){
      tokens=(tokens||[]).map(String);
      const maxW=Math.max(20,o.maxW),maxH=Math.max(20,o.maxH),lh=o.lineHeight||1.15,gapR=o.gap==null?.26:o.gap;
      const key=[o.tag,tokens.join('\u0001'),Math.round(o.size),Math.round(maxW),Math.round(maxH),lh,gapR,o.maxLines||0,o.min||0].join('|');
      const cache=this._fitCache||(this._fitCache=new Map());
      const hit=cache.get(key); if(hit) return hit;
      const measure=(size)=>{o.font(ctx,size);return tokens.map(t=>ctx.measureText(t).width);};
      const wrap=(widths,gap,limit)=>{
        const rows=[];let from=0,cur=0;
        for(let i=0;i<widths.length;i++){
          const proposed=i>from?cur+gap+widths[i]:widths[i];
          if(i>from&&proposed>limit){rows.push({from,to:i,width:cur});from=i;cur=widths[i];}else cur=proposed;
        }
        if(widths.length) rows.push({from,to:widths.length,width:cur});
        return rows;
      };
      const attempt=(size,lines)=>{
        const widths=measure(size),gap=gapR>0?size*gapR:(o.font(ctx,size),ctx.measureText(' ').width);
        if(Math.max(0,...widths)>maxW) return null;
        const rows=wrap(widths,gap,maxW);
        if(rows.length*size*lh>maxH) return null;
        if(lines&&rows.length>lines) return null;
        return {size,widths,gap,rows};
      };
      let size=Math.max(8,Number(o.size)||60),res=null;
      const floor=Math.max(8,(o.min!=null?o.min:size*.55));
      if(o.maxLines){for(let s=size;s>=floor;s*=.97){res=attempt(s,o.maxLines);if(res)break;}}
      if(!res){for(let s=size,n=0;n<120;s*=.95,n++){res=attempt(s,0);if(res)break;}}
      if(!res){const s=8,widths=measure(s);res={size:s,widths,gap:s*.26,rows:wrap(widths,s*.26,maxW)};}
      // Balance: narrowest limit that keeps the same number of rows.
      if(res.rows.length>1){
        let lo=Math.max(...res.widths),hi=maxW,n=res.rows.length;
        for(let i=0;i<14;i++){const mid=(lo+hi)/2;if(wrap(res.widths,res.gap,mid).length<=n)hi=mid;else lo=mid;}
        res.rows=wrap(res.widths,res.gap,hi);
      }
      res.rowH=res.size*lh;res.blockH=res.rows.length*res.rowH;
      res.blockW=Math.max(0,...res.rows.map(r=>r.width));
      if(cache.size>600) cache.clear();
      cache.set(key,res);
      return res;
    },
    /* textBlock: wrap a plain string into balanced rows that fit w x h. Returns {size,rows:[string],rowH,blockH,blockW}. */
    textBlock(ctx,text,o){
      const tokens=String(text||'').trim().split(/\s+/).filter(Boolean);
      const f=this.fitRows(ctx,tokens,{font:o.font,tag:o.tag,size:o.size,maxW:o.w,maxH:o.h,lineHeight:o.lh||1.1,gap:0,maxLines:o.maxLines||3,min:o.min});
      o.font(ctx,f.size);
      return {size:f.size,rows:f.rows.map(r=>tokens.slice(r.from,r.to).join(' ')),rowH:f.rowH,blockH:f.blockH,blockW:f.blockW};
    },
    clearFitCache(){ if(this._fitCache) this._fitCache.clear(); },
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
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => window.kefeEffectUtils.clearFitCache());
})();
