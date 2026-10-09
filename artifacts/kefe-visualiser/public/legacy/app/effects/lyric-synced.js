/* KEFE — Synced Lyrics. Adapted from the supplied full-screen template for KEFE's canvas renderer. */
(function(){
  'use strict';
  window.kefeEffects=window.kefeEffects||{};
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));
  const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
  const modes=['portrait','focus','wide'];
  let layout=0,bgMode='ambient',offsetY=0,lastActive=-1,scrollY=0,lastNow=0,blobs=[],mountedStage=null,controls=null,artwork=null,palette=['#3d2c4f','#1c384c'];
  const hexRgb=h=>{const m=String(h).match(/^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);return m?m.slice(1).map(v=>parseInt(v,16)):[80,60,100];};
  function imageFor(img){return img&&img.complete&&img.naturalWidth?img:null;}
  function activeIndex(lines,t){let lo=0,hi=lines.length-1,res=-1;while(lo<=hi){const m=(lo+hi)>>1;if(Number(lines[m].time)<=t){res=m;lo=m+1;}else hi=m-1;}return res;}
  function wordsFor(line,next){
    if(Array.isArray(line.words)&&line.words.length)return line.words.map((w,i,a)=>({text:String(w.text||'').trim(),start:Number(w.time),end:Number(w.endTime)>Number(w.time)?Number(w.endTime):Number(a[i+1]?.time)>Number(w.time)?Number(a[i+1].time):Number(line.endTime)>Number(w.time)?Number(line.endTime):Number(w.time)+.3})).filter(w=>w.text);
    const tokens=String(line.text||'').trim().split(/\s+/).filter(Boolean),start=Number(line.time)||0,end=Number(next?.time)>start?Number(next.time):Number(line.endTime)>start?Number(line.endTime):start+3;
    const weights=tokens.map(s=>Math.max(1,Array.from(s.replace(/[^\p{L}\p{N}]/gu,'')).length**.72)),total=weights.reduce((a,b)=>a+b,0)||1;let cur=0;
    return tokens.map((text,i)=>{const a=start+(end-start)*cur/total;cur+=weights[i];return{text,start:a,end:start+(end-start)*cur/total};});
  }
  function setActive(active){
    const stage=document.querySelector('.kefe-stage');if(!stage)return;
    const existing=stage.querySelector('.kefe-synced-controls');
    if(existing)existing.hidden=!active;
    if(active)mountControls(stage);
  }
  function mountControls(stage){
    if(mountedStage===stage&&controls)return;
    mountedStage=stage;
    controls=document.createElement('div');controls.className='kefe-synced-controls';
    controls.style.cssText='position:absolute;inset:0;z-index:30;pointer-events:none;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif';
    const style=document.createElement('style');style.textContent='.kefe-synced-controls button{font:500 11px -apple-system,BlinkMacSystemFont,sans-serif;border:1px solid rgba(255,255,255,.65);background:#f1f1f3;color:#2b2b31;border-radius:999px;padding:5px 9px;cursor:pointer;box-shadow:0 5px 14px #0005,inset 0 1px 0 #fff}.kefe-synced-controls button[aria-pressed="true"]{box-shadow:inset 1px 1px 3px #0003;background:#dddde2}.kefe-synced-controls .bg{position:absolute;left:12px;bottom:12px;display:flex;gap:3px;padding:4px;border-radius:999px;background:#f1f1f3;pointer-events:auto}.kefe-synced-controls .layout{position:absolute;right:12px;bottom:12px;display:flex;gap:3px;padding:4px;border-radius:999px;background:#f1f1f3;pointer-events:auto}.kefe-synced-controls[hidden]{display:none}';
    controls.appendChild(style);
    const bg=document.createElement('div');bg.className='bg';bg.setAttribute('aria-label','Background mode');
    [['ambient','Ambient'],['artwork','Artwork'],['motion','Motion']].forEach(([mode,label])=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.mode=mode;b.setAttribute('aria-pressed',String(bgMode===mode));b.addEventListener('click',()=>{bgMode=mode;bg.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.mode===mode)));});bg.appendChild(b);});
    const lay=document.createElement('div');lay.className='layout';lay.setAttribute('aria-label','Lyrics layout');
    modes.forEach((mode,i)=>{const b=document.createElement('button');b.type='button';b.textContent=['Portrait','Focus','Wide'][i];b.setAttribute('aria-pressed',String(layout===i));b.addEventListener('click',()=>{layout=i;lay.querySelectorAll('button').forEach((x,j)=>x.setAttribute('aria-pressed',String(i===j)));offsetY=0;});lay.appendChild(b);});
    controls.append(bg,lay);stage.appendChild(controls);
    if(!stage.dataset.syncedWheel){stage.dataset.syncedWheel='1';stage.addEventListener('wheel',e=>{if(!stage.querySelector('.kefe-synced-controls:not([hidden])'))return;if(Math.abs(e.deltaY)<1)return;e.preventDefault();offsetY=clamp((offsetY-e.deltaY*.9)/3000,-1,1)*3000;},{passive:false});}
  }
  function colorFill(ctx,w,h,img){
    ctx.fillStyle='#05050a';ctx.fillRect(0,0,w,h);
    if(bgMode==='ambient'){
      const g=ctx.createRadialGradient(w*.2,h*.1,0,w*.2,h*.1,Math.max(w,h)*.9);g.addColorStop(0,'rgba(80,50,95,.65)');g.addColorStop(.55,'rgba(20,48,65,.32)');g.addColorStop(1,'rgba(5,5,10,1)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
      const g2=ctx.createRadialGradient(w*.85,h*.8,0,w*.85,h*.8,Math.max(w,h)*.75);g2.addColorStop(0,'rgba(30,80,110,.34)');g2.addColorStop(1,'rgba(5,5,10,0)');ctx.fillStyle=g2;ctx.fillRect(0,0,w,h);
    }else if(bgMode==='artwork'&&img){
      ctx.save();ctx.filter='blur('+Math.max(24,Math.min(w,h)*.19)+'px) saturate(175%) brightness(.62)';
      const side=Math.max(w,h)*1.6;ctx.drawImage(img,(w-side)*.45,(h-side)*.42,side,side);ctx.restore();
      const g=ctx.createRadialGradient(w*.5,h*.46,0,w*.5,h*.46,Math.max(w,h)*.8);g.addColorStop(0,'rgba(0,0,0,.2)');g.addColorStop(1,'rgba(0,0,0,.78)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    }else if(bgMode==='motion'){
      if(!blobs.length)blobs=Array.from({length:5},(_,i)=>({x:.1+Math.random()*.8,y:.1+Math.random()*.8,r:.35+Math.random()*.35,c:hexRgb(palette[i%palette.length]||'#3d2c4f'),p:Math.random()*6}));
      const now=performance.now()/1000;
      blobs.forEach((b,i)=>{const x=(b.x+Math.sin(now*.12+b.p)*.07)*w,y=(b.y+Math.cos(now*.16+b.p)*.08)*h,r=b.r*Math.max(w,h);const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba('+b.c.join(',')+',.48)');g.addColorStop(.45,'rgba('+b.c.join(',')+',.16)');g.addColorStop(1,'rgba('+b.c.join(',')+',0)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);});
      if(img){ctx.save();ctx.globalAlpha=.35;ctx.filter='blur(32px) saturate(180%) brightness(.55)';const s=Math.max(w,h)*1.1;ctx.drawImage(img,(w-s)/2,(h-s)/2,s,s);ctx.restore();}
    }
  }
  function draw(ctx,w,h,style,lines,time,img){
    if(!Array.isArray(lines)||!lines.length){setActive(true);colorFill(ctx,w,h,imageFor(img));return;}
    setActive(true);img=imageFor(img);
    const stage=document.querySelector('.kefe-stage');
    if(stage&&img&&img!==artwork){artwork=img;try{const c=document.createElement('canvas');c.width=c.height=32;const cctx=c.getContext('2d',{willReadFrequently:true});cctx.drawImage(img,0,0,32,32);const d=cctx.getImageData(0,0,32,32).data;let sums=[[0,0,0,0],[0,0,0,0]];for(let i=0;i<d.length;i+=4){if(d[i+3]<100)continue;const k=(d[i]+d[i+1]+d[i+2])>380?0:1;sums[k][0]+=d[i];sums[k][1]+=d[i+1];sums[k][2]+=d[i+2];sums[k][3]++;}palette=sums.filter(s=>s[3]).map(s=>'rgb('+s.slice(0,3).map(v=>Math.round(v/s[3])).join(',')+')');blobs=[];}catch(_){}}
    colorFill(ctx,w,h,img);
    const title=document.getElementById('songTitle')?.value?.trim()||'Untitled';
    const artist=document.getElementById('songArtist')?.value?.trim()||'Unknown artist';
    const unit=Math.min(w,h),heroSize=layout===2?unit*.22:layout===1?unit*.32:unit*.28;
    const wide=layout===2, maxW=w*(wide ? .82 : layout===1 ? .66 : .8), padX=w*(wide ? .07 : .06);
    const active=activeIndex(lines,time),idx=Math.max(0,active);
    const headerY=h*.07, artX=wide?w*.5-heroSize*.95:w*.5-heroSize/2, artY=wide?h*.12:headerY;
    ctx.save();ctx.shadowColor='rgba(0,0,0,.65)';ctx.shadowBlur=unit*.07;
    if(img){ctx.save();ctx.beginPath();ctx.roundRect(artX,artY,heroSize,heroSize,unit*.025);ctx.clip();ctx.drawImage(img,artX,artY,heroSize,heroSize);ctx.restore();}
    else{const g=ctx.createLinearGradient(artX,artY,artX+heroSize,artY+heroSize);g.addColorStop(0,'#4a3e5c');g.addColorStop(1,'#1f2c38');ctx.fillStyle=g;ctx.fillRect(artX,artY,heroSize,heroSize);}
    ctx.restore();
    ctx.textAlign=wide?'left':'center';ctx.textBaseline='top';ctx.fillStyle='#fff';ctx.shadowColor='rgba(0,0,0,.4)';ctx.shadowBlur=unit*.025;
    if(wide){ctx.font='700 '+Math.max(18,unit*.04)+'px -apple-system,BlinkMacSystemFont,sans-serif';ctx.fillText(title,w*.5+heroSize*.12,artY+heroSize*.28,w*.35);ctx.globalAlpha=.72;ctx.font='500 '+Math.max(12,unit*.025)+'px -apple-system,BlinkMacSystemFont,sans-serif';ctx.fillText(artist,w*.5+heroSize*.12,artY+heroSize*.49,w*.35);ctx.globalAlpha=1;}
    else{ctx.font='700 '+Math.max(18,unit*.038)+'px -apple-system,BlinkMacSystemFont,sans-serif';ctx.fillText(title,w/2,artY+heroSize+unit*.025,maxW);ctx.globalAlpha=.72;ctx.font='500 '+Math.max(12,unit*.024)+'px -apple-system,BlinkMacSystemFont,sans-serif';ctx.fillText(artist,w/2,artY+heroSize+unit*.08,maxW);ctx.globalAlpha=1;}
    const lyricTop=wide?artY+heroSize+unit*.18:artY+heroSize+unit*.17;
    const lyricSize=layout===1?Math.max(30,Math.min(48,w*.056)):layout===2?Math.max(22,Math.min(34,w*.024)):Math.max(26,Math.min(42,w*.05));
    const gap=layout===1?Math.max(30,h*.05):layout===2?Math.max(22,h*.034):Math.max(28,h*.046);
    const maxLines=layout===2?3:5, activeY=h*.51+offsetY, spacing=gap;
    const scrollEase=.22;
    const target=active>=0?activeY-(lyricTop+idx*spacing):0;
    if(lastActive!==active){lastActive=active;lastNow=time;}
    scrollY+=(target-scrollY)*scrollEase;
    const baseline=activeY;
    ctx.textAlign=wide?'center':'left';ctx.textBaseline='middle';ctx.shadowBlur=0;
    const from=Math.max(0,idx-maxLines),to=Math.min(lines.length-1,idx+maxLines);
    for(let i=from;i<=to;i++){
      const line=lines[i],rel=i-idx,y=baseline+rel*spacing;
      if(y<h*.12||y>h*.92)continue;
      const words=wordsFor(line,lines[i+1]),isActive=i===idx,prev=i<idx;
      const f=lyricSize*(isActive ? 1.04 : prev ? .99 : .97);
      ctx.save();ctx.translate(wide?w/2:padX,y);ctx.scale(isActive ? 1.04 : prev ? .99 : .97,1);ctx.textAlign=wide?'center':'left';ctx.font='700 '+f+'px -apple-system,BlinkMacSystemFont,"SF Pro Display",sans-serif';
      const full=words.map(x=>x.text).join(' ');let text=full;while(ctx.measureText(text).width>maxW&&text.length>3)text=text.slice(0,-2)+'…';
      if(text!==full){ctx.globalAlpha=prev ? .20 : isActive ? .34 : .13;ctx.fillStyle='#fff';ctx.filter=prev?'blur(1.1px)':'none';ctx.fillText(text,0,0,maxW);}
      else{
        let x=0;const total=words.reduce((s,word)=>s+ctx.measureText(word.text).width,0)+Math.max(0,words.length-1)*lyricSize*.28;
        if(wide)x=-total/2;
        words.forEach(word=>{
          const ww=ctx.measureText(word.text).width,ws=Number(word.start??(Number(line.time)||0)),we=Math.max(ws+.06,Number(word.end)||ws+.3),p=clamp((time-ws)/(we-ws));
          ctx.globalAlpha=prev ? .20 : isActive ? .34 : .13;ctx.fillStyle='#fff';ctx.filter=prev?'blur(1.1px)':isActive?'none':'blur(1.4px)';ctx.fillText(word.text,x,0);
          ctx.filter='none';if(p>0){ctx.save();ctx.beginPath();ctx.rect(x,-f,ww*p,f*2);ctx.clip();ctx.globalAlpha=1;ctx.fillStyle='#fff';ctx.shadowColor='rgba(255,255,255,.2)';ctx.shadowBlur=isActive?18:0;ctx.fillText(word.text,x,0);ctx.restore();}
          x+=ww+lyricSize*.28;
        });
      }
      ctx.restore();
    }
    ctx.restore();
    const fade=ctx.createLinearGradient(0,0,0,h*.2);fade.addColorStop(0,'rgba(5,5,8,.8)');fade.addColorStop(1,'rgba(5,5,8,0)');ctx.fillStyle=fade;ctx.fillRect(0,0,w,h);
    const bottom=ctx.createLinearGradient(0,h*.8,0,h);bottom.addColorStop(0,'rgba(5,5,8,0)');bottom.addColorStop(1,'rgba(5,5,8,.8)');ctx.fillStyle=bottom;ctx.fillRect(0,h*.8,w,h*.2);
  }
  draw.setActive=setActive;
  window.kefeEffects.syncedlyrics=draw;
})();
