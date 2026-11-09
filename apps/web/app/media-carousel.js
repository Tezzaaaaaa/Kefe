/* KEFE — Uploaded-audio identification confirmation carousel.
   The carousel only displays catalogue matches returned by the uploaded-audio identification flow.
   It does not provide independent song, album or artist search. */
(function(){
  'use strict';
  var COUNTRIES=['AU','US'];
  var S={items:[],artists:[],localUpload:null,filter:'song',index:0,mode:'matches',albumTitle:'',token:0,timer:0};
  var el={};

  function $(id){return document.getElementById(id);}
  function mk(tag,cls,html){var e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e;}
  function art(url,size){return String(url||'').replace(/\/\d+x\d+(bb)?\.(jpg|jpeg|png)$/i,'/'+(size||400)+'x'+(size||400)+'bb.$2');}
  function kindOf(it){
    if(!it)return 'song';
    if(it._kefeLocalUpload)return 'local';
    if(it._kefeArtist)return 'artist';
    return it.wrapperType==='collection'||it.collectionType==='Album'&&!it.trackName?'album':'song';
  }
  function titleOf(it){
    var k=kindOf(it);
    if(k==='artist')return it.artistName||'Unknown artist';
    return k==='album'?(it.collectionName||'Untitled album'):(it.trackName||it.fileName||'Untitled');
  }

  /* Generated cover for uploads and artwork that fails to load. */
  function hash(str){var h=2166136261;for(var i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
  function fallbackArt(label,seed){
    var h=hash(String(label)+'|'+String(seed||'')),h1=h%360,h2=(h1+40+(h>>8)%80)%360;
    var svg='<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">'+
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl('+h1+',45%,34%)"/><stop offset="1" stop-color="hsl('+h2+',50%,16%)"/></linearGradient></defs>'+
      '<rect width="400" height="400" fill="url(#g)"/>'+
      '<circle cx="200" cy="200" r="140" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="2"/>'+
      '<circle cx="200" cy="200" r="80" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="2"/>'+
      '<path d="M222 120v108a30 30 0 1 1-14-25V146l-58 14v82a30 30 0 1 1-14-25V136z" fill="rgba(255,255,255,.82)" transform="translate(30 10) scale(.85)"/></svg>';
    return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
  }
  function coverFor(it){
    if(it._kefeLocalUpload||!it.artworkUrl100)return fallbackArt(it.fileName||it.trackName||'upload',it.artistName);
    return art(it.artworkUrl100,400);
  }

  /* ── layout ── */
  function restructure(){
    var panel=document.querySelector('[data-panel-view="media"]'),form=panel&&panel.querySelector('.kefe-form');
    if(!form||form.classList.contains('kefe-media-steps'))return false;
    var zone=$('kefeUploadZone'),track=$('kefeMediaTrack'),sugg=$('kefeSuggestions'),bg=$('kefeBgVideoZone');
    var bgWrap=bg&&bg.parentNode,fields=['songTitle','songArtist','songAlbum','songYear'].map(function(id){return $(id)&&$(id).parentNode;}).filter(Boolean);
    var empty=form.querySelector('.kefe-empty-panel');
    form.classList.add('kefe-media-steps');

    function step(title,hint){
      var s=mk('section','kefe-step');
      s.innerHTML='<header class="kefe-step-head"><div><h3>'+title+'</h3><p>'+hint+'</p></div></header>';
      var body=mk('div','kefe-step-body');s.appendChild(body);s.body=body;return s;
    }
    var s2=step('Find your song','Upload audio or video, then confirm KEFE’s identification of that file.');
    s2.classList.add('kefe-find-step');

    var details=mk('div','kefe-song-details');
    if(track){track.classList.add('kefe-song-details-track');details.appendChild(track);}
    var grid=mk('div','kefe-details-grid');fields.forEach(function(f){grid.appendChild(f);});
    details.appendChild(grid);

    var uploads=mk('div','kefe-media-upload-row');
    if(zone){zone.classList.add('kefe-audio-upload-card');uploads.appendChild(zone);}
    if(bgWrap){bgWrap.classList.add('kefe-background-upload-card');uploads.appendChild(bgWrap);}
    s2.body.appendChild(uploads);
    if(sugg)s2.body.appendChild(sugg);
    s2.body.appendChild(buildSearch());
    s2.body.appendChild(details);

    if(sugg)sugg.hidden=true;
    if(empty)empty.remove();
    form.innerHTML='';
    form.appendChild(s2);
    return true;
  }

  function buildSearch(){
    var w=mk('div','kefe-find');
    w.innerHTML=
      '<div class="kefe-find-status" id="kefeFindStatus" aria-live="polite">Upload audio to identify its song. Matching results will appear here for confirmation.</div>'+
      '<div class="kefe-result-card" id="kefeResultCard">'+
        '<div class="kefe-carousel ks-shelf" id="kefeCarousel" tabindex="0" role="group" aria-roledescription="carousel" aria-label="Uploaded audio identification matches">'+
          '<div class="kefe-car-empty" id="kefeCarEmpty"><div class="kefe-car-empty-icon"><span data-kefe-icon="music" aria-hidden="true"></span></div><span>Upload audio to identify its song</span></div>'+
          '<div class="ks-stage" id="kefeCarStack"></div>'+
          '<button type="button" class="kefe-car-nav prev" id="kefeCarPrev" aria-label="Previous match"><span data-kefe-icon="chevron-left" aria-hidden="true"></span></button>'+
          '<button type="button" class="kefe-car-nav next" id="kefeCarNext" aria-label="Next match"><span data-kefe-icon="chevron-right" aria-hidden="true"></span></button>'+
          '<div class="kefe-car-count" id="kefeCarCount"></div>'+
        '</div>'+
        '<div class="kefe-car-info" id="kefeCarInfo" hidden>'+
          '<div class="kefe-car-info-copy"><span class="kefe-badge" id="kefeCarBadge">Match</span><h4 id="kefeCarTitle"></h4><p id="kefeCarArtist"></p><small id="kefeCarMeta"></small></div>'+
          '<div class="kefe-car-actions"><button type="button" class="kefe-btn" id="kefeCarBack" hidden>← Matches</button><button type="button" class="kefe-btn primary" id="kefeCarUse">Confirm identification</button></div>'+
        '</div>'+
      '</div>';
    return w;
  }

  function refs(){
    ['FindInput','FindClear','FindBox','FindFilters','FindStatus','Carousel','CarEmpty','CarStack','CarPrev','CarNext','CarCount','CarInfo','CarBadge','CarTitle','CarArtist','CarMeta','CarBack','CarUse'].forEach(function(k){el[k]=$('kefe'+k);});
  }

  /* ── data ── */
  function visible(){
    if(S.filter==='artist')return S.artists;
    if(S.filter==='all')return S.items;
    return S.items.filter(function(i){return S.filter==='song'?(kindOf(i)==='song'||kindOf(i)==='local'):kindOf(i)===S.filter;});
  }
  function status(msg,cls){el.FindStatus.textContent=msg;el.FindStatus.className='kefe-find-status'+(cls?' '+cls:'');}
  function busy(on){el.Carousel.classList.toggle('busy',on);}

  function normalise(value){
    return String(value||'').normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  }
  function relevance(item,query){
    var q=normalise(query),title=normalise(titleOf(item)),artist=normalise(item.artistName),album=normalise(item.collectionName);
    if(!q)return 0;
    var score=0,terms=q.split(/\s+/).filter(Boolean);
    if(title===q)score+=180;
    else if(title&&q.indexOf(title+' ')===0)score+=145;
    else if(title.indexOf(q)===0)score+=100;
    else if(title.indexOf(q)>=0)score+=65;
    if(artist===q)score+=65;
    else if(artist&&q.indexOf(artist)>=0)score+=55;
    else if(artist.indexOf(q)>=0)score+=25;
    if(album===q)score+=45;
    else if(album.indexOf(q)>=0)score+=20;
    var titleWords=title.split(/\s+/).filter(Boolean),artistWords=artist.split(/\s+/).filter(Boolean),albumWords=album.split(/\s+/).filter(Boolean);
    function coverage(words){return terms.length?terms.filter(function(term){return words.some(function(word){return word===term||word.indexOf(term)===0||term.indexOf(word)===0;});}).length/terms.length:0;}
    score+=coverage(titleWords)*75+coverage(artistWords)*60+coverage(albumWords)*18;
    if(kindOf(item)==='song')score+=12;
    return score;
  }
  function artistScore(item,query){
    var q=normalise(query),artist=normalise(item.artistName);
    if(!q||!artist)return 0;
    if(artist===q)return 100;
    if(artist.indexOf(q)===0)return 80;
    if(artist.indexOf(q)>=0)return 60;
    var terms=q.split(/\s+/).filter(Boolean);
    return terms.length?40*terms.filter(function(t){return artist.indexOf(t)>=0;}).length/terms.length:0;
  }
  async function itunes(query,entity,attribute,limit){
    var requests=COUNTRIES.map(async function(country){
      var controller=new AbortController(),timer=setTimeout(function(){controller.abort();},12000);
      try{
        var url='https://itunes.apple.com/search?term='+encodeURIComponent(query)+'&entity='+entity+(attribute?'&attribute='+attribute:'')+'&limit='+(limit||200)+'&country='+country;
        var response=await fetch(url,{signal:controller.signal,headers:{Accept:'application/json'}});
        if(!response.ok)throw new Error('HTTP '+response.status);
        var payload=await response.json();
        return Array.isArray(payload.results)?payload.results:[];
      }finally{clearTimeout(timer);}
    });
    var settled=await Promise.allSettled(requests),all=[],lastError=null;
    settled.forEach(function(result){
      if(result.status==='fulfilled')all=all.concat(result.value);else lastError=result.reason;
    });
    if(!all.length&&lastError)throw lastError;
    return all;
  }
  function dedupe(list,keyOf){
    var seen={},out=[];
    list.forEach(function(it){var k=keyOf(it);if(k==null||seen[k])return;seen[k]=1;out.push(it);});
    return out;
  }
  function pickCount(){
    var list=visible().filter(function(item){return !item._kefeLocalUpload;});
    return list.length;
  }
  async function search(q){
    q=q.trim();var token=++S.token;
    S.mode='search';el.CarBack.hidden=true;
    if(!q){S.items=S.localUpload?[S.localUpload]:[];S.artists=[];S.index=0;render();status(S.localUpload?'Uploaded file ready. Search for a matching track.':'Enter a song, artist or album name.');busy(false);return;}
    busy(true);status('Searching…','loading');
    try{
      var res=await Promise.allSettled([itunes(q,'song'),itunes(q,'album'),itunes(q,'album','artistTerm',60)]);
      if(token!==S.token)return;
      var songs=res[0].status==='fulfilled'?res[0].value:[],albums=res[1].status==='fulfilled'?res[1].value:[],byArtist=res[2].status==='fulfilled'?res[2].value:[];
      if(res[0].status==='rejected'&&res[1].status==='rejected')throw res[0].reason;
      var catalogue=songs.concat(albums).sort(function(a,b){return relevance(b,q)-relevance(a,q);});
      S.items=catalogue.concat(S.localUpload?[S.localUpload]:[]);
      S.artists=dedupe(byArtist.filter(function(a){return a.collectionName&&a.artworkUrl100&&artistScore(a,q)>0;}),function(a){return a.collectionId;})
        .map(function(a){return Object.assign({},a,{_kefeArtist:true});})
        .sort(function(a,b){return (artistScore(b,q)-artistScore(a,q))||String(b.releaseDate||'').localeCompare(String(a.releaseDate||''));});
      S.index=0;render();
      var count=pickCount();
      status(count?(count+' result'+(count===1?'':'s')):S.localUpload&&S.filter!=='album'&&S.filter!=='artist'?'No matching songs, artists or albums found. Your uploaded file is still available.':'No matching songs, artists or albums found.','');
    }catch(e){
      if(token!==S.token)return;
      S.items=S.localUpload?[S.localUpload]:[];S.artists=[];render();status('Search failed — check your connection.','error');
    }finally{if(token===S.token)busy(false);}
  }
  async function openAlbum(it){
    var token=++S.token;busy(true);status('Loading tracks…','loading');
    try{
      var r=await fetch('https://itunes.apple.com/lookup?id='+it.collectionId+'&entity=song&country=AU');
      var j=await r.json();
      if(token!==S.token)return;
      var tracks=(j.results||[]).filter(function(x){return x.wrapperType==='track'&&x.trackName;});
      if(!tracks.length)throw new Error('empty');
      S.mode='album';S.albumTitle=it.collectionName;S.filter='song';syncFilters();
      S.items=tracks;S.index=0;render();el.CarBack.hidden=false;
      status(it.collectionName+' — '+tracks.length+' tracks','');
    }catch(e){if(token===S.token)status('Couldn’t load that album.','error');}
    finally{if(token===S.token)busy(false);}
  }
  function backToResults(){search(el.FindInput.value);}

  /* ═══════════════════════════════════════════════════════════
     3D SHELF
     Real album artwork on square covers. The centred cover faces the viewer; the rest
     stand as angled spines that fan away in perspective. Only a small window of covers is
     mounted at a time, so large result sets stay light on mobile Safari.
     ═══════════════════════════════════════════════════════════ */
  var G={H:0,ws:0,d:0,gap:0,U:0,P:0,XS:[],ok:false};
  var V={pos:0,tiltX:0,tiltY:0,T:0,mx:0,my:0,inside:false,hover:-1,hit:null,dragging:false,dragActive:false,dragX:0,T0:0,moved:false,raf:0,last:0,list:[],tapes:{}};
  var reduceMotion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var WINDOW=7;

  function mod(a,n){return ((a%n)+n)%n;}
  function smoothstep(t){t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);}
  function clampIndex(i){return Math.max(0,Math.min(V.list.length-1,i));}

  function measure(){
    var r=el.Carousel.getBoundingClientRect();
    if(r.width<40||r.height<40){G.ok=false;return false;}
    var H=Math.max(64,Math.min(r.height*.76,r.width*.72));
    G.H=H;G.ws=H*.2;G.d=H;G.gap=H*.04;G.U=H*1.25;G.P=H*3.2;
    G.XS=[];
    var acc=0;
    for(var u=0;u<=G.U*3;u+=2){G.XS.push(acc);acc+=2/(1+Math.pow(u/G.U,1.6));}
    G.XS.push(acc);
    el.Carousel.style.perspective=G.P+'px';
    el.Carousel.style.setProperty('--ks-H',H+'px');
    el.Carousel.style.setProperty('--ks-ws',G.ws+'px');
    el.Carousel.style.setProperty('--ks-d',G.d+'px');
    G.ok=true;return true;
  }
  function xsc(u){
    var sign=Math.sign(u),au=Math.abs(u),idx=au/2,i=Math.floor(idx),frac=idx-i;
    if(i>=G.XS.length-1)return sign*G.XS[G.XS.length-1];
    return sign*(G.XS[i]+(G.XS[i+1]-G.XS[i])*frac);
  }
  function scl(u){return 1/(1+Math.pow(Math.abs(u)/G.U,1.6));}
  function F(r){
    var B=Math.abs(r)<1?(r+Math.sin(Math.PI*r)/Math.PI)/2:Math.sign(r)*.5;
    return r*(G.ws+G.gap)+(G.d-G.ws+1.4*G.gap)*B;
  }

  function makeTape(i){
    var it=V.list[i],e=mk('div','ks-tape'),sp=mk('div','ks-face ks-sp'),cv=mk('div','ks-face ks-cv');
    var s1=mk('div','ks-shade'),s2=mk('div','ks-shade');
    sp.appendChild(s1);cv.appendChild(s2);e.appendChild(sp);e.appendChild(cv);
    function setArt(url){var css='url("'+url.replace(/"/g,'%22')+'")';sp.style.backgroundImage=css;cv.style.backgroundImage=css;}
    var url=coverFor(it);setArt(url);
    if(url.indexOf('data:')!==0){
      var img=new Image();
      img.onerror=function(){setArt(fallbackArt(titleOf(it),it.artistName));};
      img.src=url;
    }
    el.CarStack.appendChild(e);
    var t={i:i,el:e,sp:sp,cv:cv,s1:s1,s2:s2,lift:0,shown:true};
    V.tapes[i]=t;return t;
  }
  function unmountAll(){
    el.CarStack.innerHTML='';V.tapes={};V.hover=-1;V.hit=null;
  }
  function syncWindow(){
    var n=V.list.length;
    if(!n)return;
    var lo=Math.max(0,Math.floor(V.pos)-WINDOW),hi=Math.min(n-1,Math.ceil(V.pos)+WINDOW);
    Object.keys(V.tapes).forEach(function(k){
      var i=Number(k);
      if(i<lo||i>hi){V.tapes[k].el.remove();delete V.tapes[k];}
    });
    for(var i=lo;i<=hi;i++)if(!V.tapes[i])makeTape(i);
  }

  function hitTest(x,y){
    if(!V.inside||!V.list.length)return null;
    var settled=Math.abs(S.index-V.pos)<.3,active=V.tapes[Math.round(V.pos)];
    if(active&&settled){
      var cr=active.cv.getBoundingClientRect();
      if(x>cr.left&&x<cr.right&&y>cr.top&&y<cr.bottom)return{type:'cover',index:active.i};
    }
    var best=null,bestAbs=1e9;
    Object.keys(V.tapes).forEach(function(k){
      var t=V.tapes[k];if(!t.shown)return;
      var ar=Math.abs(t.i-V.pos);
      if(ar<.5||ar>=bestAbs)return;
      var rc=t.sp.getBoundingClientRect();
      if(rc.width>0&&x>rc.left&&x<rc.right&&y>rc.top&&y<rc.bottom){best={type:'spine',index:t.i};bestAbs=ar;}
    });
    return best;
  }

  /* One animation step. Returns true while anything is still moving. */
  function step(dt){
    if(!G.ok&&!measure())return false;
    var n=V.list.length;
    if(!n)return false;
    var target=V.dragging?V.T:S.index;
    var k=reduceMotion?60:(V.dragging?18:5.2);
    V.pos+=(target-V.pos)*(1-Math.exp(-k*dt));
    if(Math.abs(target-V.pos)<.0006)V.pos=target;
    syncWindow();

    var rect=el.Carousel.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
    var settled=Math.abs(S.index-V.pos)<.3&&!V.dragging;
    var onCover=V.inside&&settled&&Math.abs(V.mx-cx)<G.d*.55&&Math.abs(V.my-cy)<G.H*.55;
    var tY=onCover&&!reduceMotion?((V.mx-cx)/(G.d*.55))*7:0,tX=onCover&&!reduceMotion?-((V.my-cy)/(G.H/2))*4:0;
    V.tiltY+=(tY-V.tiltY)*(1-Math.exp(-7*dt));
    V.tiltX+=(tX-V.tiltX)*(1-Math.exp(-7*dt));

    var moving=Math.abs(target-V.pos)>=.0006,liftBusy=false;
    Object.keys(V.tapes).forEach(function(key){
      var t=V.tapes[key],r=t.i-V.pos,u=F(r);
      if(Math.abs(u)>G.U*1.95){if(t.shown){t.el.style.display='none';t.shown=false;}return;}
      if(!t.shown){t.el.style.display='';t.shown=true;}
      var sc=scl(u),kk=1/sc,o=smoothstep(Math.max(0,1-Math.abs(r)));
      var z=G.P*(1-kk)+o*G.H*.1,x=xsc(u)*kk,y=(G.H*.5*(1-sc)*.42+o*G.H*.012-t.lift*G.H*.05)*kk;
      var rotY=Math.sign(u)*Math.min(1,Math.abs(u)/G.U)*26*(1-o)-90*o+V.tiltY*o,rotX=V.tiltX*o;
      t.el.style.transform='translate3d('+x+'px,'+y+'px,'+z+'px) rotateX('+rotX+'deg) rotateY('+rotY+'deg)';
      t.el.style.zIndex=Math.round(3000+z);
      t.s1.style.opacity=Math.min(.6,o*.55+(1-sc)*.32);
      t.s2.style.opacity=(1-o)*.82;
      var want=(t.i===V.hover&&Math.abs(r)>=.5)?1:0;
      t.lift+=(want-t.lift)*(1-Math.exp(-12*dt));
      if(Math.abs(want-t.lift)>.01)liftBusy=true;
    });

    V.hit=hitTest(V.mx,V.my);
    V.hover=V.hit&&V.hit.type==='spine'?V.hit.index:-1;
    el.Carousel.style.cursor=V.dragging?'grabbing':(V.hit?'pointer':'');

    var tiltBusy=Math.abs(V.tiltX-tX)>.02||Math.abs(V.tiltY-tY)>.02;
    return moving||liftBusy||tiltBusy||V.inside;
  }
  function frame(now){
    V.raf=0;
    var dt=Math.min(.05,(now-V.last)/1000);V.last=now;
    if(step(dt))V.raf=requestAnimationFrame(frame);
  }
  function kick(){
    if(V.raf)return;
    V.last=performance.now();V.raf=requestAnimationFrame(frame);
  }

  /* ── render / navigation ── */
  function render(){
    V.list=visible();
    unmountAll();
    var n=V.list.length;
    el.CarEmpty.style.display=n?'none':'flex';
    el.Carousel.classList.toggle('has-items',n>0);
    if(S.index>=n)S.index=Math.max(0,n-1);
    V.pos=S.index;V.dragging=false;V.tiltX=V.tiltY=0;
    if(n){
      measure();
      syncWindow();
      step(.0001);
      if(el.CarStack.animate&&!reduceMotion)el.CarStack.animate([{opacity:0},{opacity:1}],{duration:380,easing:'ease-out'});
      kick();
    }
    info();
  }
  function info(){
    var list=V.list,it=list[S.index];
    el.CarInfo.hidden=!it;
    el.CarCount.textContent=it?(String(S.index+1).padStart(2,'0')+' / '+String(list.length).padStart(2,'0')):'';
    el.CarPrev.disabled=!it||S.index<=0;el.CarNext.disabled=!it||S.index>=list.length-1;
    if(!it){el.Carousel.setAttribute('aria-label','Search results carousel');return;}
    var k=kindOf(it);
    el.CarBadge.textContent=k==='local'?'Uploaded file':k==='song'?'Song':k==='artist'?'Artist':'Album';
    el.CarBadge.className='kefe-badge '+(k==='local'?'song':k==='artist'?'album':k);
    el.CarTitle.textContent=titleOf(it);
    el.CarArtist.textContent=it.artistName||'';
    var year=it.releaseDate?String(it.releaseDate).slice(0,4):'',bits=[year,it.primaryGenreName,it.collectionName].filter(Boolean);
    el.CarMeta.textContent=bits.join(' · ');
    el.CarUse.textContent='Confirm identification';
    el.Carousel.setAttribute('aria-label','Search results carousel: '+titleOf(it)+(it.artistName&&k!=='artist'?' by '+it.artistName:'')+', '+(S.index+1)+' of '+list.length);
  }
  function go(i){
    if(!V.list.length)return;
    var next=clampIndex(i);
    if(next===S.index){kick();return;}
    S.index=next;V.dragging=false;info();kick();
  }
  function activate(){
    var it=V.list[S.index];if(!it||kindOf(it)!=='song')return;
    if(typeof window.kefeConfirmTrackIdentification!=='function')return;
    el.CarUse.disabled=true;
    Promise.resolve(window.kefeConfirmTrackIdentification(it)).then(function(confirmed){
      status(confirmed?'Uploaded audio identification confirmed.':'This result could not be confirmed against the uploaded audio.','');
    }).catch(function(error){
      console.warn('[KEFE track confirmation]',error);
      status('Could not confirm this track identification.','error');
    }).finally(function(){el.CarUse.disabled=false;});
  }
  function syncFilters(){[].forEach.call(el.FindFilters.children,function(b){b.classList.toggle('active',b.dataset.f===S.filter);});}

  /* ── events ── */
  function bind(){
    el.CarPrev.addEventListener('click',function(){go(S.index-1);});
    el.CarNext.addEventListener('click',function(){go(S.index+1);});
    el.CarUse.addEventListener('click',activate);
    el.CarBack.addEventListener('click',backToResults);
    el.Carousel.addEventListener('keydown',function(e){
      if(e.key==='ArrowRight'){e.preventDefault();go(S.index+1);}
      else if(e.key==='ArrowLeft'){e.preventDefault();go(S.index-1);}
      else if(e.key==='Home'){e.preventDefault();go(0);}
      else if(e.key==='End'){e.preventDefault();go(V.list.length-1);}
      else if(e.key==='Enter'){e.preventDefault();activate();}
    });

    /* pointer: hover tilt, drag to scrub, click cover to use, click spine to jump */
    el.Carousel.addEventListener('pointerenter',function(e){V.inside=true;V.mx=e.clientX;V.my=e.clientY;kick();});
    el.Carousel.addEventListener('pointerleave',function(){if(V.dragActive)return;V.inside=false;V.hit=null;V.hover=-1;el.Carousel.style.cursor='';kick();});
    el.Carousel.addEventListener('pointermove',function(e){V.inside=true;V.mx=e.clientX;V.my=e.clientY;kick();});
    el.Carousel.addEventListener('pointerdown',function(e){
      if((e.pointerType==='mouse'&&e.button!==0)||e.target.closest('.kefe-car-nav')||!V.list.length)return;
      V.inside=true;V.mx=e.clientX;V.my=e.clientY;
      V.dragActive=true;V.moved=false;V.dragX=e.clientX;V.T0=S.index;V.T=S.index;
      try{el.Carousel.setPointerCapture(e.pointerId);}catch(_){}
      kick();
    });
    el.Carousel.addEventListener('pointermove',function(e){
      if(!V.dragActive)return;
      var dx=e.clientX-V.dragX;
      if(!V.moved&&Math.abs(dx)<=6)return;
      V.moved=true;V.dragging=true;
      V.T=Math.max(0,Math.min(V.list.length-1,V.T0-dx/(G.ws+G.gap)));
      var i=clampIndex(Math.round(V.T));
      if(i!==S.index){S.index=i;info();}
      kick();
    });
    function endPointer(e,cancelled){
      if(!V.dragActive)return;
      V.dragActive=false;
      try{el.Carousel.releasePointerCapture(e.pointerId);}catch(_){}
      var rc=el.Carousel.getBoundingClientRect();
      if(e.clientX<rc.left||e.clientX>rc.right||e.clientY<rc.top||e.clientY>rc.bottom){V.inside=false;}
      if(V.moved){
        V.dragging=false;S.index=clampIndex(Math.round(V.T));info();kick();
        return;
      }
      if(cancelled)return;
      V.mx=e.clientX;V.my=e.clientY;
      var h=hitTest(e.clientX,e.clientY);
      if(!h)return;
      if(h.type==='cover')activate();else go(h.index);
    }
    el.Carousel.addEventListener('pointerup',function(e){endPointer(e,false);});
    el.Carousel.addEventListener('pointercancel',function(e){endPointer(e,true);});

    /* horizontal scroll / trackpad swipe moves the shelf; vertical scroll still scrolls the panel */
    var wheelAcc=0,wheelTimer=0;
    el.Carousel.addEventListener('wheel',function(e){
      var dx=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:(e.shiftKey?e.deltaY:0);
      if(!dx||!V.list.length)return;
      e.preventDefault();
      wheelAcc+=dx;
      clearTimeout(wheelTimer);wheelTimer=setTimeout(function(){wheelAcc=0;},160);
      if(Math.abs(wheelAcc)>=40){go(S.index+(wheelAcc>0?1:-1));wheelAcc=0;}
    },{passive:false});

    if(window.ResizeObserver){
      new ResizeObserver(function(){G.ok=false;if(V.list.length){measure();kick();}}).observe(el.Carousel);
    }else{
      window.addEventListener('resize',function(){G.ok=false;if(V.list.length){measure();kick();}});
    }
  }

  function setLocalUpload(item,reset){
    S.localUpload=item?Object.assign({},item,{_kefeLocalUpload:true}):null;
    if(!el.CarStack)return;
    var catalogue=S.items.filter(function(existing){return !existing._kefeLocalUpload;});
    if(reset){
      S.items=[];S.artists=[];S.mode='matches';S.filter='song';S.index=0;el.CarBack.hidden=true;
    }else{
      S.items=catalogue.concat(S.localUpload?[S.localUpload]:[]);
      if(S.index>=S.items.length)S.index=0;
    }
    render();
    if(reset)status(S.localUpload?'Audio uploaded. Identifying its song…':'Upload audio to identify its song.','');
  }

  /* Called by the editor when an uploaded file is identified (or the song fields are searched). */
  function showMatches(items,msg){
    if(!el.CarStack)return;
    /* Only the upload identification pipeline may populate this confirmation carousel. */
    S.token++;
    clearTimeout(S.timer);
    S.mode='matches';S.filter='song';S.artists=[];el.CarBack.hidden=true;
    S.items=(items||[]).filter(function(item){return item&&!item._kefeLocalUpload&&kindOf(item)==='song';});
    S.index=0;render();
    status(msg||(S.items.length?'Confirm the song that matches your uploaded audio.':'No confident song matches were found for this upload.'),'');
    busy(false);
    if(S.items.length)el.Carousel.scrollIntoView({block:'nearest',behavior:'smooth'});
  }

  function init(){
    if(!restructure())return;
    refs();bind();
    window.kefeCarousel={showMatches:showMatches,setLocalUpload:setLocalUpload};
    if(S.localUpload)setLocalUpload(S.localUpload,true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
