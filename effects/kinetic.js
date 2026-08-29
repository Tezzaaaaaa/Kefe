/* KEFE Premium — KINETIC
 * System-first kinetic typography: deterministic composition, word hierarchy,
 * spatial choreography, physical easing and controlled variation.
 */
(() => {
  'use strict';
  const u=window.kefeEffectUtils; window.kefeEffects=window.kefeEffects||{};
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));
  const smoother=v=>{const t=clamp(v);return t*t*t*(t*(t*6-15)+10);};
  const easeOut=v=>1-Math.pow(1-clamp(v),3);
  const easeInOut=v=>{const t=clamp(v);return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;};
  const hash=s=>{let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return(h>>>0)/4294967295;};
  const wordScore=word=>{const letters=(String(word.text||'').match(/[\p{L}\p{N}]/gu)||[]).length;const punctuation=/[!?]/.test(word.text)?1.25:1;return Math.pow(Math.max(1,letters),.72)*punctuation;};
  const fit=(ctx,text,size,max)=>u.fitContractText(ctx,'mixedmedia',text,size,max);
  function wrap(ctx,words,size,max,gap){u.setContractFont(ctx,'mixedmedia',size);const rows=[];let row=[],width=0;for(const word of words){const ww=ctx.measureText(word.text).width;const proposed=width+(row.length?gap:0)+ww;if(row.length&&proposed>max){rows.push(row);row=[];width=0;}row.push({...word,width:ww});width+=(row.length>1?gap:0)+ww;}if(row.length)rows.push(row);return rows;}
  function layout(ctx,words,size,max,gap,mode,seed){
    let rows=wrap(ctx,words,size,max,gap);if(rows.length>3&&size>42)rows=wrap(ctx,words,size*.86,max,gap*.9);
    const rowGap=size*.10;const flat=rows.flat();const ranked=[...flat].sort((a,b)=>wordScore(b)-wordScore(a));const hero=ranked[0]?.text;
    if(mode==='stack'||(mode==='auto'&&rows.length===1&&flat.length>=5)){rows=[flat];}
    return rows.map((row,r)=>{const total=row.reduce((n,x)=>n+x.width,0)+Math.max(0,row.length-1)*gap;let x=-total/2;return row.map((word,i)=>{const jitter=(hash(seed+':'+r+':'+i)-.5)*size*.014;const centered=x+word.width/2+jitter;let xx=centered,yy=(r-(rows.length-1)/2)*(size+rowGap);if(mode==='split'||(mode==='auto'&&rows.length===1&&flat.length<=3)){const side=i%2?-1:1;xx=centered+side*size*(.11+.06*(i===0));yy+=Math.abs(i-row.length/2)*size*.025;}return {...word,x:xx,y:yy,hero:word.text===hero,index:i,row:r};});});
  }
  function drawWord(ctx,word,time,params,seed){
    const p=u.wordProgress(word,time),enter=smoother(p.raw/.20),active=smoother((p.raw-.04)/.34),exit=smoother((p.raw-.78)/.22);
    const n=hash(seed+':'+word.text+':'+word.index);const dir=n>.66?1:n<.33?-1:0;
    const travel=params.travel*(.65+.7*n),fromX=dir*travel*(1-enter),fromY=(n-.5)*params.travelY*(1-enter);
    const heroBoost=word.hero?1+params.hierarchy*.15:1-params.density*.045;const activeBoost=1+params.hierarchy*.09*active;
    const settle=1+.028*params.energy*Math.sin(Math.PI*clamp((p.raw-.10)/.68));
    const scale=(.86+.14*enter)*settle*heroBoost*activeBoost;
    const rotation=(n-.5)*params.rotation*(1-enter);const alpha=enter*(1-.42*exit);
    ctx.save();ctx.translate(word.x+fromX,word.y+fromY);ctx.rotate(rotation);ctx.scale(scale,scale);ctx.globalAlpha=alpha;ctx.fillStyle=params.color;ctx.fillText(word.text,0,0);
    if(active>0){ctx.save();ctx.globalAlpha=.10*active*params.hierarchy;ctx.shadowColor=params.accent;ctx.shadowBlur=params.glow*(.5+active);ctx.fillStyle=params.accent;ctx.fillText(word.text,0,0);ctx.restore();}
    ctx.restore();
  }
  window.kefeEffects.kinetic=function(ctx,w,h,style,lines,time){
    const a=u.activeLine(lines,time);if(!a)return;const text=String(a.line.text||'').trim();if(!text)return;const words=u.wordsFor(a.line,a.next);if(!words.length)return;
    const energy=clamp(style.kineticEnergy??.72),hierarchy=clamp(style.kineticHierarchy??.78),motion=clamp(style.kineticMotion??.68),density=clamp(style.kineticDensity??.55),glow=clamp(style.kineticGlow??.18);
    const mode=['auto','center','split','stack'].includes(style.kineticComposition)?style.kineticComposition:'auto';const sizeBase=Number(style.fontSize)||82;const maxWidth=w*(.80+.08*(1-density));const gap=sizeBase*(.055+.035*density);
    const size=fit(ctx,text,sizeBase*(.96+energy*.12),maxWidth);const rows=layout(ctx,words,size,maxWidth,gap,mode,text+'|'+a.index);const lp=u.lineProgress(a.line,time,.10,.20);const enter=easeOut(lp.enter),exit=easeInOut(lp.exit);
    const lineY=h*(.50+.025*(hash(text)-.5));const drift=(1-enter)*w*.035*(.5+motion);
    const params={energy,hierarchy,motion,density,glow,travel:w*(.018+.035*motion),travelY:h*(.008+.018*motion),rotation:.018*motion,color:style.textColor||'#fff',accent:style.accentColor||'#fff'};
    ctx.save();ctx.translate(w/2+drift,lineY);ctx.scale(.96+.04*enter,.96+.04*enter);ctx.textAlign='center';ctx.textBaseline='middle';u.setContractFont(ctx,'mixedmedia',size);
    for(const row of rows)for(const word of row)drawWord(ctx,word,time,params,text+'|'+a.index);ctx.restore();
    if(a.next?.text&&exit<.82){const nextText=String(a.next.text).trim(),nextSize=fit(ctx,nextText,size*.72,maxWidth);u.setContractFont(ctx,'mixedmedia',nextSize);ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.globalAlpha=.055*(1-exit);ctx.fillStyle=params.accent;ctx.translate(w/2,h*(.50+.22*(1-exit)));ctx.fillText(nextText,0,0);ctx.restore();}
  };
})();
