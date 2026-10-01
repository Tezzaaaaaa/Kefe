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
  const empty=document.getElementById('emptyState'),lyricsInput=document.getElementById('lyricsInput');
  const audio=document.getElementById('kefeAudio'),range=document.getElementById('kefeTime');
  const video=document.createElement('video');
  video.preload='metadata'; video.muted=true; video.playsInline=true; video.style.display='none'; document.body.appendChild(video);
  let mediaObjectUrl=''; let visualiserPreset='none',visualiserBackground='accent',visualiserMotion='reactive';
  let previewAspectRatio='16:9';
  const titleCard=document.getElementById('kefeTitleCard'),titleName=document.getElementById('kefeTitleName'),titleArtist=document.getElementById('kefeTitleArtist'),titleAlbum=document.getElementById('kefeTitleAlbum'),titleYear=document.getElementById('kefeTitleYear'),titleArt=document.getElementById('kefeTitleArt'),titleArtFallback=document.getElementById('kefeTitleArtFallback');
  let titleCardTimer=null,titleCardShownFor='';
  const songTitle=document.getElementById('songTitle'),songArtist=document.getElementById('songArtist'),songAlbum=document.getElementById('songAlbum'),songYear=document.getElementById('songYear');
  const previewFullscreen=document.getElementById('previewFullscreen'),previewStage=document.querySelector('.kefe-stage');
  function setPreviewAspectRatio(ratio){
    previewAspectRatio=ratio;
    previewStage.classList.remove('is-16x9','is-9x16','is-1x1');
    previewStage.classList.add(ratio==='9:16'?'is-9x16':ratio==='1:1'?'is-1x1':'is-16x9');
    const dimensions=ratio==='9:16'?[720,1280]:ratio==='1:1'?[1080,1080]:[1280,720];
    canvas.width=dimensions[0];canvas.height=dimensions[1];
    document.querySelectorAll('.kefe-aspect-button').forEach(button=>{const active=button.dataset.aspect===ratio;button.classList.toggle('active',active);button.setAttribute('aria-pressed',active?'true':'false');});
    fitPreviewStage();
    draw();
  }
  document.querySelectorAll('.kefe-aspect-button').forEach(button=>button.addEventListener('click',()=>{const controls=button.closest('.kefe-aspect-controls');if(button.classList.contains('active')){controls.classList.toggle('is-open');return;}setPreviewAspectRatio(button.dataset.aspect);fitPreviewStage();controls.classList.remove('is-open');}));
  function updateFullscreenButton(){
    const active=document.fullscreenElement===previewStage||document.webkitFullscreenElement===previewStage||previewStage.classList.contains('kefe-pseudo-fullscreen');
    previewFullscreen.setAttribute('aria-label',active?'Exit fullscreen':'Enter fullscreen');
    previewFullscreen.setAttribute('title',active?'Exit fullscreen':'Enter fullscreen');
    previewFullscreen.innerHTML=active?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4H4v5M20 9V4h-5M4 15v5h5M15 20h5v-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M21 16v5h-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  function setPseudoFullscreen(active){
    previewStage.classList.toggle('kefe-pseudo-fullscreen',active);
    document.body.classList.toggle('kefe-fullscreen-open',active);
    updateFullscreenButton();
  }
  async function enterKefeFullscreen(){
    if(document.fullscreenElement===previewStage||document.webkitFullscreenElement===previewStage||previewStage.classList.contains('kefe-pseudo-fullscreen'))return;
    if(window.matchMedia('(max-width:700px)').matches){
      setPseudoFullscreen(true);
      return;
    }
    try{
      if(typeof previewStage.requestFullscreen==='function'){
        await previewStage.requestFullscreen();
        return;
      }
      if(typeof previewStage.webkitRequestFullscreen==='function'){
        previewStage.webkitRequestFullscreen();
        return;
      }
    }catch(err){console.warn('[KEFE fullscreen]',err);}
    setPseudoFullscreen(true);
  }
  async function exitKefeFullscreen(){
    if(document.fullscreenElement===previewStage&&typeof document.exitFullscreen==='function'){
      await document.exitFullscreen();
      return;
    }
    if(document.webkitFullscreenElement===previewStage&&typeof document.webkitExitFullscreen==='function'){
      document.webkitExitFullscreen();
      return;
    }
    setPseudoFullscreen(false);
  }
  previewFullscreen.addEventListener('click',()=>document.fullscreenElement===previewStage||document.webkitFullscreenElement===previewStage||previewStage.classList.contains('kefe-pseudo-fullscreen')?exitKefeFullscreen():enterKefeFullscreen());
  document.addEventListener('fullscreenchange',updateFullscreenButton);
  document.addEventListener('webkitfullscreenchange',updateFullscreenButton);
  document.addEventListener('fullscreenerror',()=>setPseudoFullscreen(true));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&previewStage.classList.contains('kefe-pseudo-fullscreen'))setPseudoFullscreen(false)});
  const timeNow=document.getElementById('timeNow'),timeEnd=document.getElementById('timeEnd'),playhead=document.getElementById('playhead');

  function normalizeArtworkUrl(url,size='600x600bb'){
    const value=String(url||'').trim();
    if(!value)return '';
    return value.replace(/^http:/i,'https:').replace(/\\b\\d+x\\d+bb(?=[.-])/i,size);
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
  function renderSongSuggestions(results){
    const panel=document.getElementById('kefeSuggestions');
    const list=document.getElementById('kefeSuggestionList');
    const status=document.getElementById('kefeSuggestionsStatus');
    if(!panel||!list||!status)return;
    list.innerHTML='';
    const currentTitle=songTitle.value.trim().toLowerCase();
    const currentArtist=songArtist.value.trim().toLowerCase();
    const items=(Array.isArray(results)?results:[]).filter(item=>item.trackName).filter(item=>!(String(item.trackName||'').toLowerCase()===currentTitle&&String(item.artistName||'').toLowerCase()===currentArtist)).slice(0,4);
    status.innerHTML=items.length?'Other matches':'No other matches';
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
        panel.hidden=true;
        list.innerHTML='';
        loadBiniLyrics();
      });
      list.appendChild(button);
    });
  }
  function updateTitleCard(){
    updateMediaTrack();
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
      image.addEventListener('load',()=>{if(state.effect==='apple')draw();},{once:true});
      titleArt.appendChild(image);
    }else{
      titleArt.innerHTML='';
      titleArt.appendChild(titleArtFallback);
    }
  }
  async function fetchAlbumArt(title,artist,album){
    if(!title)return;
    const query=[title,artist].filter(Boolean).join(' ');
    const mbUrl='https://musicbrainz.org/ws/2/recording?query='+encodeURIComponent(query)+'&fmt=json&limit=1';
    const r=await fetch('https://kefe-proxy.kuresa-afamasaga.workers.dev/?url='+encodeURIComponent(mbUrl));
    const result=await r.json();
    const item=(result.recordings||[])[0];
    const release=item?.releases?.[0];
    if(!release?.id)return;
    songAlbum.dataset.artUrl='https://coverartarchive.org/release/'+release.id+'/front-500';
    updateMediaTrack();
    updateTitleCard();
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
    if(!audio.src||!titleCard)return;updateTitleCard();titleCardShownFor=mediaObjectUrl;
    titleCard.classList.remove('leaving');titleCard.classList.add('active');titleCard.setAttribute('aria-hidden','false');applyAppleAlbumGradient();
    if(titleCardTimer)clearTimeout(titleCardTimer);
  }
  function hideTitleCard(){
    if(!titleCard||!titleCard.classList.contains('active')||titleCard.classList.contains('leaving'))return;
    titleCard.classList.add('leaving');titleCard.setAttribute('aria-hidden','true');
    if(titleCardTimer)clearTimeout(titleCardTimer);titleCardTimer=setTimeout(()=>titleCard.classList.remove('active','leaving'),600);
  }
  function parseLyrics(){
    const raw=lyricsInput.value.replace(/\r/g,'').split(/\n+/).map(s=>s.trim()).filter(Boolean);
    const synced=raw.map(line=>{
      const m=line.match(/^\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]\s*(.*)$/);
      if(!m)return null;
      const fraction=m[3]?Number(m[3])/(m[3].length===3?1000:100):0;
      return {text:m[4].trim(),time:Number(m[1])*60+Number(m[2])+fraction};
    }).filter(line=>line&&line.text);
    if(synced.length){
      state.lines=synced.map((line,i)=>({...line,endTime:synced[i+1]?.time||line.time+3}));
      lyricsInput.value=state.lines.map(line=>{
        const mins=Math.floor(line.time/60),secs=line.time-mins*60;
        return '['+String(mins).padStart(2,'0')+':'+secs.toFixed(3).padStart(6,'0').replace(/0+$/,'').replace(/\.$/,'')+'] '+line.text;
      }).join('\n');
    }else{
      state.lines=raw.map((text,i)=>({text,time:i*3,endTime:(i+1)*3}));
    }
    state.appleLines=state.lines.map(line=>({...line,end:Number.isFinite(line.endTime)?line.endTime:line.time+3}));
    empty.hidden=state.lines.length>0;empty.classList.toggle('is-hidden',state.lines.length===0);
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
  function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const hasUploadedMedia=!!(audio.currentSrc||audio.src||video.currentSrc||video.src);
    const emptyState=document.getElementById('emptyState');
    if(emptyState){const showEmpty=!hasUploadedMedia&&!state.appleLines.length&&!state.lines.length;emptyState.hidden=!showEmpty;emptyState.classList.toggle('is-hidden',!showEmpty);}
    const t=state.time;
    if(visualiserBackground==='gradient'){
      const g=ctx.createLinearGradient(0,0,canvas.width,canvas.height);g.addColorStop(0,'#080808');g.addColorStop(1,'#24201f');ctx.fillStyle=g;ctx.fillRect(0,0,canvas.width,canvas.height);
    }else if(visualiserBackground==='accent'){
      ctx.fillStyle='rgba(120,185,255,.28)';ctx.fillRect(0,0,canvas.width,canvas.height);
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
      ctx.fillStyle='#080808';ctx.fillRect(0,0,canvas.width,canvas.height);
    }
    if(video.src&&video.readyState>=2){
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
  function parseAppleLrc(lyrics){
    if(typeof lyrics!=='string'||!lyrics.trim())return [];
    return lyrics.replace(/\r/g,'').split(/\n+/).map(line=>{
      const match=line.match(/^\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]\s*(.*)$/);
      if(!match)return null;
      const fraction=match[3]?Number(match[3])/(match[3].length===3?1000:100):0;
      const time=Number(match[1])*60+Number(match[2])+fraction;
      const text=match[4].trim();
      return text?{time,text}:null;
    }).filter(Boolean).sort((a,b)=>a.time-b.time).map((line,index)=>({...line,end:index+1?undefined:undefined}));
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
    const active=document.querySelector('.kefe-aspect-button.active')?.dataset.aspect||'16:9';
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
  document.querySelectorAll('.kefe-top-link').forEach(button=>button.addEventListener('click',()=>{
    const panel=button.dataset.topPanel;
    if(panel==='media'||panel==='editor')openEditorPanel('media');
  }));
  songTitle.addEventListener('input',()=>{updateTitleCard();scheduleAutomaticLyricsFetch()});songArtist.addEventListener('input',()=>{updateTitleCard();scheduleAutomaticLyricsFetch()});songAlbum.addEventListener('input',()=>{updateTitleCard();scheduleAutomaticLyricsFetch()});songYear.addEventListener('input',()=>{updateTitleCard();scheduleAutomaticLyricsFetch()});
  lyricsInput.addEventListener('input',parseLyrics);
  fontSelect.addEventListener('change',()=>{state.fontOverride=fontSelect.value;draw()});
  lyricEffectSelect.addEventListener('change',()=>setEffect(lyricEffectSelect.value));
  document.getElementById('mediaInput').addEventListener('change',e=>{
    const file=e.target.files?.[0];if(!file)return;
    e.target.value='';
    if(mediaObjectUrl)URL.revokeObjectURL(mediaObjectUrl);
    mediaObjectUrl=URL.createObjectURL(file);
    const uploadUrl=mediaObjectUrl;
    songArtist.value='';
    songAlbum.value='';
    songYear.value='';
    state.appleLines=[];
    state.lines=[];
    lyricsInput.value='';
    const uploadLyricsStatus=document.getElementById('kefeLyricsStatus');
    if(uploadLyricsStatus)uploadLyricsStatus.textContent='Identifying track…';
    empty.hidden=true;empty.classList.add('is-hidden');
    delete songAlbum.dataset.artUrl;
    delete songAlbum.dataset.trackDuration;
    delete songAlbum.dataset.platformId;
    const suggestionsPanel=document.getElementById('kefeSuggestions');
    const suggestionsList=document.getElementById('kefeSuggestionList');
    if(suggestionsPanel)suggestionsPanel.hidden=true;
    if(suggestionsList)suggestionsList.innerHTML='';
    if(titleCard){
      titleCard.classList.remove('active','leaving');
      titleCard.setAttribute('aria-hidden','true');
    }

    songTitle.value=file.name.replace(/\.[^.]+$/,'').replace(/[._]+/g,' ').trim();
    document.querySelector('.kefe-upload').textContent=file.name;
    video.onplay=null;
    video.muted=true;

    audio.src=mediaObjectUrl;
    audio.load();

    if(file.type.startsWith('video/')){
      video.src=mediaObjectUrl;
      video.load();
    }else{
      video.removeAttribute('src');
      video.load();
    }

    updateTitleCard();
    syncAppleLyricsMetadata();
    showTitleCard();
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
  audio.addEventListener('loadedmetadata',async()=>{
    range.max=String(audio.duration||30);timeEnd.textContent=fmt(audio.duration||30);updateTime();
    const lookupUrl=mediaObjectUrl;
    try{
      const raw=songTitle.value.trim().replace(/^\\s*\\d{1,3}[._)\\-]\\s*/,'');
      const parts=raw.split(/\\s+[-\\u2013\\u2014]\\s+/);
      const parsedArtist=parts.length>1?parts.shift().trim():'';
      const parsedTitle=parts.join(' - ').trim()||raw;
      const query=[parsedTitle,parsedArtist].filter(Boolean).join(' ');
      if(query){
        const itunesUrl='https://itunes.apple.com/search?term='+encodeURIComponent(query)+'&entity=song&limit=20&country=AU';
        const r=await fetch('https://kefe-proxy.kuresa-afamasaga.workers.dev/?url='+encodeURIComponent(itunesUrl));
        const result=await r.json();
        const items=Array.isArray(result.results)?result.results.filter(item=>item.trackName):[];
        if(items.length&&mediaObjectUrl===lookupUrl){
          const normalizedTitle=parsedTitle.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
          const normalizedArtist=parsedArtist.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
          let best=items[0],bestScore=-1;
          items.forEach(item=>{
            const itemTitle=String(item.trackName||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
            const itemArtist=String(item.artistName||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
            let score=0;
            if(itemTitle===normalizedTitle)score+=100;
            else if(itemTitle.includes(normalizedTitle)||normalizedTitle.includes(itemTitle))score+=45;
            if(normalizedArtist&&(itemArtist===normalizedArtist))score+=100;
            else if(normalizedArtist&&(itemArtist.includes(normalizedArtist)||normalizedArtist.includes(itemArtist)))score+=45;
            if(audio.duration&&item.trackTimeMillis)score+=Math.max(0,30-Math.abs(Number(item.trackTimeMillis)/1000-audio.duration));
            if(score>bestScore){bestScore=score;best=item;}
          });
          songTitle.value=best.trackName||parsedTitle;
          songArtist.value=best.artistName||parsedArtist||'';
          songAlbum.value=best.collectionName||'';
          songYear.value=best.releaseDate?String(best.releaseDate).slice(0,4):'';
          songAlbum.dataset.artUrl=normalizeArtworkUrl(best.artworkUrl100);
          songAlbum.dataset.trackDuration=best.trackTimeMillis?String(Math.round(Number(best.trackTimeMillis)/1000)):'';
          songAlbum.dataset.platformId=best.trackId?String(best.trackId):'';
          const mapped=items.map(it=>({
            trackName:it.trackName,
            artistName:it.artistName,
            collectionName:it.collectionName,
            releaseDate:it.releaseDate,
            trackTimeMillis:it.trackTimeMillis||0,
            artworkUrl100:it.artworkUrl100||'',
            trackId:it.trackId
          }));
          renderSongSuggestions(mapped);
          updateMediaTrack();
          updateTitleCard();
          applyAppleAlbumGradient();
          syncAppleLyricsMetadata();
        }else{
          renderSongSuggestions([]);
        }
      }
    }catch(error){
      console.warn('[KEFE iTunes metadata]',error);
      renderSongSuggestions([]);
    }
    if(mediaObjectUrl===lookupUrl){
      syncAppleLyricsMetadata();
      loadBiniLyrics();
    }
  });
  let biniLyricsRequest=0,automaticLyricsTimer=null;
  function scheduleAutomaticLyricsFetch(){
    if(lyricsInput.value.trim())return;
    clearTimeout(automaticLyricsTimer);
    automaticLyricsTimer=setTimeout(()=>{
      if(!lyricsInput.value.trim())loadBiniLyrics();
    },500);
  }
  async function loadBiniLyrics(){
    const title=songTitle.value.trim(),artist=songArtist.value.trim(),album=songAlbum.value.trim();
    const duration=Math.round(Number(audio.duration)||Number(songAlbum.dataset.trackDuration)||0);
    const platformId=String(songAlbum.dataset.platformId||'').trim();
    const lyricsStatus=document.getElementById('kefeLyricsStatus');
    if(!title||!artist){
      if(lyricsStatus)lyricsStatus.textContent='Identify the track to fetch synchronized lyrics.';
      return;
    }
    const request=++biniLyricsRequest;
    const params=new URLSearchParams({track:title,artist,duration:String(duration)});
    if(album)params.set('album',album);
    if(platformId)params.set('platformId',platformId);
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),10000);
    try{
      if(lyricsStatus)lyricsStatus.textContent='Finding synchronized lyrics from BiniLyrics…';
      const response=await fetch('https://lyrics-api.binimum.org/getLyrics?'+params.toString(),{
        signal:controller.signal,
        headers:{
          'Accept':'application/json,text/plain;q=0.9,*/*;q=0.8',
          'X-Client-Package':'KEFE <https://tezzaaaaaa.github.io/Kefe/>'
        }
      });
      if(request!==biniLyricsRequest)return;
      const raw=await response.text();
      if(!response.ok)throw new Error('BiniLyrics lookup failed: '+response.status);
      let payload={};
      try{payload=raw.trim()?JSON.parse(raw):{};}catch(_){throw new Error('BiniLyrics returned invalid JSON');}
      const matches=Array.isArray(payload?.results)?payload.results:Array.isArray(payload?.data?.results)?payload.data.results:Array.isArray(payload)?payload:[payload];
      const match=matches.find(item=>typeof item?.lyricsUrl==='string'&&item.lyricsUrl.trim())||matches.find(item=>typeof item?.url==='string'&&item.url.trim())||null;
      const lyricsUrl=String(match?.lyricsUrl||match?.url||payload?.lyricsUrl||payload?.url||'').trim();
      if(!lyricsUrl)throw new Error(payload?.error||'BiniLyrics returned no lyric URL');
      const parsedUrl=new URL(lyricsUrl);
      if(parsedUrl.protocol!=='https:'||parsedUrl.hostname!=='lyrics-storage.binimum.org')throw new Error('BiniLyrics returned an untrusted lyric URL');
      const lyricsResponse=await fetch(parsedUrl.href,{signal:controller.signal,headers:{'Accept':'application/ttml+xml,application/xml,text/xml,text/plain;q=0.9,*/*;q=0.8'}});
      if(request!==biniLyricsRequest)return;
      if(!lyricsResponse.ok)throw new Error('BiniLyrics TTML fetch failed: '+lyricsResponse.status);
      const ttml=(await lyricsResponse.text()).trim();
      if(!ttml.startsWith('<'))throw new Error('BiniLyrics returned no TTML');
      const parsedLines=parseAppleTTML(ttml);
      if(!parsedLines.length)throw new Error('BiniLyrics TTML contained no timed lines');
      state.appleLines=parsedLines.map((line,index)=>({...line,end:Number.isFinite(line.end)?line.end:(parsedLines[index+1]?.time||line.time+3)}));
      state.lines=state.appleLines.map(line=>({text:line.text,time:line.time,endTime:line.end,words:Array.isArray(line.words)?line.words.map(word=>({text:word.text,time:word.time,endTime:word.endTime})):undefined}));
      empty.hidden=true;empty.classList.add('is-hidden');
      lyricsInput.value=state.appleLines.map(line=>{
        const mins=Math.floor(line.time/60),secs=line.time-mins*60;
        return '['+String(mins).padStart(2,'0')+':'+secs.toFixed(3).padStart(6,'0').replace(/0+$/,'').replace(/\\.$/,'')+'] '+line.text;
      }).join('\\n');
      if(lyricsStatus)lyricsStatus.textContent='Synchronized lyrics fetched from BiniLyrics.';
      openEditorPanel('lyrics');
      syncAppleLyricsMetadata();
      draw();
      syncAppleLyrics(true);
    }catch(error){
      if(request!==biniLyricsRequest)return;
      console.warn('[KEFE BiniLyrics]',error);
      const fallbackController=new AbortController();
      const fallbackTimeout=setTimeout(()=>fallbackController.abort(),10000);
      try{
        if(lyricsStatus)lyricsStatus.textContent='BiniLyrics unavailable — trying synchronized LRC lyrics…';
        const fallbackParams=new URLSearchParams({
          track_name:title,
          artist_name:artist,
          duration:String(Math.round(duration))
        });
        if(album)fallbackParams.set('album_name',album);
        let fallbackResponse=await fetch('https://lrclib.net/api/get?'+fallbackParams.toString(),{
          signal:fallbackController.signal,
          headers:{
            'Accept':'application/json',
            'X-User-Agent':'KEFE (https://tezzaaaaaa.github.io/Kefe/)'
          }
        });
        if(request!==biniLyricsRequest)return;
        let fallbackPayload={};
        if(fallbackResponse.ok){
          fallbackPayload=await fallbackResponse.json();
        }else if(fallbackResponse.status===404){
          const searchParams=new URLSearchParams({track_name:title,artist_name:artist});
          if(album)searchParams.set('album_name',album);
          fallbackResponse=await fetch('https://lrclib.net/api/search?'+searchParams.toString(),{
            signal:fallbackController.signal,
            headers:{
              'Accept':'application/json',
              'X-User-Agent':'KEFE (https://tezzaaaaaa.github.io/Kefe/)'
            }
          });
          if(request!==biniLyricsRequest)return;
          if(!fallbackResponse.ok)throw new Error('LRCLIB search failed: '+fallbackResponse.status);
          const searchResults=await fallbackResponse.json();
          const ranked=Array.isArray(searchResults)?searchResults.filter(item=>item?.syncedLyrics).sort((a,b)=>{
            const ad=Math.abs(Number(a.duration||0)-duration),bd=Math.abs(Number(b.duration||0)-duration);
            return ad-bd;
          }):[];
          fallbackPayload=ranked[0]||searchResults?.[0]||{};
        }else{
          throw new Error('LRCLIB lookup failed: '+fallbackResponse.status);
        }
        const lrc=String(fallbackPayload?.syncedLyrics||'').trim();
        if(!lrc)throw new Error('LRCLIB returned no synchronized LRC');
        const parsedLrc=parseAppleLrc(lrc);
        if(!parsedLrc.length)throw new Error('LRCLIB returned no timed lines');
        state.appleLines=parsedLrc.map((line,index)=>({...line,end:index+1<parsedLrc.length?parsedLrc[index+1].time:line.time+3}));
        state.lines=state.appleLines.map(line=>({text:line.text,time:line.time,endTime:line.end}));
        empty.hidden=true;empty.classList.add('is-hidden');
        lyricsInput.value=lrc;
        if(lyricsStatus)lyricsStatus.textContent='Synchronized lyrics fetched from LRCLIB.';
        openEditorPanel('lyrics');
        syncAppleLyricsMetadata();
        draw();
        syncAppleLyrics(true);
      }catch(fallbackError){
        if(request!==biniLyricsRequest)return;
        if(lyricsStatus)lyricsStatus.textContent='Synchronized lyrics unavailable for this track.';
        console.warn('[KEFE LRCLIB]',fallbackError);
      }finally{
        clearTimeout(fallbackTimeout);
      }
    }finally{
      clearTimeout(timeout);
    }
  }
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
    if(titleCard.classList.contains('active')&&!titleCard.classList.contains('leaving')&&Number.isFinite(firstLyric)&&audio.currentTime>=firstLyric)hideTitleCard();
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
  document.getElementById('visualiserPreset').addEventListener('change',e=>{visualiserPreset=e.target.value;draw()});
  document.getElementById('visualiserBackground').addEventListener('change',e=>{visualiserBackground=e.target.value;draw()});
  document.getElementById('visualiserMotion').addEventListener('change',e=>{visualiserMotion=e.target.value;draw()});
  document.getElementById('exportButton').addEventListener('click',async()=>{
    const status=document.getElementById('exportStatus'),format=document.getElementById('exportFormat').value;
    if(!window.MediaRecorder||!canvas.captureStream){status.textContent='Video export is not supported by this browser.';return;}
    const mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm';
    const stream=canvas.captureStream(30),chunks=[],recorder=new MediaRecorder(stream,{mimeType:mime});
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
    recorder.onstop=()=>{
      const blob=new Blob(chunks,{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download='kefe-visualiser.webm';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      status.textContent='Export complete.';
    };
    status.textContent='Exporting preview…';
    recorder.start();
    const start=state.time;
    let elapsed=0,last=performance.now();
    const tick=now=>{
      elapsed+=(now-last)/1000;last=now;state.time=start+elapsed;range.value=state.time;updateTime();draw();
      if(elapsed<Math.max(1,Number(range.max)-start))requestAnimationFrame(tick);else recorder.stop();
    };
    requestAnimationFrame(tick);
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
      g.fillStyle = 'rgba(90,80,70,0.10)';
      g.fillRect(0, Math.round(midY - dpr*0.5), w, Math.max(1, dpr));
      for (var i = 0; i < BAR_COUNT; i++) {
        var v = peaks[i];
        var bh = Math.max(2 * dpr, v * h * 0.86);
        var x = i * (barW + gap);
        var y = midY - bh / 2;
        var passed = (x + barW / 2) <= splitX;
        var grad = g.createLinearGradient(0, y, 0, y + bh);
        if (passed) {
          grad.addColorStop(0.00, 'rgba(164,181,155,0.30)');
          grad.addColorStop(0.50, 'rgba(164,181,155,0.95)');
          grad.addColorStop(1.00, 'rgba(164,181,155,0.30)');
        } else {
          grad.addColorStop(0.00, 'rgba(90,80,70,0.18)');
          grad.addColorStop(0.50, 'rgba(90,80,70,0.55)');
          grad.addColorStop(1.00, 'rgba(90,80,70,0.18)');
        }
        g.fillStyle = grad;
        if (passed) { g.shadowColor = 'rgba(164,181,155,0.55)'; g.shadowBlur = 4 * dpr; }
        else { g.shadowColor = 'transparent'; g.shadowBlur = 0; }
        roundRect(g, x, y, barW, bh, barW / 2);
        g.fill();
      }
      g.shadowBlur = 0;
      g.shadowColor = 'transparent';
    }
    function loop(){ draw(); requestAnimationFrame(loop); }
    loop();
    var input = document.getElementById('mediaInput');
    if (input) {
      input.addEventListener('change', function(ev){
        var file = ev.target.files && ev.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function(){
          computePeaks(reader.result, function(p){ peaks = p || placeholder(); });
        };
        reader.readAsArrayBuffer(file);
      });
    }
    window.addEventListener('resize', function(){ lastW = 0; lastH = 0; });
  })();

  parseLyrics();setEffect('apple');updateTitleCard();updateTime();updatePlayButton();fitPreviewStage();
  syncAppleLyricsMetadata();
  syncAppleLyrics(true);
})();