/* KEFE — combined canvas-native lyric effect pack (72 effects).
   Uses the shared timing/layout engine so timed and untimed lyrics behave identically. */
(() => {
  'use strict';
  const U=window.kefeEffectUtils,E=window.kefeEffects=window.kefeEffects||{};
  if(!U){console.error('[KEFE combined effects] core.js must load first');return;}
  const clamp=U.clamp.bind(U),smooth=U.smoother.bind(U);
  const ids=["frost","void","script","brat","scrawl","slam","fly","crossfade","read","settle","ember","spark","bubblegum","stamp","slice","swash","round","brush","spin","neon","ink","dust","typewriter","liquid","editorial","depth","flip","lineslide","sweep","elastic","bloom","curtain","blinds","iris","diagonal","window","rollup","peel","sliceopen","glide","blurresolve","wave","scramble","tracking","kerning","centerstagger","edgestagger","falldown","riseup","jello","scatter","cylinder","depthecho","converge","tumble","parallax","holographic","glitch","chromatic","neonglow","liquidfill","goldfoil","aurora","spotlight","splitflap","marquee","splitreveal","punch","beat","skew","odometer","spiral"];
  const groups={
    serif:new Set(['script','swash','brush','editorial']),mono:new Set(['typewriter','scramble','splitflap','odometer','stamp']),
    bold:new Set(['brat','slam','bubblegum','round','punch','neonglow','glitch','stamp','slice']),
    chars:new Set(['typewriter','scramble','centerstagger','edgestagger','falldown','riseup','cylinder','odometer','spiral']),
    spring:new Set(['slam','stamp','punch','beat','jello','elastic','round']),
    depth:new Set(['depth','flip','splitflap','cylinder','spin','tumble','spiral','depthecho']),
    glow:new Set(['frost','ember','spark','spin','neon','ink','neonglow','goldfoil','aurora','holographic']),
    gradient:new Set(['sweep','holographic','goldfoil','aurora','spotlight']),
    reveal:new Set(['liquid','iris','curtain','blinds','diagonal','window','sliceopen','splitreveal','peel']),
    motion:new Set(['fly','glide','lineslide','riseup','rollup','falldown','editorial','centerstagger','edgestagger','converge','scatter'])
  };
  const palette=k=>k==='brat'?['#8ace00','#8ace00','#d6ff72']:
    ['bubblegum','round','jello'].includes(k)?['#ffe4ef','#f472b6','#fff']:
    ['script','swash','brush','goldfoil','ember','spark'].includes(k)?['#fff0c9','#e9b85c','#fff9e8']:
    ['neon','neonglow'].includes(k)?['#e0ffff','#22d3ee','#a5f3fc']:
    ['void','frost'].includes(k)?['#dce5f6','#a9c7ff','#fff']:
    ['glitch','chromatic'].includes(k)?['#f8fafc','#fb7185','#22d3ee']:
    ['holographic','aurora'].includes(k)?['#a7f3d0','#c4b5fd','#67e8f9']:
    ['ink','dust'].includes(k)?['#f5e7d4','#b8a28c','#fff']:['#f8fafc','#cbd5e1','#fff'];
  const hash=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
  function setFont(ctx,style,key,size){
    const custom=String(style?.kefeMotionFont||'').trim();
    const family=custom&&custom!=='Open Sans'?custom:groups.serif.has(key)?'Georgia':groups.mono.has(key)?'Courier New':key==='brat'||key==='slice'?'Arial Narrow':'Open Sans';
    U.setFont(ctx,family,size,groups.bold.has(key)?900:groups.serif.has(key)?500:800);
  }
  function gradient(ctx,x,y,w,key){
    const p=palette(key),g=ctx.createLinearGradient(x,y,x+Math.max(1,w),y);
    g.addColorStop(0,p[0]);g.addColorStop(.5,p[1]);g.addColorStop(1,p[2]);return g;
  }
  function drawWord(ctx,key,wd,x,y,width,size,time,index){
    const p=palette(key),phase=U.wordProgress(wd,time,.14),dur=Math.max(.06,wd.endTime-wd.time);
    const enter=smooth((time-wd.time+.08)/Math.max(.2,Math.min(.7,dur*.7)));
    const local=clamp((time-wd.time)/Math.max(.18,Math.min(1.1,dur)));
    const pulse=.5+.5*Math.sin(time*5.4+index*.72),cx=x+width/2;
    let dx=0,dy=0,sx=1,sy=1,rot=0,skew=0,alpha=.18+.82*enter,blur=0,tracking=0;
    let color=p[0],stroke='',sw=0,glow=0;
    if(groups.motion.has(key)){
      if(['fly','glide','converge'].includes(key))dx=(1-enter)*(index%2?1:-1)*size*(key==='converge'?.85:1.7);
      if(['lineslide','riseup','rollup','editorial','centerstagger','edgestagger'].includes(key))dy=(1-enter)*size*.85;
      if(key==='falldown')dy=-(1-enter)*size*1.35;
      if(key==='scatter'){dx+=(1-enter)*(hash(index+17)-.5)*size*1.8;dy+=(1-enter)*(hash(index+91)-.5)*size*1.2;rot=(1-enter)*(hash(index+7)-.5)*.7;}
    }
    if(groups.spring.has(key)){
      const bounce=1+Math.sin(Math.min(1,local)*Math.PI)*.3;
      sx*=key==='jello'?1+Math.sin(local*Math.PI*3)*.12:bounce;sy*=key==='jello'?1-Math.sin(local*Math.PI*3)*.09:1/Math.max(.68,bounce);
      if(['slam','stamp'].includes(key))rot=(1-enter)*(index%2?-1:1)*.11;
      if(key==='beat'){sx*=1+pulse*.09;sy*=1+pulse*.09;}
    }
    if(groups.depth.has(key)){
      sx*=key==='depth'?.72+.28*enter:key==='cylinder'?Math.max(.08,Math.abs(Math.cos((1-enter)*Math.PI/2))):.12+.88*enter;
      if(['flip','splitflap'].includes(key))sy*=.12+.88*enter;
      if(key==='depth')rot=(1-enter)*-.22;
      if(['spin','tumble','spiral'].includes(key))rot+=(1-enter)*(key==='spin'?Math.PI*2:key==='tumble'?Math.PI*3:Math.PI*1.5);
      if(key==='depthecho')glow=size*.14;
    }
    if(key==='skew')skew=(1-enter)*.35;
    if(key==='parallax')dx=Math.sin(time*1.3+index)*size*.08;
    if(key==='wave')dy=Math.sin(time*4+index*.9)*size*.12;
    if(key==='marquee')dx=Math.sin(time*.8)*size*.55;
    if(key==='tracking')tracking=size*.16*(1-enter);
    if(key==='kerning')tracking=size*(.02+.025*Math.sin(time*1.8));
    if(key==='dust'){alpha*=.2+.8*enter;blur=(1-enter)*5;dx+=(1-enter)*size*.2;}
    if(key==='blurresolve'||key==='bloom')blur=(1-enter)*(key==='bloom'?10:14);
    if(key==='brat'){color='#8ace00';tracking=-size*.025;}
    if(key==='void'){color='rgba(0,0,0,0)';stroke='#dce5f6';sw=Math.max(1.2,size*.018);glow=size*.2;}
    if(key==='scrawl'){rot=Math.sin(time*2+index)*.035;dx+=Math.sin(time*5+index)*1.5;}
    if(['ember','spark'].includes(key)){color=p[1];glow=size*.38;}
    if(['bubblegum','round'].includes(key)){stroke=key==='bubblegum'?'#f472b6':'#111827';sw=Math.max(2,size*.065);}
    if(groups.glow.has(key))glow=Math.max(glow,size*.2);
    if(key==='neon'||key==='neonglow')color='#e0ffff';
    if(groups.gradient.has(key))color=gradient(ctx,x,y,width,key);
    if(['frost','read','liquidfill','sweep'].includes(key))color=U.sweepFill(ctx,x,width,phase.sweep,p[1],p[0],.18);
    if(key==='glitch'||key==='chromatic'){dx+=(hash(Math.floor(time*18)+index*13)-.5)*size*.12;dy+=(hash(Math.floor(time*23)+index*7)-.5)*size*.05;}
    if(groups.reveal.has(key)){alpha*=enter;if(key==='blinds')sy*=Math.max(.05,enter);if(key==='window')sx*=Math.max(.05,enter);if(['sliceopen','splitreveal'].includes(key))sx*=Math.max(.05,enter);}
    if(key==='liquid'){sy*=.8+.2*enter;dy+=(1-enter)*size*.4;}
    if(key==='iris')alpha*=enter;
    if(key==='odometer')dy+=(1-enter)*size*.7;
    if(key==='crossfade')alpha*=.45+.55*phase.sweep;
    if(key==='typewriter')alpha*=phase.started?1:0;
    if(key==='scramble'&&local<.88){
      const chars=Array.from(wd.text),glyphs='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
      const out=chars.map((ch,i)=>local>(i+1)/chars.length?ch:glyphs[Math.floor(hash(index+i+Math.floor(time*22))*glyphs.length)]).join('');
      ctx.save();ctx.globalAlpha*=alpha;ctx.fillStyle=p[1];ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(out,cx+dx,y+dy);ctx.restore();return;
    }
    if(key==='typewriter'){
      const chars=Array.from(wd.text),n=Math.floor(chars.length*phase.sweep);if(!n)return;
      ctx.save();ctx.globalAlpha*=alpha;ctx.fillStyle=color;ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(chars.slice(0,n).join(''),x+dx,y+dy);ctx.restore();return;
    }
    if(groups.chars.has(key)){
      let cursor=x;
      Array.from(wd.text).forEach((ch,i,chars)=>{
        const cw=ctx.measureText(ch).width,cp=U.charProgress(wd,i,chars.length,time,.78,.32),mid=i-(chars.length-1)/2;
        let cdx=dx,cdy=dy,csx=sx,cr=rot;
        if(key==='centerstagger')cdy+=(1-cp)*size*(Math.abs(mid)+.5)*.09;
        if(key==='edgestagger')cdy+=(1-cp)*size*(chars.length/2-Math.abs(mid))*.09;
        if(key==='falldown')cdy-=(1-cp)*size*.8;
        if(key==='riseup')cdy+=(1-cp)*size*.8;
        if(key==='cylinder')csx*=Math.max(.05,Math.abs(Math.cos((1-cp)*Math.PI/2)));
        if(key==='spiral'){cdx+=(1-cp)*Math.cos(i*.8+time*2)*size*.5;cdy+=(1-cp)*Math.sin(i*.8+time*2)*size*.5;cr+=(1-cp)*.4;}
        if(key==='odometer')cdy+=(1-cp)*size*.65;
        ctx.save();ctx.globalAlpha*=alpha*(.2+.8*cp);ctx.translate(cursor+cw/2+cdx,y+cdy);ctx.rotate(cr);ctx.scale(csx,sy);
        ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.shadowColor=glow?'rgba(255,255,255,.8)':'transparent';ctx.shadowBlur=glow;ctx.fillText(ch,0,0);ctx.restore();cursor+=cw;
      });return;
    }
    ctx.save();ctx.globalAlpha*=clamp(alpha);ctx.translate(cx+dx,y+dy);ctx.rotate(rot);ctx.transform(1,0,skew,1,0,0);ctx.scale(sx,sy);
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.shadowColor=glow?p[1]:'transparent';ctx.shadowBlur=glow;
    if(blur&&'filter'in ctx)ctx.filter='blur('+blur.toFixed(1)+'px)';
    if(tracking)U.drawTrackedText(ctx,wd.text,0,0,tracking);else ctx.fillText(wd.text,0,0);
    if(stroke){ctx.lineWidth=sw;ctx.lineJoin='round';ctx.strokeStyle=stroke;ctx.strokeText(wd.text,0,0);}
    if(['neon','neonglow'].includes(key)){ctx.strokeStyle='rgba(255,255,255,.9)';ctx.lineWidth=Math.max(1,size*.012);ctx.strokeText(wd.text,0,0);}
    if(key==='bubblegum'){ctx.lineWidth=Math.max(2,size*.065);ctx.strokeStyle='#f9a8d4';ctx.strokeText(wd.text,0,0);}
    if(['glitch','chromatic'].includes(key)){ctx.globalAlpha*=.35;ctx.fillStyle='#22d3ee';ctx.fillText(wd.text,-size*.04,0);}
    if(['liquidfill','read','frost'].includes(key)){ctx.globalAlpha*=.9;ctx.fillStyle=U.sweepFill(ctx,-width,width,phase.sweep,p[1],p[0],.18);ctx.fillText(wd.text,0,0);}
    if(groups.gradient.has(key)){ctx.globalAlpha*=.35;ctx.fillStyle=gradient(ctx,-width/2,-size/2,width,key);ctx.fillText(wd.text,0,0);}
    ctx.restore();
  }
  function render(ctx,w,h,style,lines,time,key){
    if(!ctx||!w||!h||!Array.isArray(lines)||!lines.length)return;
    const size=clamp(Number(style?.fontSize)||Math.min(w,h)*.13,18,Math.min(w,h)*.24);
    const stack=U.lineStack(lines,time,.28,.24);if(!stack.length)return;
    stack.forEach((entry,si)=>{
      const line=entry.line||{},words=U.wordsFor(line,entry.next||null);if(!words.length)return;
      const layout=U.fitWordRows(ctx,words,{setFont:(target,px)=>setFont(target,style,key,px),size,minSize:Math.max(18,size*.42),maxWidth:w*.86,maxHeight:h*.62,maxLines:4,lineHeight:1.16,gapEm:.28});
      let y=(h-layout.rows.length*layout.lineH)/2+layout.lineH/2;
      ctx.save();ctx.globalAlpha*=clamp(entry.alpha??1);ctx.textAlign='center';ctx.textBaseline='middle';
      layout.rows.forEach((row,ri)=>{let x=(w-row.width)/2;row.words.forEach((wd,wi)=>{const ww=ctx.measureText(wd.text).width;drawWord(ctx,key,wd,x,y,ww,layout.size,time,si*100+ri*20+wi);x+=ww+layout.gap;});y+=layout.lineH;});
      ctx.restore();
    });
  }
  ids.forEach(key=>{E[key]=(ctx,w,h,style,lines,time)=>render(ctx,w,h,style,lines,time,key);});
  if(typeof window.dispatchEvent==='function'&&typeof CustomEvent==='function')window.dispatchEvent(new CustomEvent('kefe-effects-ready'));
})();
