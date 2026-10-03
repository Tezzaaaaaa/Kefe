(() => {
  'use strict';

  window.kefeEffects = window.kefeEffects || {};
  window.kefeEffectUtils = {
    clamp(v,a=0,b=1){return Math.max(a,Math.min(b,Number(v)||0));},
    activeLine(lines,time){
      let index=-1;
      for(let i=0;i<lines.length;i++){if(time>=Number(lines[i].time||0))index=i;else break;}
      if(index<0)return null;
      return {index,line:lines[index],next:lines[index+1]||null};
    },
    lineProgress(line,time){
      const start=Number(line?.time)||0;
      const end=Math.max(start+.3,Number(line?.endTime)||start+3);
      const enter=this.clamp((time-start)/.35),exit=this.clamp((end-time)/.35);
      return {opacity:Math.min(enter,exit),enter,exit};
    },
    wordsFor(line,next){
      if(Array.isArray(line?.words)&&line.words.length)return line.words;
      const text=String(line?.text||'').trim();
      if(!text)return [];
      const tokens=text.split(/\s+/).filter(Boolean);
      const start=Number(line?.time)||0;
      const end=Number(line?.endTime)||Number(next?.time)||start+3;
      const step=Math.max(.08,(end-start)/tokens.length);
      return tokens.map((text,i)=>({text,time:start+i*step,endTime:start+(i+1)*step}));
    },
    setContractFont(ctx,id,size){
      const c=window.KEFE_TYPE?.effects?.[id]||{};
      ctx.font=`${c.weight||700} ${Math.max(18,size)}px "${c.family||'Open Sans'}",system-ui,sans-serif`;
    }
  };

  const baseFonts=Object.values(window.KEFE_TYPE?.families||{});
  const fontSelect=document.getElementById('fontOverride');
  [...new Set(baseFonts)].forEach(f=>{
    const o=document.createElement('option');
    o.value=f;o.textContent=f;o.style.fontFamily='"'+f+'",sans-serif';
    fontSelect.appendChild(o);
  });

  const effectDefinitions=Array.isArray(window.KEFE_EFFECTS)?window.KEFE_EFFECTS.map(e=>[e.key,e.label]):[];

  let state={effect:'apple',fontOverride:'',lines:[],appleLines:[],time:0};
  const canvas=document.getElementById('kefeCanvas'),ctx=canvas.getContext('2d');
  const lyricsInput=document.getElementById('lyricsInput');
  const audio=document.getElementById('kefeAudio'),range=document.getElementById('kefeTime');
  const video=document.createElement('video');
  video.preload='metadata'; video.muted=true; video.playsInline=true; video.style.display='none'; document.body.appendChild(video);
  let mediaObjectUrl=''; let visualiserPreset='none',visualiserBackground='black',visualiserMotion='reactive';
  let previewAspectRatio='16:9';
  const titleCard=document.getElementById('kefeTitleCard'),titleName=document.getElementById('kefeTitleName'),titleArtist=document.getElementById('kefeTitleArtist'),titleAlbum=document.getElementById('kefeTitleAlbum'),titleYear=document.getElementById('kefeTitleYear'),titleArt=document.getElementById('kefeTitleArt'),titleArtFallback=document.getElementById('kefeTitleArtFallback');
  let titleCardTimer=null,titleCardShownFor='';
  const songTitle=document.getElementById('songTitle'),songArtist=document.getElementById('songArtist'),songAlbum=document.getElementById('songAlbum'),songYear=document.getElementById('songYear');
  const previewStage=document.querySelector('.kefe-stage');
  const timeNow=document.getElementById('timeNow'),timeEnd=document.getElementById('timeEnd'),playhead=document.getElementById('playhead');

  function normalizeArtworkUrl(url,size='600x600bb'){
    const value=String(url||'').trim();
    if(!value)return '';
    return value.replace(/^http:/i,'https:').replace(/\d+x\d+bb(?=[.-])/i,size);
  }

  function updateMediaTrack(){
    const track=document.getElementById('kefeMediaTrack');
    const art=document.getElementById('kefeMediaTrackArt');
    const fallback=document.getElementById('kefeMediaTrackFallback');
    const title=document.getElementById('kefeMediaTrackTitle');
    const artist=document.getElementById('kefeMediaTrackArtist');
    const album=document.getElementById('kefeMediaTrackAlbum');
    const year=document.getElementById('kefeMediaTrackYear');
    if(!track||!art||!fallback||!title||!artist||!album||!year)return;
    const song=songTitle.value.trim();
    const cover=songAlbum.dataset.artUrl||'';
    title.textContent=song||'Untitled';
    artist.textContent=songArtist.value.trim()||'Unknown artist';
    album.textContent=songAlbum.value.trim()||'';
    year.textContent=songYear.value.trim()||'';
    art.innerHTML='';
    if(cover){
      const image=document.createElement('img');
      image.src=normalizeArtworkUrl(cover);
      image.alt='';
      image.onerror=()=>{image.remove();art.appendChild(fallback);};
      art.appendChild(image);
    }else{
      art.appendChild(fallback);
    }
    track.hidden=!song;
    const suggestions=document.getElementById('kefeSuggestions');
    const suggestionArt=document.getElementById('kefeSuggestionArt');
    if(suggestionArt){
      suggestionArt.innerHTML='';
      if(cover){
        const image=document.createElement('img');
        image.src=cover;
        image.alt='';
        suggestionArt.appendChild(image);
        suggestionArt.style.display='block';
      }else{
        suggestionArt.style.display='none';
      }
    }
    if(suggestions)suggestions.hidden=!song;
  }
  function renderSongSuggestions(results,opts={}){
    const panel=document.getElementById('kefeSuggestions');
    const list=document.getElementById('kefeSuggestionList');
    const status=document.getElementById('kefeSuggestionsStatus');
    if(!panel||!list||!status)return;
    list.innerHTML='';
    const currentTitle=songTitle.value.trim().toLowerCase();
    const currentArtist=songArtist.value.trim().toLowerCase();
    const items=(Array.isArray(results)?results:[]).filter(item=>item.trackName).filter(item=>!opts.excludeCurrent||!(String(item.trackName||'').toLowerCase()===currentTitle&&String(item.artistName||'').toLowerCase()===currentArtist)).slice(0,opts.limit||5);
    status.textContent=opts.excludeCurrent?(items.length?'Other matches':'No other matches'):(items.length?'Select the correct song':'No matches found');
    panel.hidden=!songTitle.value.trim();
    items.forEach(item=>{
      const button=document.createElement('button');
      button.type='button';
      button.className='kefe-suggestion';
      const art=document.createElement('div');
      art.className='kefe-suggestion-art';
      const image=document.createElement('img');
      image.src=(item.artworkUrl100||'').replace(/100x100bb\.(jpg|jpeg|png)$/i,'200x200bb.$1');
      image.alt='';
      art.appendChild(image);
      const copy=document.createElement('div');
      copy.className='kefe-suggestion-copy';
      const name=document.createElement('div');
      name.className='kefe-suggestion-name';
      name.textContent=item.trackName||'Untitled';
      const artist=document.createElement('div');
      artist.className='kefe-suggestion-artist';
      artist.textContent=item.artistName||'Unknown artist';
      const album=document.createElement('div');
      album.className='kefe-suggestion-album';
      album.textContent=item.collectionName||'';
      copy.append(name,artist,album);
      button.append(art,copy);
      button.addEventListener('click',()=>{
        songTitle.value=item.trackName||'';
        songArtist.value=item.artistName||'';
        songAlbum.value=item.collectionName||'';
        songYear.value=item.releaseDate?String(item.releaseDate).slice(0,4):'';
        songAlbum.dataset.artUrl=normalizeArtworkUrl(item.artworkUrl100);
        songAlbum.dataset.trackDuration=item.trackTimeMillis?String(Math.round(Number(item.trackTimeMillis)/1000)):'';
        songAlbum.dataset.platformId=item.trackId?String(item.trackId):'';
        updateMediaTrack();
        updateTitleCard();
        applyAppleAlbumGradient();
        syncAppleLyricsMetadata();
        clearManualNotice();
        panel.hidden=true;
        list.innerHTML='';
        loadAutomaticLyrics();
      });
      list.appendChild(button);
    });
  }
  function updateTitleCard(){
    updateMediaTrack();
    if(!titleCard)return;
    titleName.textContent=songTitle.value.trim()||'Untitled';
    titleArtist.textContent=songArtist.value.trim()||'Unknown artist';
    titleAlbum.textContent=songAlbum.value.trim()||'';
    titleYear.textContent=songYear.value.trim()||'';
    const cover=songAlbum.dataset.artUrl||'';
    if(cover){
      titleArt.innerHTML='';
      const image=document.createElement('img');
      image.crossOrigin='anonymous';
      image.src=normalizeArtworkUrl(cover);
      image.alt='';
      image.onerror=()=>{titleArt.innerHTML='';titleArt.appendChild(titleArtFallback);};
      image.addEventListener('load',()=>draw(),{once:true});
      titleArt.appendChild(image);
    }else{
      titleArt.innerHTML='';
      titleArt.appendChild(titleArtFallback);
    }
  }
  function applyAppleAlbumGradient(){
    const appleLyrics=document.getElementById('kefeAppleLyrics'),artUrl=songAlbum?.dataset.artUrl;
    if(!appleLyrics||!artUrl)return;
    const img=new Image();img.crossOrigin='anonymous';img.onload=()=>{try{
      const sample=document.createElement('canvas'),size=40,ctx2=sample.getContext('2d',{willReadFrequently:true});sample.width=size;sample.height=size;ctx2.drawImage(img,0,0,size,size);
      const data=ctx2.getImageData(0,0,size,size).data,points=[];
      for(let i=0;i<data.length;i+=4){const r=data[i],g=data[i+1],b=data[i+2],a=data[i+3],max=Math.max(r,g,b),min=Math.min(r,g,b);if(a>180&&max>22)points.push([r,g,b]);}
      if(!points.length)return;
      const seeds=[[0,0,0],[0,0,0],[0,0,0]],groups=[[],[],[]];
      points.forEach((p,i)=>{let best=0,bestDistance=Infinity;for(let j=0;j<seeds.length;j++){const d=(p[0]-seeds[j][0])**2+(p[1]-seeds[j][1])**2+(p[2]-seeds[j][2])**2;if(d<bestDistance){bestDistance=d;best=j;}}groups[best].push(p);});
      points.slice(0,Math.min(points.length,600)).forEach((p,i)=>{const j=i%3;seeds[j]=seeds[j].map((v,k)=>Math.round((v*(groups[j].length||1)+p[k])/(groups[j].length+1)));});
      const color=group=>{const source=group.length?group:points;let r=0,g=0,b=0;source.forEach(p=>{r+=p[0];g+=p[1];b+=p[2]});r/=source.length;g/=source.length;b/=source.length;const max=Math.max(r,g,b),min=Math.min(r,g,b),boost=max-min<28?1.35:1.12;const lift=v=>Math.min(255,Math.max(12,Math.round(v*.62*boost+18)));return 'rgb('+lift(r)+','+lift(g)+','+lift(b)+')';};
      appleLyrics.style.setProperty('--kefe-album-a',color(groups[0]));appleLyrics.style.setProperty('--kefe-album-b',color(groups[1]));appleLyrics.style.setProperty('--kefe-album-c',color(groups[2]));
    }catch(err){console.warn('[KEFE album gradient]',err);}};img.src=artUrl;
  }
  function showTitleCard(){
    // Title card is now painted on the lyrics canvas (drawTitleCardCanvas) so it is part of video export.
    if(!audio.src)return;updateTitleCard();titleCardShownFor=mediaObjectUrl;applyAppleAlbumGradient();draw();
  }
  function hideTitleCard(){
    if(!titleCard||!titleCard.classList.contains('active')||titleCard.classList.contains('leaving'))return;
    titleCard.classList.add('leaving');titleCard.setAttribute('aria-hidden','true');
    if(titleCardTimer)clearTimeout(titleCardTimer);titleCardTimer=setTimeout(()=>titleCard.classList.remove('active','leaving'),600);
  }
  function parseLyrics(){
    const raw=lyricsInput.value.replace(/\r/g,'').split(/\n+/).map(s=>s.trim()).filter(Boolean);
    const synced=parseLrcText(raw.join('\n'));
    if(synced.length){
      state.lines=synced.map((line,i)=>({...line,endTime:synced[i+1]?.time||line.time+3}));
    }else{
      state.lines=raw.map((text,i)=>({text,time:i*3,endTime:(i+1)*3}));
    }
    state.appleLines=state.lines.map(line=>({...line,end:Number.isFinite(line.endTime)?line.endTime:line.time+3}));
    previewStage.classList.toggle('is-empty',!(audio.currentSrc||audio.src||video.currentSrc||video.src)&&state.lines.length===0);
    draw();
  }
  function lyricsToTtml(lines){
    const escapeXml=value=>String(value||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
    const time=value=>Math.max(0,Number(value)||0).toFixed(3);
    const body=lines.map(line=>'<p begin="'+time(line.time)+'s" end="'+time(line.endTime)+'s">'+escapeXml(line.text)+'</p>').join('');
    return '<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:itunes="http://music.apple.com/lyric-ttml-internal" xmlns:amll="http://www.example.com/ns/amll" itunes:timing="Line"><head><metadata><amll:meta key="musicName" value="'+escapeXml(songTitle.value.trim())+'"/><amll:meta key="artists" value="'+escapeXml(songArtist.value.trim())+'"/><amll:meta key="album" value="'+escapeXml(songAlbum.value.trim())+'"/></metadata></head><body><div>'+body+'</div></body></tt>';
  }
  function currentStyle(){
    const contract=window.KEFE_TYPE?.effects?.[state.effect]||{};
    return {
      effect:state.effect,fontSize:Math.min(canvas.width,canvas.height)*.13,textColor:'#fff',accentColor:'#ef3f38',
      flipcardsColor:'#fff',flipcardsAccent:'rgba(255,255,255,.25)',kefeMotionFont:state.fontOverride||contract.family||'Open Sans'
    };
  }
  function renderLyricsPreview(){
    if(!state.lines.length)return;
    const previewTime=Number(state.time)||0;
    const firstLineTime=Number(state.lines[0]?.time);
    if(Number.isFinite(firstLineTime)&&previewTime<firstLineTime)state.time=firstLineTime;
    draw();
  }
  window.addEventListener('kefe-effects-ready',()=>draw());
  function drawTitleCardCanvas(ctx,w,h,t){
    const title=songTitle.value.trim();
    if(!title)return;
    const first=Number(state.lines[0]?.time);
    const end=Number.isFinite(first)?first:4;
    if(end<=0.05||t<0||t>=end)return;
    const fade=Math.min(.6,end/3);
    const alpha=Math.max(0,Math.min(1,t/fade,(end-t)/fade));
    if(alpha<=0)return;
    const artist=songArtist.value.trim(),album=songAlbum.value.trim(),year=songYear.value.trim();
    const meta=[album,year].filter(Boolean).join(' · ');
    const img=titleArt?.querySelector('img');
    const hasArt=!!(img&&img.complete&&img.naturalWidth>0);
    const unit=Math.min(w,h);
    const art=unit*.34,gap=unit*.04;
    const tSize=Math.max(20,unit*.06),aSize=Math.max(14,unit*.038),mSize=Math.max(12,unit*.03);
    const textH=tSize*1.25+(artist?aSize*1.35:0)+(meta?mSize*1.4:0);
    const totalH=art+gap+textH;
    const top=(h-totalH)/2,cx=w/2,maxW=w*.82;
    const fit=(text,font)=>{ctx.font=font;let out=text;while(ctx.measureText(out).width>maxW&&out.length>3)out=out.slice(0,-2)+'…';return out;};
    ctx.save();
    ctx.globalAlpha=alpha;
    ctx.textAlign='center';ctx.textBaseline='top';
    // artwork
    const ax=cx-art/2,r=art*.06;
    ctx.save();
    ctx.shadowColor='rgba(0,0,0,.5)';ctx.shadowBlur=unit*.04;ctx.shadowOffsetY=unit*.012;
    ctx.beginPath();
    ctx.moveTo(ax+r,top);ctx.arcTo(ax+art,top,ax+art,top+art,r);ctx.arcTo(ax+art,top+art,ax,top+art,r);ctx.arcTo(ax,top+art,ax,top,r);ctx.arcTo(ax,top,ax+art,top,r);ctx.closePath();
    ctx.fillStyle='#222';ctx.fill();
    ctx.restore();
    if(hasArt){
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(ax+r,top);ctx.arcTo(ax+art,top,ax+art,top+art,r);ctx.arcTo(ax+art,top+art,ax,top+art,r);ctx.arcTo(ax,top+art,ax,top,r);ctx.arcTo(ax,top,ax+art,top,r);ctx.closePath();
      ctx.clip();
      try{ctx.drawImage(img,ax,top,art,art);}catch(err){console.warn('[KEFE title art]',err);}
      ctx.restore();
    }
    // text
    ctx.shadowColor='rgba(0,0,0,.6)';ctx.shadowBlur=unit*.02;
    ctx.fillStyle='#fff';
    let y=top+art+gap;
    ctx.fillText(fit(title,'750 '+tSize+'px "Inter Tight",system-ui,sans-serif'),cx,y);
    y+=tSize*1.25;
    if(artist){
      ctx.fillStyle='rgba(255,255,255,.85)';
      ctx.fillText(fit(artist,'600 '+aSize+'px "Inter Tight",system-ui,sans-serif'),cx,y);
      y+=aSize*1.35;
    }
    if(meta){
      ctx.fillStyle='rgba(255,255,255,.6)';
      ctx.fillText(fit(meta,'500 '+mSize+'px "Inter Tight",system-ui,sans-serif'),cx,y);
    }
    ctx.restore();
  }
  function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if(window.kefeParticleVisualiserActive){
      drawTitleCardCanvas(ctx,canvas.width,canvas.height,state.time);
      if(!state.lines.length)return;
      const fn=window.kefeEffects[state.effect]||window.kefeEffects.apple;
      if(typeof fn==='function'){try{fn(ctx,canvas.width,canvas.height,currentStyle(),state.lines,state.time,titleArt?.querySelector('img')||null);}catch(err){console.error('[KEFE effect]',state.effect,err);}}
      return;
    }
    const hasUploadedMedia=!!(audio.currentSrc||audio.src||video.currentSrc||video.src);
    const showEmpty=!hasUploadedMedia&&!state.appleLines.length&&!state.lines.length;
    previewStage.classList.toggle('is-empty',showEmpty);
    const t=state.time;
    if(visualiserBackground==='gradient'){
      const g=ctx.createLinearGradient(0,0,canvas.width,canvas.height);g.addColorStop(0,'#080808');g.addColorStop(1,'#24201f');ctx.fillStyle=g;ctx.fillRect(0,0,canvas.width,canvas.height);
    }else if(visualiserBackground==='accent'){
      ctx.fillStyle='rgba(239,63,56,.28)';ctx.fillRect(0,0,canvas.width,canvas.height);
    }else if(visualiserBackground==='album'){
      const g=ctx.createRadialGradient(canvas.width*.28,canvas.height*.2,0,canvas.width*.52,canvas.height*.5,canvas.width*.8);g.addColorStop(0,'#ef3f38');g.addColorStop(.42,'#301516');g.addColorStop(1,'#050505');ctx.fillStyle=g;ctx.fillRect(0,0,canvas.width,canvas.height);
    }else if(visualiserBackground==='aurora'){
      const g=ctx.createLinearGradient(0,0,canvas.width,canvas.height);g.addColorStop(0,'#071318');g.addColorStop(.45,'#102a2a');g.addColorStop(.7,'#21142e');g.addColorStop(1,'#050608');ctx.fillStyle=g;ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.save();ctx.globalAlpha=.24;ctx.filter='blur(34px)';ctx.fillStyle='#68e0c0';ctx.beginPath();ctx.ellipse(canvas.width*.35,canvas.height*.38,canvas.width*.32,canvas.height*.13,Math.sin(t*.22)*.15,0,Math.PI*2);ctx.fill();ctx.fillStyle='#8b6cff';ctx.beginPath();ctx.ellipse(canvas.width*.68,canvas.height*.5,canvas.width*.3,canvas.height*.12,-Math.sin(t*.18)*.12,0,Math.PI*2);ctx.fill();ctx.restore();
    }else if(visualiserBackground==='fluid'){
      const g=ctx.createRadialGradient(canvas.width*.5,canvas.height*.5,0,canvas.width*.5,canvas.height*.5,canvas.width*.75);g.addColorStop(0,'#302523');g.addColorStop(.45,'#11161a');g.addColorStop(1,'#030303');ctx.fillStyle=g;ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.save();ctx.globalAlpha=.16;ctx.filter='blur(42px)';for(let i=0;i<5;i++){ctx.fillStyle=i%2?'#ef3f38':'#b8a7ff';ctx.beginPath();ctx.ellipse(canvas.width*(.15+i*.17),canvas.height*(.35+.16*Math.sin(t*.35+i)),canvas.width*.25,canvas.height*.12,Math.sin(t*.25+i),0,Math.PI*2);ctx.fill();}ctx.restore();
    }else if(visualiserBackground==='plasma'){
      const g=ctx.createRadialGradient(canvas.width*.5,canvas.height*.5,0,canvas.width*.5,canvas.height*.5,canvas.width*.75);g.addColorStop(0,'#3a1117');g.addColorStop(.38,'#15102a');g.addColorStop(1,'#030304');ctx.fillStyle=g;ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.save();ctx.globalAlpha=.2;ctx.filter='blur(26px)';ctx.fillStyle='#ef3f38';ctx.beginPath();ctx.arc(canvas.width*(.5+.18*Math.sin(t*.4)),canvas.height*(.5+.2*Math.cos(t*.31)),canvas.height*.2,0,Math.PI*2);ctx.fill();ctx.fillStyle='#625cff';ctx.beginPath();ctx.arc(canvas.width*(.5+.2*Math.cos(t*.27)),canvas.height*(.5+.15*Math.sin(t*.38)),canvas.height*.16,0,Math.PI*2);ctx.fill();ctx.restore();
    }else if(visualiserBackground==='nebula'){
      ctx.fillStyle='#03040a';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.save();ctx.globalAlpha=.2;ctx.filter='blur(50px)';const n=ctx.createRadialGradient(canvas.width*.35,canvas.height*.4,0,canvas.width*.35,canvas.height*.4,canvas.width*.45);n.addColorStop(0,'#7658ff');n.addColorStop(1,'transparent');ctx.fillStyle=n;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.restore();
    }else if(visualiserBackground==='glass'){
      ctx.fillStyle='#0b0d0f';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.save();ctx.globalAlpha=.16;ctx.strokeStyle='#fff';ctx.lineWidth=1;for(let x=-canvas.height;x<canvas.width;x+=90){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+canvas.height,canvas.height);ctx.stroke();}ctx.restore();
    }else if(visualiserBackground==='prism'){
      const g=ctx.createLinearGradient(0,0,canvas.width,canvas.height);g.addColorStop(0,'#160d1b');g.addColorStop(.3,'#14243a');g.addColorStop(.52,'#301b35');g.addColorStop(.75,'#152b2b');g.addColorStop(1,'#060608');ctx.fillStyle=g;ctx.fillRect(0,0,canvas.width,canvas.height);
    }else if(visualiserBackground==='mesh'){
      ctx.fillStyle='#08090b';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.save();ctx.globalAlpha=.16;ctx.strokeStyle='#d7d2c9';ctx.lineWidth=1;const step=Math.max(48,canvas.width/18);for(let x=-canvas.height;x<canvas.width+canvas.height;x+=step){ctx.beginPath();for(let y=0;y<=canvas.height;y+=32){const xx=x+Math.sin(y*.012+t*.35)*18; y===0?ctx.moveTo(xx,y):ctx.lineTo(xx,y);}ctx.stroke();}ctx.restore();
    }else if(visualiserBackground==='vortex'){
      ctx.fillStyle='#040404';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.save();ctx.translate(canvas.width/2,canvas.height/2);ctx.globalAlpha=.2;ctx.strokeStyle='#ef3f38';for(let i=0;i<42;i++){const a=i*.35+t*.18,r=Math.min(canvas.width,canvas.height)*(.08+i*.012);ctx.beginPath();ctx.arc(0,0,r,a,a+1.9);ctx.stroke();}ctx.restore();
    }else if(visualiserBackground==='tunnel'){
      ctx.fillStyle='#030303';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.save();ctx.translate(canvas.width/2,canvas.height/2);ctx.strokeStyle='rgba(255,255,255,.16)';for(let i=1;i<14;i++){const s=(i/14)*Math.min(canvas.width,canvas.height)*(.95+.06*Math.sin(t*2));ctx.strokeRect(-s/2,-s/2,s,s);}ctx.restore();
    }else if(visualiserBackground==='particles'){
      ctx.fillStyle='#050505';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.save();ctx.fillStyle='rgba(255,255,255,.5)';for(let i=0;i<90;i++){const x=(i*83.17+t*(8+i%5)*3)%canvas.width,y=(i*47.31+Math.sin(t*.4+i)*18)%canvas.height,r=1+(i%3)*.45;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}ctx.restore();
    }else if(visualiserBackground==='stars'){
      ctx.fillStyle='#020308';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.save();for(let i=0;i<110;i++){const x=(i*127.3)%canvas.width,y=(i*71.7)%canvas.height,r=.5+(i%4)*.35;ctx.globalAlpha=.25+(i%5)*.1;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}ctx.restore();
    }else if(visualiserBackground==='noise'){
      ctx.fillStyle='#080808';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.save();ctx.globalAlpha=.06;for(let i=0;i<700;i++){ctx.fillStyle=Math.random()>.5?'#fff':'#000';ctx.fillRect(Math.random()*canvas.width,Math.random()*canvas.height,1,1);}ctx.restore();
    }else if(visualiserBackground==='scanlines'){
      ctx.fillStyle='#050505';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.save();ctx.globalAlpha=.12;ctx.fillStyle='#fff';for(let y=0;y<canvas.height;y+=4)ctx.fillRect(0,y,canvas.width,1);ctx.restore();
    }else if(visualiserBackground==='chromatic'){
      const g=ctx.createLinearGradient(0,0,canvas.width,canvas.height);g.addColorStop(0,'#190b18');g.addColorStop(.35,'#091a22');g.addColorStop(.65,'#21120c');g.addColorStop(1,'#050505');ctx.fillStyle=g;ctx.fillRect(0,0,canvas.width,canvas.height);
    }else if(visualiserBackground==='pulse'){
      const p=.5+.5*Math.sin(t*2.4);const g=ctx.createRadialGradient(canvas.width/2,canvas.height/2,0,canvas.width/2,canvas.height/2,canvas.width*.72);g.addColorStop(0,'rgba(239,63,56,'+(0.16+.12*p)+')');g.addColorStop(.45,'#121012');g.addColorStop(1,'#030303');ctx.fillStyle=g;ctx.fillRect(0,0,canvas.width,canvas.height);
    }else if(visualiserBackground==='spectrum'){
      const g=ctx.createRadialGradient(canvas.width*.5,canvas.height*.55,0,canvas.width*.5,canvas.height*.55,canvas.width*.7);g.addColorStop(0,'#3b1517');g.addColorStop(.28,'#17182d');g.addColorStop(.62,'#0b1016');g.addColorStop(1,'#020303');ctx.fillStyle=g;ctx.fillRect(0,0,canvas.width,canvas.height);
    }else if(visualiserBackground==='monochrome'){
      const g=ctx.createRadialGradient(canvas.width*.5,canvas.height*.4,0,canvas.width*.5,canvas.height*.5,canvas.width*.8);g.addColorStop(0,'#3b3b3b');g.addColorStop(.4,'#161616');g.addColorStop(1,'#030303');ctx.fillStyle=g;ctx.fillRect(0,0,canvas.width,canvas.height);
    }else{
      ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()||'#cbc5b1';ctx.fillRect(0,0,canvas.width,canvas.height);
    }
    const backgroundFn=window.kefeBackgroundEffects?.[visualiserBackground];
    const hasCustomBackground=typeof backgroundFn==='function';
    if(hasCustomBackground){
      try{backgroundFn(ctx,canvas.width,canvas.height,currentStyle(),state.lines,state.time,titleArt?.querySelector('img')||null);}
      catch(err){console.error('[KEFE background effect]',visualiserBackground,err);}
    }
    if(!hasCustomBackground&&video.src&&video.readyState>=2){
      const vw=video.videoWidth||canvas.width,vh=video.videoHeight||canvas.height;
      const scale=Math.max(canvas.width/vw,canvas.height/vh),dw=vw*scale,dh=vh*scale;
      ctx.drawImage(video,(canvas.width-dw)/2,(canvas.height-dh)/2,dw,dh);
    }
    const reactive=visualiserMotion==='steady'?1:visualiserMotion==='slow'?.45:(audio.src&&!audio.paused?1+Math.sin(t*18)*.08:1);
    if(hasUploadedMedia&&visualiserPreset==='bars'){
      ctx.save();ctx.globalAlpha=.55;ctx.fillStyle='#ef3f38';
      for(let i=0;i<48;i++){const x=i*canvas.width/48;const h=(.08+.12*(Math.sin(t*3+i*.7)*.5+.5))*canvas.height*reactive;ctx.fillRect(x,canvas.height-h,Math.max(2,canvas.width/80),h);}
      ctx.restore();
    }else if(hasUploadedMedia&&visualiserPreset==='pulse'){
      ctx.save();ctx.globalAlpha=.22;ctx.strokeStyle='#ef3f38';ctx.lineWidth=5;ctx.beginPath();ctx.arc(canvas.width/2,canvas.height/2,Math.min(canvas.width,canvas.height)*(.28+.025*Math.sin(t*4)*reactive),0,Math.PI*2);ctx.stroke();ctx.restore();
    }else if(hasUploadedMedia&&visualiserPreset==='ring'){
      ctx.save();ctx.globalAlpha=.35;ctx.strokeStyle='#ef3f38';ctx.lineWidth=3;ctx.beginPath();ctx.arc(canvas.width/2,canvas.height/2,Math.min(canvas.width,canvas.height)*(.24+.04*Math.sin(t*3)*reactive),0,Math.PI*2);ctx.stroke();ctx.restore();
    }
    drawTitleCardCanvas(ctx,canvas.width,canvas.height,state.time);
    if(!state.lines.length)return;
    const fn=window.kefeEffects[state.effect]||window.kefeEffects.apple;
    if(typeof fn==='function'){
      try{fn(ctx,canvas.width,canvas.height,currentStyle(),state.lines,state.time,titleArt?.querySelector('img')||null);}
      catch(err){
        ctx.fillStyle='#fff';ctx.font='16px system-ui';ctx.textAlign='center';
        ctx.fillText('Effect error: '+err.message,canvas.width/2,canvas.height/2);
        console.error('[KEFE effect]',state.effect,err);
      }
    }
  }
  function appleTime(value){
    const text=String(value||'').trim();
    if(!text)return NaN;
    if(/^\d+(?:\.\d+)?s$/.test(text))return Number.parseFloat(text);
    const parts=text.split(':').map(Number);
    if(parts.some(Number.isNaN))return NaN;
    if(parts.length===3)return parts[0]*3600+parts[1]*60+parts[2];
    if(parts.length===2)return parts[0]*60+parts[1];
    return parts[0];
  }
  function parseAppleTTML(ttml){
    if(typeof ttml!=='string'||!ttml.trim())return [];
    const source=ttml.replace(/^\uFEFF/,'').trim();
    try{
      const doc=new DOMParser().parseFromString(source,'application/xml');
      if(doc.querySelector('parsererror'))return [];
      const pNodes=Array.from(doc.getElementsByTagNameNS('*','p')).length
        ? Array.from(doc.getElementsByTagNameNS('*','p'))
        : Array.from(doc.getElementsByTagName('p'));
      return pNodes.map(node=>{
        const time=appleTime(node.getAttribute('begin'));
        if(!Number.isFinite(time))return null;
        const words=Array.from(node.children).filter(child=>{
          return String(child.localName||child.tagName||'').toLowerCase()==='span';
        }).map(wordNode=>{
          const wordTime=appleTime(wordNode.getAttribute('begin'));
          const wordEnd=appleTime(wordNode.getAttribute('end'));
          const wordText=String(wordNode.textContent||'').trim();
          return Number.isFinite(wordTime)&&Number.isFinite(wordEnd)&&wordText
            ?{text:wordText,time:wordTime,endTime:wordEnd}
            :null;
        }).filter(Boolean);
        const text=words.length
          ?words.map(word=>word.text).join(' ')
          :String(node.textContent||'').replace(/\s+/g,' ').trim();
        return text?{time,end:Number.isFinite(appleTime(node.getAttribute('end')))?appleTime(node.getAttribute('end')):time+3,text,words}:null;
      }).filter(Boolean).sort((a,b)=>a.time-b.time);
    }catch(error){
      console.warn('[KEFE Apple TTML]',error);
      return [];
    }
  }
  function fmtLrc(time){
    const ms=Math.round(Math.max(0,Number(time)||0)*1000);
    const mins=Math.floor(ms/60000),secs=(ms%60000)/1000;
    return '['+String(mins).padStart(2,'0')+':'+secs.toFixed(3).padStart(6,'0')+']';
  }
  function parseLrcText(text){
    const src=String(text||'').replace(/^﻿/,'').replace(/\r/g,'');
    const offsetMatch=src.match(/^\[offset:\s*(-?\d+)\s*\]/mi);
    const offset=offsetMatch?Number(offsetMatch[1])/1000:0;
    const out=[];
    src.split('\n').forEach(raw=>{
      let line=raw.trim(),m;
      const stamps=[];
      while((m=line.match(/^\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/))){
        const frac=m[3]?Number(m[3])/Math.pow(10,m[3].length):0;
        stamps.push(Number(m[1])*60+Number(m[2])+frac);
        line=line.slice(m[0].length).trim();
      }
      if(!stamps.length)return;
      const clean=line.replace(/<\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?>/g,'').replace(/\s+/g,' ').trim();
      if(!clean)return;
      stamps.forEach(t=>out.push({text:clean,time:Math.max(0,t-offset)}));
    });
    return out.sort((a,b)=>a.time-b.time);
  }
  function parseAppleLrc(lyrics){
    if(typeof lyrics!=='string'||!lyrics.trim())return [];
    return parseLrcText(lyrics);
  }
  function drawAppleLyrics(ctx,width,height,lines,time){
    if(!lines.length)return;
    const active=lines.reduce((best,line,index)=>line.time<=time&&(!best||line.time>best.time)?{...line,index}:best,null);
    const index=active?.index??(time<lines[0].time?0:lines.length-1);
    const center=lines[index];
    if(!center)return;
    ctx.save();
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    const size=Math.max(22,Math.min(48,width*.038));
    const gap=size*1.38;
    const maxWidth=width*.78;
    for(let offset=-2;offset<=2;offset++){
      const line=lines[index+offset];
      if(!line)continue;
      const y=height/2+offset*gap;
      const isCurrent=offset===0;
      const distance=Math.abs(offset);
      ctx.font=(isCurrent?'750 ':'600 ')+size+'px "Inter Tight",system-ui,sans-serif';
      ctx.globalAlpha=isCurrent?1:Math.max(.22,.62-distance*.16);
      ctx.fillStyle='#fff';
      let text=line.text;
      while(ctx.measureText(text).width>maxWidth&&text.length>3)text=text.slice(0,-2)+'…';
      ctx.fillText(text,width/2,y);
    }
    if(active&&Number.isFinite(active.end)&&time>=active.time&&time<=active.end){
      const progress=Math.min(1,Math.max(0,(time-active.time)/(active.end-active.time||1)));
      ctx.globalAlpha=.08+.12*progress;
      ctx.fillStyle='#fff';
      ctx.fillRect(width*.11,height*.5+size*.82,width*.78*progress,2);
    }
    ctx.restore();
  }
  function setEffect(id){
    state.effect=id;
    const appleLyrics=document.getElementById('kefeAppleLyrics');
    if(appleLyrics){appleLyrics.style.display='none';if(id==='apple'){applyAppleAlbumGradient();syncAppleLyricsMetadata();visualiserBackground='gradient';document.getElementById('visualiserBackground').value='gradient';}}
    document.querySelectorAll('.kefe-card').forEach(b=>b.classList.toggle('active',b.dataset.effect===id));
    const c=window.KEFE_TYPE?.effects?.[id]||{};
    document.getElementById('fontName').textContent=c.family||'System UI';
    document.getElementById('fontMeta').textContent='Locked effect font · '+(c.weight||400)+' weight';
    draw();
    return true;
  }
  const lyricEffectSelect=document.getElementById('lyricEffect');
  effectDefinitions.forEach(([id,label])=>{
    const o=document.createElement('option');
    o.value=id;o.textContent=label;
    lyricEffectSelect.appendChild(o);
  });

  const kefeBrand=document.querySelector('.kefe-brand');
  let kefeBrandClickTimer=null;
  kefeBrand.addEventListener('click',()=>{
    if(kefeBrandClickTimer)clearTimeout(kefeBrandClickTimer);
    kefeBrandClickTimer=setTimeout(()=>{
      kefeBrandClickTimer=null;
      window.location.reload();
    },260);
  });
  kefeBrand.addEventListener('dblclick',()=>{
    if(kefeBrandClickTimer)clearTimeout(kefeBrandClickTimer);
    kefeBrandClickTimer=null;
    window.location.reload();
  });

  function openEditorPanel(panel){
    document.querySelectorAll('.kefe-section').forEach(b=>b.classList.toggle('active',b.dataset.panel===panel));
    document.querySelectorAll('.kefe-panel').forEach(p=>p.classList.toggle('active',p.dataset.panelView===panel));
  }
  document.querySelectorAll('.kefe-section').forEach(button=>button.addEventListener('click',()=>openEditorPanel(button.dataset.panel)));
  const previewPane=document.querySelector('.kefe-preview');
  function fitPreviewStage(){
    if(!previewPane||!previewStage||previewStage.classList.contains('kefe-pseudo-fullscreen')||document.fullscreenElement===previewStage)return;
    const active=previewAspectRatio||'16:9';
    const ratio=active==='9:16'?9/16:active==='1:1'?1:16/9;
    const paneWidth=Math.max(0,previewPane.clientWidth-48);
    const paneHeight=Math.max(0,previewPane.clientHeight-34);
    if(paneWidth<=0||paneHeight<=0)return;
    let width=Math.min(paneWidth,1180);
    let height=width/ratio;
    const mobile=window.matchMedia('(max-width: 700px)').matches;
    if(mobile){
      const mobileHeight=Math.max(1,Math.floor((window.innerHeight-52)/2-90));
      height=Math.min(height,mobileHeight);
      width=height*ratio;
      if(width>paneWidth){width=paneWidth;height=width/ratio;}
    }else if(height>paneHeight){
      height=paneHeight;width=height*ratio;
    }
    previewStage.style.width=Math.max(1,Math.floor(width))+'px';
    previewStage.style.height=Math.max(1,Math.floor(height))+'px';
  }
  window.addEventListener('resize',fitPreviewStage);
  const aspectSelect=document.getElementById('kefeAspect');
  aspectSelect?.addEventListener('change',()=>{
    previewAspectRatio=aspectSelect.value;
    previewStage?.classList.remove('is-16x9','is-9x16','is-1x1');
    previewStage?.classList.add('is-'+previewAspectRatio.replace(':','x'));
    fitPreviewStage();
    window.dispatchEvent(new Event('resize'));
  });
  const previewFullscreen=document.getElementById('previewFullscreen');
  function syncPreviewFullscreen(){
    if(!previewFullscreen||!previewStage)return;
    const active=document.fullscreenElement===previewStage||previewStage.classList.contains('kefe-pseudo-fullscreen');
    previewFullscreen.setAttribute('aria-label',active?'Exit fullscreen':'Enter fullscreen');
    previewFullscreen.title=active?'Exit fullscreen':'Enter fullscreen';
    previewFullscreen.innerHTML=active
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3H3v6M15 3h6v6M9 21H3v-6M21 15v6h-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M21 16v5h-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  async function togglePreviewFullscreen(){
    if(!previewStage)return;
    try{
      if(document.fullscreenElement===previewStage){
        await document.exitFullscreen();
      }else if(document.fullscreenElement){
        await document.exitFullscreen();
        await previewStage.requestFullscreen();
      }else if(typeof previewStage.requestFullscreen==='function'){
        await previewStage.requestFullscreen();
      }else{
        previewStage.classList.toggle('kefe-pseudo-fullscreen');
        document.documentElement.classList.toggle('kefe-fullscreen-open',previewStage.classList.contains('kefe-pseudo-fullscreen'));
        document.body.classList.toggle('kefe-fullscreen-open',previewStage.classList.contains('kefe-pseudo-fullscreen'));
        fitPreviewStage();
      }
    }catch(error){
      console.warn('[KEFE fullscreen]',error);
      previewStage.classList.toggle('kefe-pseudo-fullscreen');
      const active=previewStage.classList.contains('kefe-pseudo-fullscreen');
      document.documentElement.classList.toggle('kefe-fullscreen-open',active);
      document.body.classList.toggle('kefe-fullscreen-open',active);
    }
    syncPreviewFullscreen();
  }
  previewFullscreen?.addEventListener('click',togglePreviewFullscreen);
  document.addEventListener('fullscreenchange',()=>{
    if(document.fullscreenElement!==previewStage)previewStage?.classList.remove('kefe-pseudo-fullscreen');
    syncPreviewFullscreen();
    if(document.fullscreenElement!==previewStage)fitPreviewStage();
  });
  syncPreviewFullscreen();
  document.querySelectorAll('.kefe-top-link').forEach(button=>button.addEventListener('click',()=>{
    const panel=button.dataset.topPanel;
    if(panel==='media'||panel==='editor')openEditorPanel('media');
  }));
  function updatePlayButton(){
    const button=document.getElementById('playButton');
    if(!button)return;
    const playing=!!audio.src&&!audio.paused;
    button.setAttribute('aria-label',playing?'Pause':'Play');
    button.setAttribute('title',playing?'Pause':'Play');
    button.innerHTML=playing?'<svg class="kefe-pause-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg>':'<svg class="kefe-play-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10-6.5z" fill="currentColor"/></svg>';
  }
  document.getElementById('playButton').onclick=()=>{
    if(audio.src){if(audio.paused)audio.play();else audio.pause();}
    else{state.time=state.time>=30?0:state.time+.05;updateTime();draw();}
  };
  function decodeText(bytes){
    try{return new TextDecoder('utf-8').decode(bytes).replace(/\0/g,'').trim();}catch(_){return '';}
  }
  function decodeLatin(bytes){
    let out='';for(let i=0;i<bytes.length;i++)if(bytes[i])out+=String.fromCharCode(bytes[i]);return out.trim();
  }
  function readId3Text(bytes){
    if(bytes.length<4)return '';
    const encoding=bytes[0],data=bytes.slice(1);
    if(encoding===1&&data.length>=2){
      try{return new TextDecoder('utf-16').decode(data).replace(/\0/g,'').trim();}catch(_){}
    }
    if(encoding===2){
      try{return new TextDecoder('utf-16be').decode(data).replace(/\0/g,'').trim();}catch(_){}
    }
    return encoding===3?decodeText(data):decodeLatin(data);
  }
  function readMp4String(bytes){
    const clean=value=>String(value||'').replace(/[\0\x01-\x08\x0B\x0C\x0E-\x1F]/g,' ').replace(/^data[^\x20]*\s*/i,'').trim();
    const decoders=[
      ()=>new TextDecoder('utf-8',{fatal:false}).decode(bytes),
      ()=>new TextDecoder('utf-16le',{fatal:false}).decode(bytes),
      ()=>new TextDecoder('utf-16be',{fatal:false}).decode(bytes)
    ];
    for(const decode of decoders){
      try{
        const value=clean(decode());
        if(value&&value.length<500&&!/^[^\p{L}\p{N}]{3,}/u.test(value))return value;
      }catch(_){}
    }
    return '';
  }
  function readMp4AtomValue(bytes,atomName){
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    const decoder=new TextDecoder('utf-8',{fatal:false});
    const findAtom=(start,end)=>{
      let offset=start;
      while(offset+8<=end){
        let size=view.getUint32(offset);
        const type=decoder.decode(bytes.slice(offset+4,offset+8));
        let header=8;
        if(size===1){
          if(offset+16>end)return '';
          const high=view.getUint32(offset+8),low=view.getUint32(offset+12);
          size=high*4294967296+low;header=16;
        }else if(size===0){
          size=end-offset;
        }
        if(size<header||offset+size>end)return '';
        const payloadStart=offset+header,payloadEnd=offset+size;
        if(type===atomName){
          const payload=bytes.slice(payloadStart,payloadEnd);
          const dataIndex=decoder.decode(payload).indexOf('data');
          if(dataIndex>=0){
            const marker=Math.min(payload.length-8,Math.max(0,dataIndex-4));
            const text=readMp4String(payload.slice(marker));
            if(text)return text;
          }
          return readMp4String(payload.slice(0,Math.min(payload.length,512)));
        }
        const container=['moov','udta','meta','ilst','----'].includes(type);
        if(container){
          const childStart=type==='meta'?payloadStart+4:payloadStart;
          const value=findAtom(childStart,payloadEnd);
          if(value)return value;
        }
        offset+=size;
      }
      return '';
    };
    return findAtom(0,bytes.byteLength);
  }
  async function readEmbeddedMetadata(file){
    const head=await file.slice(0,1024*1024).arrayBuffer();
    const bytes=new Uint8Array(head),out={};
    if(bytes[0]===0x49&&bytes[1]===0x44&&bytes[2]===0x33){
      const version=bytes[3]||3;
      let offset=10;
      const size=((bytes[6]&127)<<21)|((bytes[7]&127)<<14)|((bytes[8]&127)<<7)|(bytes[9]&127);
      const limit=Math.min(bytes.length,10+size);
      while(offset+10<=limit){
        const id=decodeLatin(bytes.slice(offset,offset+4));
        if(!/^[A-Z0-9]{4}$/.test(id))break;
        let frameSize=version>=4?((bytes[offset+4]&127)<<21)|((bytes[offset+5]&127)<<14)|((bytes[offset+6]&127)<<7)|(bytes[offset+7]&127):((bytes[offset+4]<<24)|(bytes[offset+5]<<16)|(bytes[offset+6]<<8)|bytes[offset+7]);
        if(!frameSize||offset+10+frameSize>limit)break;
        const value=readId3Text(bytes.slice(offset+10,offset+10+frameSize));
        if(value){
          if(id==='TIT2')out.title=value;
          if(id==='TPE1')out.artist=value;
          if(id==='TALB')out.album=value;
          if(id==='TYER'||id==='TDRC')out.year=value.slice(0,4);
        }
        offset+=10+frameSize;
      }
    }
    const atom=(name)=>{
      const marker=name==='title'?'©nam':name==='artist'?'©ART':name==='album'?'©alb':name==='year'?'©day':'';
      return marker?readMp4AtomValue(bytes,marker):'';
    };
    if(!out.title)out.title=atom('title');
    if(!out.artist)out.artist=atom('artist');
    if(!out.album)out.album=atom('album');
    if(!out.year)out.year=atom('year').slice(0,4);
    return out;
  }
  function normalizeSearchText(value){
    return String(value||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim();
  }
  function filenameMetadata(file){
    const raw=String(file.name||'').replace(/\.[^.]+$/,'').replace(/^[\s\d._)\-]+/,'').replace(/[._]+/g,' ').trim();
    const parts=raw.split(/\s+[-–—]\s+/).map(v=>v.trim()).filter(Boolean);
    return parts.length>1?{artist:parts[0],title:parts.slice(1).join(' - ')}:{title:raw};
  }
  function coreTitle(value){
    return normalizeSearchText(String(value||'').replace(/\(.*?\)|\[.*?\]/g,' ').replace(/\s-\s.*$/,''));
  }
  function rankTrack(item,meta,duration){
    const title=normalizeSearchText(meta.title),artist=normalizeSearchText(meta.artist);
    const itemTitle=normalizeSearchText(item.trackName),itemArtist=normalizeSearchText(item.artistName);
    let score=0;
    const itemCore=coreTitle(item.trackName);
    if(title&&(itemTitle===title||(itemCore&&itemCore===coreTitle(meta.title))))score+=120;
    else if(title&&itemTitle&&(itemTitle.includes(title)||title.includes(itemTitle)))score+=55;
    if(artist&&itemArtist===artist)score+=120;
    else if(artist&&itemArtist&&(itemArtist.includes(artist)||artist.includes(itemArtist)))score+=55;
    if(duration&&item.trackTimeMillis)score+=Math.max(0,40-Math.abs(Number(item.trackTimeMillis)/1000-duration)*2);
    return score;
  }
  function isConfidentMatch(item,meta,duration){
    if(!meta.title||!meta.artist)return false;
    return rankTrack(item,meta,duration)>=170;
  }
  function applyIdentifiedTrack(item){
    songTitle.value=item.trackName||songTitle.value;
    songArtist.value=item.artistName||songArtist.value;
    songAlbum.value=item.collectionName||songAlbum.value;
    songYear.value=item.releaseDate?String(item.releaseDate).slice(0,4):songYear.value;
    songAlbum.dataset.artUrl=normalizeArtworkUrl(item.artworkUrl100);
    songAlbum.dataset.trackDuration=item.trackTimeMillis?String(Math.round(Number(item.trackTimeMillis)/1000)):'';
    songAlbum.dataset.platformId=item.trackId?String(item.trackId):'';
    updateMediaTrack();updateTitleCard();applyAppleAlbumGradient();syncAppleLyricsMetadata();
  }
  async function fetchItunesMatches(meta,duration){
    const query=[meta.title,meta.artist].filter(Boolean).join(' ').trim();
    if(!query)return [];
    let lastError=null;
    const run=async country=>{
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
      try{
        const response=await fetch('https://itunes.apple.com/search?term='+encodeURIComponent(query)+'&entity=song&limit=25&country='+country,{signal:controller.signal,headers:{Accept:'application/json'}});
        if(!response.ok)throw new Error('iTunes search failed: '+response.status);
        const payload=await response.json();
        return Array.isArray(payload.results)?payload.results.filter(item=>item.trackName):[];
      }finally{clearTimeout(timer);}
    };
    let results=[];
    for(const country of ['AU','US']){
      try{results=await run(country);}catch(error){lastError=error;console.warn('[KEFE iTunes search]',country,error?.name||error);}
      if(results.length)break;
    }
    if(!results.length&&lastError)throw lastError;
    return results.sort((a,b)=>rankTrack(b,meta,duration)-rankTrack(a,meta,duration));
  }
  function setLyricsFromLines(lines,source){
    if(!lines.length)return false;
    state.appleLines=lines.map((line,index)=>({...line,end:Number.isFinite(line.end)?line.end:(lines[index+1]?.time||line.time+3)}));
    state.lines=state.appleLines.map(line=>({text:line.text,time:line.time,endTime:line.end,words:Array.isArray(line.words)?line.words.map(word=>({text:word.text,time:word.time,endTime:word.endTime})):undefined}));
    lyricsInput.value=state.appleLines.map(line=>fmtLrc(line.time)+' '+line.text).join('\n');
    clearManualNotice();
    previewStage.classList.remove('is-empty');
    const status=document.getElementById('kefeLyricsStatus');
    if(status)status.textContent=source;
    openEditorPanel('lyrics');syncAppleLyricsMetadata();draw();syncAppleLyrics(true);showTitleCard();
    return true;
  }
  let lyricsRequest=0;
  function parseLyricsPlus(payload){
    const items=Array.isArray(payload?.lyrics)?payload.lyrics:[];
    return items.map((line,index)=>{
      const startMs=Number(line?.time);
      if(!Number.isFinite(startMs))return null;
      const durationMs=Number(line?.duration);
      const nextMs=Number(items[index+1]?.time);
      const endMs=Number.isFinite(durationMs)&&durationMs>0?startMs+durationMs:(Number.isFinite(nextMs)?nextMs:startMs+3000);
      const words=Array.isArray(line?.syllabus)?line.syllabus.map(word=>{
        const time=Number(word?.time),duration=Number(word?.duration);
        if(!Number.isFinite(time))return null;
        return {text:String(word?.text||'').trim(),time:time/1000,endTime:(Number.isFinite(duration)&&duration>0?time+duration:time+300)/1000};
      }).filter(word=>word&&word.text):[];
      return {text:String(line?.text||'').trim(),time:startMs/1000,end:endMs/1000,words};
    }).filter(line=>line&&line.text);
  }
  async function loadAutomaticLyrics(){
    const title=songTitle.value.trim(),artist=songArtist.value.trim(),album=songAlbum.value.trim();
    const duration=Math.round(Number(audio.duration)||Number(songAlbum.dataset.trackDuration)||0);
    const status=document.getElementById('kefeLyricsStatus');
    if(!title||!artist){showManualNotice('Enter both the song title and artist so lyrics can be found.');return false;}
    const request=++lyricsRequest;
    let controller=new AbortController();
    let timeout=null;
    const params=new URLSearchParams({title,artist,...(album?{album}:{}),...(duration?{duration:String(duration)}:{})});
    let acceptJson={signal:controller.signal,headers:{Accept:'application/json'}};
    const freshRequest=()=>{
      clearTimeout(timeout);
      controller=new AbortController();
      timeout=setTimeout(()=>controller.abort(),8000);
      acceptJson={signal:controller.signal,headers:{Accept:'application/json'}};
    };
    const attempt=async(name,fn)=>{
      if(request!==lyricsRequest)return true;
      freshRequest();
      try{return await fn();}
      catch(error){console.warn('[KEFE lyrics] '+name+' failed:',error?.name||error);return false;}
    };

    const tryLines=lines=>{
      if(request!==lyricsRequest)return true;
      return setLyricsFromLines(lines,'Synchronized lyrics fetched.');
    };

    const tryBini=async()=>{
      const response=await fetch('https://lyrics-api.binimum.org/getLyrics?'+params,acceptJson);
      if(!response.ok)return false;
      const payload=await response.json();
      const urls=[];
      const collect=value=>{
        if(!value)return;
        if(typeof value==='string'){
          if(/^https?:\/\//i.test(value)||value.trim().startsWith('<'))urls.push(value);
          return;
        }
        if(Array.isArray(value)){value.forEach(collect);return;}
        if(typeof value==='object'){
          collect(value.url);collect(value.ttml);collect(value.lyrics);collect(value.lyricsUrl);collect(value.ttmlUrl);
        }
      };
      collect(payload);
      for(const value of urls){
        if(value.trim().startsWith('<')){
          if(tryLines(parseAppleTTML(value)))return true;
          continue;
        }
        const lyricResponse=await fetch(value,{signal:controller.signal,headers:{Accept:'application/xml,text/xml,text/plain'}});
        if(!lyricResponse.ok)continue;
        if(tryLines(parseAppleTTML(await lyricResponse.text())))return true;
      }
      return false;
    };

    const tryLyricsPlus=async()=>{
      const mirrors=[
        'https://lyricsplus.binimum.org',
        'https://lyricsplus.atomix.one',
        'https://lyricsplus.prjktla.workers.dev',
        'https://lyricsplus-seven.vercel.app'
      ];
      const query=new URLSearchParams({title,artist,...(album?{album}:{}),...(duration?{duration:String(duration)}:{}),source:'apple,lyricsplus,musixmatch,spotify,musixmatch-word'});
      for(const base of mirrors){
        const response=await fetch(base+'/v2/lyrics/get?'+query,acceptJson);
        if(!response.ok)continue;
        if(tryLines(parseLyricsPlus(await response.json())))return true;
      }
      return false;
    };

    const tryBetterLyrics=async()=>{
      const bl=()=>new URLSearchParams({s:title,a:artist,...(album?{al:album}:{}),...(duration?{d:String(duration)}:{})});
      let response=await fetch('https://api.betterlyrics.org/getLyrics?'+bl(),acceptJson);
      if(response.ok){
        const payload=await response.json();
        if(tryLines(parseAppleTTML(String(payload?.ttml||''))))return true;
      }
      response=await fetch('https://api.betterlyrics.org/kugou/getLyrics?'+bl(),acceptJson);
      if(response.ok){
        const payload=await response.json();
        if(tryLines(parseAppleLrc(String(payload?.lyrics||''))))return true;
      }
      return false;
    };

    const tryLrclib=async()=>{
      const response=await fetch('https://lrclib.net/api/get?'+new URLSearchParams({track_name:title,artist_name:artist,...(album?{album_name:album}:{}),...(duration?{duration:String(duration)}:{})}),acceptJson);
      if(!response.ok)return false;
      const payload=await response.json();
      return tryLines(parseAppleLrc(String(payload?.syncedLyrics||'')));
    };
    const pickLrclib=async query=>{
      const response=await fetch('https://lrclib.net/api/search?'+new URLSearchParams(query),acceptJson);
      if(!response.ok)return false;
      const wantArtist=normalizeSearchText(artist),wantTitle=coreTitle(title);
      let list=(await response.json()).filter(item=>{
        if(!item||!item.syncedLyrics)return false;
        const a=normalizeSearchText(item.artistName),t=coreTitle(item.trackName);
        return a&&wantArtist&&(a.includes(wantArtist)||wantArtist.includes(a))&&t&&wantTitle&&(t===wantTitle||t.includes(wantTitle)||wantTitle.includes(t));
      });
      if(duration)list=list.filter(item=>Math.abs((item.duration||0)-duration)<=8);
      if(!list.length)return false;
      if(duration)list.sort((a,b)=>Math.abs((a.duration||0)-duration)-Math.abs((b.duration||0)-duration));
      return tryLines(parseAppleLrc(String(list[0].syncedLyrics)));
    };
    const tryLrclibSearch=()=>pickLrclib({track_name:title,artist_name:artist});
    const tryLrclibQuery=()=>pickLrclib({q:title+' '+artist});

    try{
      if(status)status.textContent='Finding synchronized lyrics…';
      if(await attempt('lrclib',tryLrclib))return true;
      if(await attempt('lrclib-search',tryLrclibSearch))return true;
      if(await attempt('lrclib-query',tryLrclibQuery))return true;
      if(await attempt('lyricsplus',tryLyricsPlus))return true;
      if(await attempt('betterlyrics',tryBetterLyrics))return true;
      if(await attempt('binimum',tryBini))return true;
      showLyricsMissing();
      return false;
    }catch(error){
      if(request===lyricsRequest&&status)status.textContent=error?.name==='AbortError'?'Lyrics search timed out.':'Could not fetch synchronized lyrics.';
      console.warn('[KEFE automatic lyrics]',error);
      return false;
    }finally{
      clearTimeout(timeout);
    }
  }
  function showManualNotice(text){
    let n=document.getElementById('kefeManualNotice');
    if(!n){
      n=document.createElement('div');
      n.id='kefeManualNotice';n.setAttribute('role','status');
      n.style.cssText='margin:0 0 12px;padding:10px 12px;border-radius:10px;background:rgba(239,63,56,.14);border:1px solid rgba(239,63,56,.45);font-size:13px;line-height:1.4';
      const anchor=songTitle.closest('label,.kefe-field,.kefe-row,div')||songTitle;
      anchor.parentNode.insertBefore(n,anchor);
    }
    n.textContent=text;n.hidden=false;
  }
  function clearManualNotice(){const n=document.getElementById('kefeManualNotice');if(n)n.hidden=true;}
  function setLyricsStatus(text){const el=document.getElementById('kefeLyricsStatus');if(el)el.textContent=text;}
  function promptManualDetails(matches){
    const list=Array.isArray(matches)?matches:[];
    const msg=list.length
      ?'Couldn’t confirm this song automatically. Pick the correct match below, or edit the title and artist.'
      :'Couldn’t identify this song automatically. Enter the title and artist below, then pick the correct match.';
    showManualNotice(msg);setLyricsStatus(msg);
    openEditorPanel('media');
    renderSongSuggestions(list,{excludeCurrent:false});
    try{songTitle.focus();}catch(_){}
  }
  function showLyricsMissing(){
    setLyricsStatus('No synchronized lyrics found for this track. Check the song details, or upload an .lrc file in the Lyrics section.');
    openEditorPanel('lyrics');
  }
  async function identifyAndLoadTrack(file){
    const uploadId=mediaObjectUrl;
    try{
      const embedded=await readEmbeddedMetadata(file);
      const named=filenameMetadata(file);
      const meta={title:embedded.title||named.title||'',artist:embedded.artist||named.artist||'',album:embedded.album||'',year:embedded.year||''};
      songTitle.value=meta.title;
      songArtist.value=meta.artist;
      songAlbum.value=meta.album;
      songYear.value=meta.year;
      updateMediaTrack();updateTitleCard();
      setLyricsStatus('Identifying track…');
      const duration=Number(audio.duration)||0;
      let matches=[];
      try{matches=await fetchItunesMatches(meta,duration);}
      catch(error){console.warn('[KEFE iTunes identification]',error);}
      if(mediaObjectUrl!==uploadId)return;
      const best=matches[0];
      if(best&&isConfidentMatch(best,meta,duration)){
        applyIdentifiedTrack(best);
        renderSongSuggestions(matches.slice(0,5),{excludeCurrent:true});
        setLyricsStatus('Track identified. Finding lyrics…');
        await loadAutomaticLyrics();
      }else if(meta.title&&meta.artist){
        renderSongSuggestions(matches.slice(0,5),{excludeCurrent:false});
        setLyricsStatus('Using embedded song details. Finding lyrics…');
        const found=await loadAutomaticLyrics();
        if(!found&&mediaObjectUrl===uploadId)promptManualDetails(matches);
      }else{
        promptManualDetails(matches);
      }
    }catch(error){
      console.warn('[KEFE track identification]',error);
      if(mediaObjectUrl===uploadId)promptManualDetails([]);
    }
  }
  let manualSearchTimer=null,manualSearchSeq=0;
  function scheduleManualSearch(){
    clearTimeout(manualSearchTimer);
    if(songTitle.value.trim().length<2)return;
    manualSearchTimer=setTimeout(runManualSearch,450);
  }
  async function runManualSearch(){
    const seq=++manualSearchSeq;
    const meta={title:songTitle.value.trim(),artist:songArtist.value.trim()};
    if(!meta.title)return;
    try{
      const matches=await fetchItunesMatches(meta,Number(audio.duration)||0);
      if(seq!==manualSearchSeq)return;
      renderSongSuggestions(matches.slice(0,5),{excludeCurrent:false});
      setLyricsStatus(matches.length?'Pick the correct song from the suggestions.':'No matches found. Check the spelling or add the artist.');
    }catch(error){
      if(seq!==manualSearchSeq)return;
      console.warn('[KEFE manual search]',error);
      setLyricsStatus('Song search failed. Check your connection and try again.');
    }
  }
  async function handleLrcFile(file){
    try{
      const text=String(await file.text()).replace(/^﻿/,'').trim();
      const lines=text.startsWith('<')?parseAppleTTML(text):parseLrcText(text);
      if(!lines.length){
        setLyricsStatus('No timed lyrics found in '+file.name+'. Expected lines like [01:23.45] text.');
        openEditorPanel('lyrics');
        return false;
      }
      lyricsRequest++;
      return setLyricsFromLines(lines,'Loaded lyrics from '+file.name+'.');
    }catch(error){
      console.warn('[KEFE LRC upload]',error);
      setLyricsStatus('Could not read that lyrics file.');
      return false;
    }
  }
  function ensureLyricsTools(){
    if(document.getElementById('kefeLyricsTools')||!lyricsInput.parentNode)return;
    const bar=document.createElement('div');
    bar.id='kefeLyricsTools';
    bar.style.cssText='display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 10px';
    const btnStyle='padding:8px 12px;border-radius:999px;border:1px solid currentColor;background:transparent;color:inherit;cursor:pointer;font:inherit;font-size:13px';
    const find=document.createElement('button');
    find.type='button';find.id='kefeFindLyrics';find.textContent='Find lyrics';find.style.cssText=btnStyle;
    const upload=document.createElement('button');
    upload.type='button';upload.id='kefeUploadLrc';upload.textContent='Upload .lrc';upload.style.cssText=btnStyle;
    const input=document.createElement('input');
    input.type='file';input.id='kefeLrcInput';input.accept='.lrc,.ttml,.xml,.txt,text/plain';input.hidden=true;
    bar.append(find,upload,input);
    if(!document.getElementById('kefeLyricsStatus')){
      const st=document.createElement('span');
      st.id='kefeLyricsStatus';st.style.cssText='font-size:13px;opacity:.8';
      bar.appendChild(st);
    }
    lyricsInput.parentNode.insertBefore(bar,lyricsInput);
    find.addEventListener('click',()=>{
      if(!songTitle.value.trim()||!songArtist.value.trim()){
        promptManualDetails([]);
        return;
      }
      loadAutomaticLyrics();
    });
    upload.addEventListener('click',()=>input.click());
    input.addEventListener('change',()=>{
      const file=input.files?.[0];
      input.value='';
      if(file)handleLrcFile(file);
    });
  }
  songTitle.addEventListener('input',()=>{updateTitleCard();scheduleManualSearch();});
  songArtist.addEventListener('input',()=>{updateTitleCard();scheduleManualSearch();});
  songAlbum.addEventListener('input',()=>updateTitleCard());
  songYear.addEventListener('input',()=>updateTitleCard());
  lyricsInput.addEventListener('input',parseLyrics);
  fontSelect.addEventListener('change',()=>{state.fontOverride=fontSelect.value;draw()});
  lyricEffectSelect.addEventListener('change',()=>setEffect(lyricEffectSelect.value));
  const uploadZone=document.getElementById('kefeUploadZone');
  const mediaInput=document.getElementById('mediaInput');
  if(uploadZone&&mediaInput){
    uploadZone.addEventListener('dragover',event=>{event.preventDefault();uploadZone.classList.add('is-dragging')});
    uploadZone.addEventListener('dragleave',()=>uploadZone.classList.remove('is-dragging'));
    uploadZone.addEventListener('drop',event=>{event.preventDefault();uploadZone.classList.remove('is-dragging');const file=event.dataTransfer?.files?.[0];if(!file)return;mediaInput.files=event.dataTransfer.files;mediaInput.dispatchEvent(new Event('change',{bubbles:true}))});
  }
  mediaInput.addEventListener('change',e=>{
    const file=e.target.files?.[0];if(!file)return;
    if(/\.(lrc|ttml|xml|txt)$/i.test(file.name)||file.type==='text/plain'){handleLrcFile(file);e.target.value='';return;}
    if(mediaObjectUrl)URL.revokeObjectURL(mediaObjectUrl);
    mediaObjectUrl=URL.createObjectURL(file);
    previewStage.classList.remove('is-empty');
    songTitle.value=file.name.replace(/\.[^.]+$/,'').replace(/[._]+/g,' ').trim();
    songArtist.value='';songAlbum.value='';songYear.value='';
    state.appleLines=[];state.lines=[];lyricsInput.value='';clearManualNotice();
    delete songAlbum.dataset.artUrl;delete songAlbum.dataset.trackDuration;delete songAlbum.dataset.platformId;
    const status=document.getElementById('kefeLyricsStatus');if(status)status.textContent='Reading track information…';
    const uploadName=document.querySelector('.kefe-upload-name');if(uploadName)uploadName.textContent=file.name;
    if(titleCard){titleCard.classList.remove('active','leaving');titleCard.setAttribute('aria-hidden','true');}
    video.onplay=null;video.muted=true;
    const loadUrl=mediaObjectUrl;
    audio.src=mediaObjectUrl;audio.load();
    if(file.type.startsWith('video/')){video.src=mediaObjectUrl;video.load();}else{video.removeAttribute('src');video.load();}
    const onDecodeError=()=>{
      if(mediaObjectUrl!==loadUrl)return;
      setLyricsStatus('This browser cannot play that file. Try MP3, M4A, WAV or MP4.');
      if(uploadName)uploadName.textContent='Could not read '+file.name;
      previewStage.classList.add('is-empty');
    };
    audio.addEventListener('error',onDecodeError,{once:true});
    audio.addEventListener('loadedmetadata',async function identifyOnce(){
      audio.removeEventListener('loadedmetadata',identifyOnce);
      if(mediaObjectUrl!==loadUrl)return;
      audio.removeEventListener('error',onDecodeError);
      if(!Number.isFinite(audio.duration)){
        // Some WebM/streamed files report Infinity; seeking far forces the real duration.
        await new Promise(resolve=>{
          const done=()=>{audio.removeEventListener('durationchange',check);clearTimeout(timer);resolve();};
          const check=()=>{if(Number.isFinite(audio.duration))done();};
          const timer=setTimeout(done,3000);
          audio.addEventListener('durationchange',check);
          audio.currentTime=1e101;
        });
        audio.currentTime=0;
        if(mediaObjectUrl!==loadUrl)return;
      }
      range.max=String(Number.isFinite(audio.duration)&&audio.duration>0?audio.duration:30);timeEnd.textContent=fmt(Number(range.max));updateTime();
      identifyAndLoadTrack(file);
    });
    updateTitleCard();syncAppleLyricsMetadata();
    queueMicrotask(()=>{e.target.value='';});
  });
  function updatePlayButton(){
    const button=document.getElementById('playButton');
    if(!button)return;
    const playing=!!audio.src&&!audio.paused;
    button.setAttribute('aria-label',playing?'Pause':'Play');
    button.setAttribute('title',playing?'Pause':'Play');
    button.innerHTML=playing?'<svg class="kefe-pause-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg>':'<svg class="kefe-play-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10-6.5z" fill="currentColor"/></svg>';
  }
  document.getElementById('playButton').onclick=()=>{
    if(audio.src){if(audio.paused)audio.play();else audio.pause();}
    else{state.time=state.time>=30?0:state.time+.05;updateTime();draw();}
  };
  function syncAppleLyricsMetadata(){
    const appleLyrics=document.getElementById('kefeAppleLyrics');
    if(!appleLyrics)return;
    const title=songTitle.value.trim(),artist=songArtist.value.trim(),album=songAlbum.value.trim();
    appleLyrics.songTitle=title;
    appleLyrics.songArtist=artist;
    appleLyrics.songAlbum=album;
    appleLyrics.query=[title,artist].filter(Boolean).join(' - ');
    appleLyrics.songDurationMs=Math.round((audio.duration||video.duration||0)*1000);
    appleLyrics.currentTime=Math.round((audio.currentTime||state.time||0)*1000);
  }
  function syncAppleLyrics(seeking=false){
    const appleLyrics=document.getElementById('kefeAppleLyrics');
    if(!appleLyrics||!audio.src)return;
    appleLyrics.currentTime=Math.round(audio.currentTime*1000);
    if(seeking&&typeof appleLyrics.seek==='function')appleLyrics.seek();
  }
  audio.addEventListener('timeupdate',()=>{
    if(audio.paused){
      state.time=audio.currentTime;range.value=state.time;updateTime();syncAppleLyrics();
    }
  });
  function syncPreview(){
    const firstLyric=state.lines[0]?.time;
    if(titleCard&&titleCard.classList.contains('active')&&!titleCard.classList.contains('leaving')&&Number.isFinite(firstLyric)&&audio.currentTime>=firstLyric)hideTitleCard();
    if(audio.src&&!audio.paused){
      state.time=audio.currentTime;
      range.value=state.time;
      updateTime();
      syncAppleLyrics();
      draw();
      requestAnimationFrame(syncPreview);
    }
  }
  audio.addEventListener('play',()=>{
    updatePlayButton();
    if(video.src){
      video.currentTime=audio.currentTime;
      video.play().catch(err=>console.warn('[KEFE video]',err));
    }
    if(audio.currentTime<=0.08&&titleCardShownFor!==mediaObjectUrl)showTitleCard();
    syncAppleLyrics();
    requestAnimationFrame(syncPreview);
  });
  audio.addEventListener('pause',()=>{
    updatePlayButton();
    if(video.src&&!video.paused)video.pause();
    syncAppleLyrics();
    
  });
  audio.addEventListener('ended',()=>{
    updatePlayButton();
    if(video.src&&!video.paused)video.pause();
    hideTitleCard();
    syncAppleLyrics(true);
    const appleLyrics=document.getElementById('kefeAppleLyrics');
    if(appleLyrics&&typeof appleLyrics.pause==='function')appleLyrics.pause();
  });
  audio.addEventListener('seeking',()=>syncAppleLyrics(true));
  audio.addEventListener('seeked',()=>{
    if(video.src)video.currentTime=audio.currentTime;
    syncAppleLyrics(true);draw();
  });
  range.addEventListener('input',()=>{
    state.time=Number(range.value);
    if(audio.src)audio.currentTime=state.time;
    if(video.src)video.currentTime=state.time;
    const appleLyrics=document.getElementById('kefeAppleLyrics');
    syncAppleLyrics(true);
    updateTime();draw();
  });
  let exportTap=null,exporting=false;
  function getExportAudioStream(){
    if(exportTap)return exportTap.stream;
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC)return null;
    try{
      const ac=new AC(),src=ac.createMediaElementSource(audio),dest=ac.createMediaStreamDestination();
      src.connect(ac.destination);src.connect(dest);
      exportTap={ac,stream:dest.stream};
      return exportTap.stream;
    }catch(error){console.warn('[KEFE export audio]',error);return null;}
  }
  document.getElementById('exportButton').addEventListener('click',async()=>{
    const status=document.getElementById('exportStatus'),button=document.getElementById('exportButton'),visualiserCanvas=document.getElementById('kefeVisualiserCanvas');
    if(exporting)return;
    if(!window.MediaRecorder||!HTMLCanvasElement.prototype.captureStream||!visualiserCanvas){status.textContent='Video export is not supported by this browser.';return;}
    if(!audio.src||!Number.isFinite(audio.duration)){status.textContent='Upload a track first.';return;}
    const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm','video/mp4'].find(m=>MediaRecorder.isTypeSupported(m));
    if(!mime){status.textContent='No supported video format in this browser.';return;}
    const ext=mime.startsWith('video/mp4')?'mp4':'webm';
    const res=Number(document.getElementById('exportResolution').value)||720;
    const aspect=previewAspectRatio||'16:9';
    const even=n=>Math.round(n/2)*2;
    const long=even(res*16/9);
    const dims=aspect==='9:16'?[res,long]:aspect==='1:1'?[res,res]:[long,res];
    const prev={w:canvas.width,h:canvas.height,time:state.time};
    const compositeCanvas=document.createElement('canvas');
    compositeCanvas.width=dims[0];compositeCanvas.height=dims[1];
    const compositeCtx=compositeCanvas.getContext('2d');
    const compositeFrame=()=>{
      compositeCtx.fillStyle='#000';compositeCtx.fillRect(0,0,dims[0],dims[1]);
      const vw=visualiserCanvas.width,vh=visualiserCanvas.height;
      if(vw&&vh){const k=Math.max(dims[0]/vw,dims[1]/vh),dw=vw*k,dh=vh*k;compositeCtx.drawImage(visualiserCanvas,(dims[0]-dw)/2,(dims[1]-dh)/2,dw,dh);}
      compositeCtx.drawImage(canvas,0,0,dims[0],dims[1]);
    };
    const visExport=window.kefeVisualiserExport;
    exporting=true;button.disabled=true;
    let recorder=null,ticker=null,frameTicker=null;
    try{
      audio.pause();
      canvas.width=dims[0];canvas.height=dims[1];
      if(visExport)visExport.begin(dims[0],dims[1]);
      await new Promise(resolve=>{
        if(audio.currentTime===0){resolve();return;}
        audio.addEventListener('seeked',resolve,{once:true});audio.currentTime=0;
      });
      state.time=0;range.value=0;updateTime();draw();
      const audioStream=getExportAudioStream();
      if(exportTap&&exportTap.ac.state==='suspended')await exportTap.ac.resume();
      compositeFrame();
      const stream=compositeCanvas.captureStream(30);
      frameTicker=setInterval(compositeFrame,33);
      if(audioStream)audioStream.getAudioTracks().forEach(t=>stream.addTrack(t));
      else status.textContent='Audio capture unavailable here; exporting video only…';
      const chunks=[];
      recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:res>=1080?8000000:4000000});
      recorder.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data)};
      const stopped=new Promise(resolve=>{recorder.onstop=resolve});
      recorder.start(1000);
      const ended=new Promise(resolve=>audio.addEventListener('ended',resolve,{once:true}));
      await audio.play();
      ticker=setInterval(()=>{status.textContent='Exporting '+Math.min(99,Math.round(audio.currentTime/audio.duration*100))+'% — keep this tab open…';},500);
      await ended;
      clearInterval(ticker);ticker=null;
      clearInterval(frameTicker);frameTicker=null;
      compositeFrame();
      await new Promise(r=>setTimeout(r,300));
      recorder.stop();await stopped;
      const blob=new Blob(chunks,{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');
      const name=[songArtist.value,songTitle.value].map(v=>v.trim()).filter(Boolean).join(' - ').replace(/[\\/:*?"<>|]+/g,'')||'kefe-visualiser';
      a.href=url;a.download=name+'.'+ext;document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),10000);
      status.textContent='Export complete ('+dims[0]+'×'+dims[1]+' '+ext.toUpperCase()+').';
    }catch(error){
      console.warn('[KEFE export]',error);
      status.textContent='Export failed: '+(error?.message||'unknown error');
      try{if(recorder&&recorder.state!=='inactive')recorder.stop();}catch(_){}
    }finally{
      if(ticker)clearInterval(ticker);
      if(frameTicker)clearInterval(frameTicker);
      canvas.width=prev.w;canvas.height=prev.h;
      if(visExport)visExport.end();
      exporting=false;button.disabled=false;
      audio.pause();state.time=prev.time;range.value=prev.time;audio.currentTime=prev.time;updateTime();draw();
    }
  });
  function fmt(v){v=Math.max(0,Number(v)||0);return Math.floor(v/60)+':'+String(Math.floor(v%60)).padStart(2,'0')}
  function updateTime(){
    timeNow.textContent=fmt(state.time);timeEnd.textContent=fmt(Number(range.max)||30);
    const p=(state.time/(Number(range.max)||30))*100;
    range.style.setProperty('--progress',p+'%');playhead.style.left=p+'%';
  }

  (function initWaveform(){
    var host = document.getElementById('waveform');
    if (!host) return;
    var cv = document.createElement('canvas');
    cv.id = 'kefeWaveCanvas';
    cv.style.cssText = 'position:absolute;left:0;right:0;top:0;bottom:0;width:100%;height:100%;pointer-events:none;z-index:1;';
    host.appendChild(cv);
    var g = cv.getContext('2d');
    var BAR_COUNT = 140;
    var peaks = placeholder();
    var dpr = window.devicePixelRatio || 1;
    var lastW = 0, lastH = 0;
    function placeholder(){
      var out = new Float32Array(BAR_COUNT);
      var seed = 1337;
      function rnd(){ seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
      for (var i = 0; i < BAR_COUNT; i++) {
        var t = i / (BAR_COUNT - 1);
        out[i] = Math.sin(t * Math.PI) * (0.18 + rnd() * 0.26);
      }
      return out;
    }
    function computePeaks(buffer, done){
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return done(null);
      var actx = new AC();
      actx.decodeAudioData(buffer.slice(0), function(decoded){
        var a = decoded.getChannelData(0);
        if (decoded.numberOfChannels > 1) {
          var b = decoded.getChannelData(1);
          var m = new Float32Array(a.length);
          for (var i = 0; i < a.length; i++) m[i] = (a[i] + b[i]) * 0.5;
          a = m;
        }
        var block = Math.max(1, Math.floor(a.length / BAR_COUNT));
        var out = new Float32Array(BAR_COUNT), max = 0;
        for (var k = 0; k < BAR_COUNT; k++) {
          var s = k * block, e = Math.min(a.length, s + block), pk = 0;
          for (var j = s; j < e; j++) { var v = a[j] < 0 ? -a[j] : a[j]; if (v > pk) pk = v; }
          out[k] = pk; if (pk > max) max = pk;
        }
        if (max > 0) for (var z = 0; z < BAR_COUNT; z++) out[z] /= max;
        try { actx.close(); } catch (err) {}
        done(out);
      }, function(){ try { actx.close(); } catch (err) {} done(null); });
    }
    function roundRect(c, x, y, w, h, r){
      r = Math.min(r, h / 2, w / 2);
      c.beginPath();
      c.moveTo(x + r, y);
      c.arcTo(x + w, y, x + w, y + h, r);
      c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r);
      c.arcTo(x, y, x + w, y, r);
      c.closePath();
    }
    function resizeIfNeeded(){
      var r = host.getBoundingClientRect();
      if (r.width !== lastW || r.height !== lastH) {
        lastW = r.width; lastH = r.height;
        dpr = window.devicePixelRatio || 1;
        cv.width = Math.max(1, Math.round(r.width * dpr));
        cv.height = Math.max(1, Math.round(r.height * dpr));
      }
    }
    function draw(){
      resizeIfNeeded();
      var w = cv.width, h = cv.height;
      if (!w || !h) return;
      g.clearRect(0, 0, w, h);
      var barW = Math.max(dpr, w / (BAR_COUNT * 2.6));
      var gap = (w - barW * BAR_COUNT) / (BAR_COUNT - 1);
      var midY = h / 2;
      var dur = Number(range.max) || 30;
      var frac = Math.max(0, Math.min(1, (Number(range.value) || 0) / dur));
      var splitX = frac * w;
      var radius = h / 2;
      var liquidHeight = h * 0.72;
      var liquidTop = midY - liquidHeight / 2;

      // The waveform is the liquid itself: a translucent, softly undulating fill
      // that rises across the tube with playback instead of rendering as separate bars.
      g.save();
      g.beginPath();
      g.moveTo(0, h);
      g.lineTo(0, midY + h * 0.08);
      for (var lx = 0; lx <= splitX; lx += Math.max(2 * dpr, w / 90)) {
        var li = Math.min(BAR_COUNT - 1, Math.floor((lx / Math.max(1, w)) * BAR_COUNT));
        var lv = peaks[li] || 0;
        var ly = midY + h * 0.05 - lv * h * 0.30;
        g.lineTo(lx, ly);
      }
      g.lineTo(splitX, h);
      g.closePath();

      var liquidGrad = g.createLinearGradient(0, liquidTop, 0, h);
      liquidGrad.addColorStop(0, 'rgba(164,181,155,0.12)');
      liquidGrad.addColorStop(0.38, 'rgba(164,181,155,0.28)');
      liquidGrad.addColorStop(0.72, 'rgba(164,181,155,0.42)');
      liquidGrad.addColorStop(1, 'rgba(164,181,155,0.16)');
      g.fillStyle = liquidGrad;
      g.shadowColor = 'rgba(164,181,155,0.28)';
      g.shadowBlur = 10 * dpr;
      g.fill();

      // Keep the waveform visible inside the liquid as a subtle glass texture.
      g.beginPath();
      g.moveTo(0, midY);
      for (var wx = 0; wx <= splitX; wx += Math.max(2 * dpr, w / 120)) {
        var wi = Math.min(BAR_COUNT - 1, Math.floor((wx / Math.max(1, w)) * BAR_COUNT));
        var wv = peaks[wi] || 0;
        g.lineTo(wx, midY - wv * h * 0.34);
      }
      g.strokeStyle = 'rgba(255,255,255,0.34)';
      g.lineWidth = Math.max(1, dpr);
      g.shadowColor = 'rgba(255,255,255,0.18)';
      g.shadowBlur = 5 * dpr;
      g.stroke();
      g.restore();

      // A faint unplayed waveform remains recessed in the tube.
      g.save();
      g.globalAlpha = 0.22;
      g.beginPath();
      g.moveTo(splitX, midY);
      for (var ux = splitX; ux <= w; ux += Math.max(2 * dpr, w / 120)) {
        var ui = Math.min(BAR_COUNT - 1, Math.floor((ux / Math.max(1, w)) * BAR_COUNT));
        var uv = peaks[ui] || 0;
        g.lineTo(ux, midY - uv * h * 0.30);
      }
      g.strokeStyle = 'rgba(90,80,70,0.55)';
      g.lineWidth = Math.max(1, dpr);
      g.stroke();
      g.restore();
    }
    function loop(){ draw(); requestAnimationFrame(loop); }
    loop();
    var input = document.getElementById('mediaInput');
    if (input) {
      input.addEventListener('change', function(ev){
        var file = ev.target.files && ev.target.files[0];
        if (!file || /\.(lrc|ttml|xml|txt)$/i.test(file.name)) return;
        var reader = new FileReader();
        reader.onload = function(){
          computePeaks(reader.result, function(p){ peaks = p || placeholder(); });
        };
        reader.readAsArrayBuffer(file);
      });
    }
    window.addEventListener('resize', function(){ lastW = 0; lastH = 0; });
  })();

  parseLyrics();setEffect('apple');updateTitleCard();updateTime();updatePlayButton();fitPreviewStage();ensureLyricsTools();
  syncAppleLyricsMetadata();
  syncAppleLyrics(true);
})();
