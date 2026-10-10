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
    /* ===== Karaoke timing engine (shared by every lyric effect) =====
       wordsFor     -> [{text,time,endTime}] monotonic, gap-free-within-word, real word timing if present, else syllable-weighted estimate
       wordProgress -> per-word phases (raw/sweep/pre/pulse/done/enter/active/exit)
       charProgress -> staggered per-character progress inside a word
       sweepFill    -> soft-edged left-to-right fill gradient (Apple Music / AMLL style) for fillStyle
       glow/lift    -> eased emphasis curves so every effect pulses on the beat of the word, not just flips state */
    wordsFor(line,next){
      const model=window.kefeLyricModel;
      const key=(line?.text||'')+'|'+(line?.time)+'|'+(line?.endTime)+'|'+(next?.time)+'|'+(line?.words?line.words.length+':'+line.words[0].time+':'+line.words[line.words.length-1].time:'-');
      const cache=(this._wc=this._wc||new Map());
      const hit=cache.get(key); if(hit)return hit;
      let out;
      if(Array.isArray(line?.words)&&line.words.length){
        const base=Number(line.time)||0,lineEnd=Number(line.endTime);
        out=line.words.map((word,i,all)=>{
          const start=Number.isFinite(Number(word?.time))?Number(word.time):base;
          const nextWord=Number(all[i+1]?.time);
          const end=Number.isFinite(Number(word?.endTime))&&Number(word.endTime)>start ? Number(word.endTime) : (Number.isFinite(nextWord)&&nextWord>start ? nextWord : (Number.isFinite(lineEnd)&&lineEnd>start ? lineEnd : start+.3));
          return {text:String(word.text||'').trim(),time:start,endTime:Math.max(start+.06,end)};
        }).filter(word=>word.text);
      }else if(model&&model.wordsOf){
        const nt=Number(next?.time);
        out=model.wordsOf({...line,time:Number(line?.time)||0,endTime:Number(line?.endTime)},Number.isFinite(nt)?nt:NaN).map(w=>({text:String(w.text||'').trim(),time:Number(w.time),endTime:Number(w.endTime)})).filter(w=>w.text);
      }else{
        const tokens=String(line?.text||'').trim().split(/\s+/).filter(Boolean); if(!tokens.length)return [];
        const start=Number(line.time)||0,end=Math.max(start+.25,Number(next?.time)||Number(line.endTime)||start+3);
        const weights=tokens.map(token=>Math.max(1,Array.from(token.replace(/[^\p{L}\p{N}]/gu,'')).length**.72));
        const total=weights.reduce((a,b)=>a+b,0)||tokens.length; let cursor=0;
        out=tokens.map((text,i)=>{const time=start+(end-start)*cursor/total;cursor+=weights[i];const endTime=start+(end-start)*cursor/total;return{text,time,endTime:Math.max(time+.06,endTime)};});
      }
      cache.set(key,out); if(cache.size>600){cache.delete(cache.keys().next().value);}
      return out;
    },
    /* Phase curves for one word at `time`. sweep is the linear-ish karaoke fill (0..1, slight ease so it feels sung not mechanical). */
    wordProgress(word,time,pre=.1){
      const start=Number(word?.time)||0,end=Math.max(start+.06,Number(word?.endTime)||start+.12),dur=end-start;
      const p=this.clamp((time-start)/dur);
      const ease=p*p*(3-2*p)*.35+p*.65;                         // 65% linear / 35% smoothstep
      const preRoll=this.smoother((time-(start-pre))/pre);      // 0..1 over the `pre` seconds before the word starts (anticipation)
      const pulse=time<start?0:Math.sin(Math.PI*this.clamp((time-start)/Math.max(.18,dur)))  // rises and falls once across the word (min .18s so short words still breathe)
      return {raw:p,sweep:ease,pre:preRoll,pulse:Math.max(0,pulse),done:time>=end?1:0,started:time>=start?1:0,dur,
        enter:this.smoother(p/.22),active:this.smoother((p-.08)/.35),exit:this.smoother((p-.72)/.28)};
    },
    /* Per-character progress inside a word: chars start staggered across `spread` of the word duration and each takes `soft` of it. */
    charProgress(word,i,n,time,spread=.8,soft=.35){
      const start=Number(word?.time)||0,end=Math.max(start+.06,Number(word?.endTime)||start+.12),dur=end-start;
      const a=start+dur*spread*(n>1?i/(n-1):0),len=Math.max(.05,dur*soft+.04);
      return this.smoother((time-a)/len);
    },
    /* Soft-edged horizontal sweep as a canvas gradient. x = left of the text in the CURRENT transform, width = text width, p = 0..1. */
    sweepFill(ctx,x,width,p,fill,dim,edge=.22){
      p=this.clamp(p);
      if(p<=0)return dim; if(p>=1)return fill;
      const g=ctx.createLinearGradient(x,0,x+Math.max(1,width),0);
      const head=p*(1+edge),tail=Math.max(0,head-edge);
      g.addColorStop(0,fill);g.addColorStop(this.clamp(tail),fill);g.addColorStop(this.clamp(head),dim);g.addColorStop(1,dim);
      return g;
    },
    /* Lines to draw right now with their transition phases. Current line eases in over inDur; the previous line eases out over outDur
       (so line changes crossfade instead of hard-cutting); a line with an explicit early end fades out after its end.
       -> [{line,next,index,enter,leave,alpha,role}] oldest first. enter/leave are eased 0..1. */
    lineStack(lines,time,inDur=.34,outDur=.30){
      const a=this.activeLine(lines,time); if(!a)return [];
      const out=[],start=Number(a.line.time)||0,end=Number(a.line.endTime)||start+3;
      const nextT=Number(a.next?.time);
      if(a.index>0){
        const prev=lines[a.index-1],pe=(time-start)/outDur;
        const pl=Math.min(1,pe*1.7);   // outgoing line clears faster than the new one arrives so the two never pile up
        if(pe<1)out.push({line:prev,next:a.line,index:a.index-1,enter:1,leave:this.smoother(pl),alpha:1-this.smoother(pl),role:'prev'});
      }
      let leave=0;
      if(Number.isFinite(nextT)?end<nextT-.01:true){leave=this.smoother((time-end)/outDur);}
      if(leave>=1)return out;
      const enter=this.smoother((time-start)/inDur);
      out.push({line:a.line,next:a.next,index:a.index,enter,leave,alpha:a.index>0?this.smoother((time-start-.06)/Math.max(.1,inDur-.06))*(1-leave):enter*(1-leave),role:'cur'});
      return out;
    },
    /* Map every character of the wrapped rows to its timed word. rowTexts = layoutText().lines. Returns one entry per row, each an array
       of {ch,word,j,n,space} (j = index inside the word, n = word char count; spaces carry the NEXT word so they can key off it).
       If the rows can't be matched to the timed words 1:1 (a very long word got broken), characters are spread linearly across the vocal. */
    charMap(rowTexts,words){
      const parts=rowTexts.map(r=>r.split(' '));
      const total=parts.reduce((n,p)=>n+p.length,0);
      const ok=words.length>0&&words.length===total&&parts.every(p=>p.every(Boolean));
      const out=[];
      if(ok){
        let ti=0;
        parts.forEach(p=>{
          const row=[];
          p.forEach((part,k)=>{
            const word=words[ti],chars=Array.from(part);
            chars.forEach((ch,j)=>row.push({ch,word,j,n:chars.length,space:false}));
            if(k<p.length-1)row.push({ch:' ',word:words[ti+1]||word,j:0,n:1,space:true});
            ti++;
          });
          out.push(row);
        });
        return out;
      }
      const t0=words.length?words[0].time:0,t1=words.length?words[words.length-1].endTime:t0+2;
      const n=rowTexts.reduce((a,r)=>a+Array.from(r).length,0)||1;let g=0;
      rowTexts.forEach(r=>{
        out.push(Array.from(r).map(ch=>{
          const a=t0+(t1-t0)*.9*(g/n),b=t0+(t1-t0)*.9*((g+1)/n);g++;
          return {ch,word:{time:a,endTime:Math.max(a+.06,b)},j:0,n:1,space:ch===' '};
        }));
      });
      return out;
    },
    /* Progress of a whole line in sung time: 0 at first word start, 1 at last word end. */
    sungProgress(words,time){
      if(!words.length)return 0;const a=words[0].time,b=words[words.length-1].endTime;
      return this.clamp((time-a)/Math.max(.05,b-a));
    },
    /* Index of the word being sung (or last sung), -1 before the first. */
    activeWordIndex(words,time){let k=-1;for(let i=0;i<words.length;i++){if(time>=words[i].time)k=i;else break;}return k;},
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
    /* Wrap timed word objects ({text,...}) into rows that always fit. Returns {size,gap,rows:[{words,width}],lineH}.
       o: {setFont(ctx,size),size,minSize,maxWidth,maxHeight,gapEm,lineHeight,maxLines,headroom} — headroom shrinks maxWidth
       for effects that scale words up (spring/elastic overshoot). */
    fitWordRows(ctx,words,o={}){
      const set=o.setFont,gapEm=o.gapEm==null?.28:o.gapEm,lh=Number(o.lineHeight)||1.2,maxLines=o.maxLines||4;
      const maxW=Math.max(40,(Number(o.maxWidth)||400)/(Number(o.headroom)||1)),maxH=Number(o.maxHeight)>0?Number(o.maxHeight):Infinity;
      const minSize=Math.max(12,o.minSize||18);
      const build=size=>{
        set(ctx,size);const gap=size*gapEm,rows=[];let row=[],rw=0,tooWide=false;
        for(const wd of words){
          const ww=ctx.measureText(wd.text).width;if(ww>maxW)tooWide=true;
          const proposed=row.length?rw+gap+ww:ww;
          if(row.length&&proposed>maxW){rows.push({words:row,width:rw});row=[wd];rw=ww;}else{row.push(wd);rw=proposed;}
        }
        if(row.length)rows.push({words:row,width:rw});
        return {rows,gap,tooWide};
      };
      let size=Math.max(minSize,Number(o.size)||76),r=build(size);
      while((r.tooWide||r.rows.length>maxLines||r.rows.length*size*lh>maxH)&&size>minSize){
        size=Math.max(minSize,size-Math.max(1,Math.round(size*.04)));r=build(size);
      }
      set(ctx,size);
      return {size,gap:r.gap,rows:r.rows,lineH:size*lh};
    },
    /* Font setter for an effect's typography contract that does NOT clamp to contract min/max (lets long lines shrink to fit). */
    contractFontSetter(name){const self=this;return (ctx,size)=>{const c=self.contract(name);self.setFont(ctx,c.family,size,c.weight);};},
    /* Wrap + shrink text so it always fits a box. Returns {size,lines,lineH,blockH}.
       o: {family,weight,setFont(ctx,size),size,minSize,maxWidth,maxHeight,tracking(em),lineHeight,maxLines,upper} */
    layoutText(ctx,text,o={}){
      const src=String(text||'').replace(/\s+/g,' ').trim(),str=o.upper?src.toUpperCase():src;
      const set=o.setFont||((c,s)=>this.setFont(c,o.family||'Open Sans',s,o.weight||700));
      const maxW=Math.max(40,Number(o.maxWidth)||400),maxH=Number(o.maxHeight)>0?Number(o.maxHeight):Infinity;
      const lh=Number(o.lineHeight)||1.2,track=Number(o.tracking)||0,maxLines=o.maxLines||4,minSize=Math.max(12,o.minSize||20);
      const words=str?str.split(' '):[];
      const meas=(t,size)=>ctx.measureText(t).width+track*size*Math.max(0,Array.from(t).length-1);
      const wrap=size=>{
        set(ctx,size);const rows=[];let cur='',broken=false;
        for(const word of words){
          if(meas(word,size)>maxW)broken=true;
          const test=cur?cur+' '+word:word;
          if(cur&&meas(test,size)>maxW){rows.push(cur);cur=word;}else cur=test;
        }
        if(cur)rows.push(cur);
        return {rows,broken};
      };
      let size=Math.max(minSize,Number(o.size)||76),res=wrap(size);
      const fits=r=>!r.broken&&r.rows.length<=maxLines&&r.rows.length*size*lh<=maxH;
      while(!fits(res)&&size>minSize){size=Math.max(minSize,size-Math.max(1,Math.round(size*.04)));res=wrap(size);}
      let rows=res.rows;
      if(res.broken||rows.length>maxLines){
        // last resort: break over-long words by character
        set(ctx,size);const out=[];let cur='';
        for(const ch of Array.from(str)){
          if(cur&&meas(cur+ch,size)>maxW){out.push(cur.trim());cur=ch===' '?'':ch;}else cur+=ch;
        }
        if(cur.trim())out.push(cur.trim());
        rows=out;
      }
      set(ctx,size);
      const lineH=size*lh;
      return {size,lines:rows,lineH,blockH:rows.length*lineH,text:str};
    },
    fitTextBinary(ctx,family,text,size,maxWidth,weight=700,minSize=24){
      let lo=minSize,hi=Math.max(minSize,Number(size)||76);
      for(let i=0;i<8;i++){const mid=(lo+hi)/2;this.setFont(ctx,family,mid,weight);if(ctx.measureText(text).width<=maxWidth)lo=mid;else hi=mid;}
      this.setFont(ctx,family,lo,weight);return lo;
    }
  };
})();
