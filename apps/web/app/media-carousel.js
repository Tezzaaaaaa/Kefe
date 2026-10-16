/* KEFE — Media panel: search + album carousel.
   Re-organises the Media panel into clear steps and adds a 3D cover carousel:
     1. Upload  – audio/video file, identified track, optional background video
     2. Find    – search songs & albums (iTunes), browse as a carousel, pick one (albums open their track list)
     3. Details – the editable song fields
   Picking a song goes through the same path as the old suggestion list (window.kefeApplyTrack). */
(function(){
  'use strict';
  var COUNTRIES=['AU','US'];
  var S={items:[],localUpload:null,filter:'all',index:0,mode:'search',albumTitle:'',token:0,drag:null,timer:0,renderStart:0,renderEnd:0};
  var el={};

  function $(id){return document.getElementById(id);}
  function mk(tag,cls,html){var e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e;}
  function esc(s){var d=document.createElement('div');d.textContent=s==null?'':String(s);return d.innerHTML;}
  function art(url,size){return String(url||'').replace(/\/\d+x\d+(bb)?\.(jpg|jpeg|png)$/i,'/'+(size||300)+'x'+(size||300)+'bb.$2');}
  function kindOf(it){return it&&it._kefeLocalUpload?'local':it.wrapperType==='collection'||it.collectionType==='Album'&&!it.trackName?'album':'song';}
  function titleOf(it){return kindOf(it)==='album'?(it.collectionName||'Untitled album'):(it.trackName||it.fileName||'Untitled');}

  /* ── layout ── */
  function restructure(){
    var panel=document.querySelector('[data-panel-view="media"]'),form=panel&&panel.querySelector('.kefe-form');
    if(!form||form.classList.contains('kefe-media-steps'))return false;
    var zone=$('kefeUploadZone'),track=$('kefeMediaTrack'),sugg=$('kefeSuggestions'),bg=$('kefeBgVideoZone');
    var bgWrap=bg&&bg.parentNode,fields=['songTitle','songArtist','songAlbum','songYear'].map(function(id){return $(id)&&$(id).parentNode;}).filter(Boolean);
    var empty=form.querySelector('.kefe-empty-panel');
    form.classList.add('kefe-media-steps');

    function step(n,title,hint){
      var s=mk('section','kefe-step');
      s.innerHTML='<header class="kefe-step-head"><span class="kefe-step-num">'+n+'</span><div><h3>'+title+'</h3><p>'+hint+'</p></div></header>';
      var body=mk('div','kefe-step-body');s.appendChild(body);s.body=body;return s;
    }
    var s2=step(1,'Find your song','Upload a file or search for a track.');
    s2.classList.add('kefe-find-step');

    var details=mk('div','kefe-song-details');
    var grid=mk('div','kefe-details-grid');fields.forEach(function(f){grid.appendChild(f);});
    details.appendChild(grid);

    var uploads=mk('div','kefe-media-upload-row');
    if(zone)uploads.appendChild(zone);
    if(bgWrap)uploads.appendChild(bgWrap);
    s2.body.appendChild(uploads);
    if(track)s2.body.appendChild(track);
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
      '<div class="kefe-find-bar">'+
        '<div class="kefe-search" id="kefeFindBox"><input type="text" id="kefeFindInput" placeholder="Search artists, albums, songs…" autocomplete="off" spellcheck="false" aria-label="Search songs and albums"><button type="button" class="kefe-search-clear" id="kefeFindClear" aria-label="Clear search">✕</button></div>'+
        '<div class="kefe-chips" id="kefeFindFilters" role="group" aria-label="Result type"><button type="button" class="kefe-chip active" data-f="all">All</button><button type="button" class="kefe-chip" data-f="song">Songs</button><button type="button" class="kefe-chip" data-f="album">Albums</button></div>'+
      '</div>'+
      '<div class="kefe-find-status" id="kefeFindStatus" aria-live="polite">Type a song or album name.</div>'+
      '<div class="kefe-carousel" id="kefeCarousel" tabindex="0" aria-label="Search results carousel">'+
        '<div class="kefe-car-empty" id="kefeCarEmpty"><div class="kefe-car-empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="12" cy="12" r="3.5"/><circle cx="12" cy="12" r=".8" fill="currentColor"/></svg></div><span>Results appear here</span></div>'+
        '<div class="kefe-car-stack" id="kefeCarStack"></div>'+
        '<button type="button" class="kefe-car-nav prev" id="kefeCarPrev" aria-label="Previous result">‹</button>'+
        '<button type="button" class="kefe-car-nav next" id="kefeCarNext" aria-label="Next result">›</button>'+
        '<div class="kefe-car-count" id="kefeCarCount"></div>'+
      '</div>'+
      '<div class="kefe-car-info" id="kefeCarInfo" hidden>'+
        '<div class="kefe-car-info-copy"><span class="kefe-badge" id="kefeCarBadge">Song</span><h4 id="kefeCarTitle"></h4><p id="kefeCarArtist"></p><small id="kefeCarMeta"></small></div>'+
        '<div class="kefe-car-actions"><button type="button" class="kefe-btn" id="kefeCarBack" hidden>← Results</button><button type="button" class="kefe-btn primary" id="kefeCarUse">Use this song</button></div>'+
      '</div>';
    return w;
  }

  function refs(){
    ['FindInput','FindClear','FindBox','FindFilters','FindStatus','Carousel','CarEmpty','CarStack','CarPrev','CarNext','CarCount','CarInfo','CarBadge','CarTitle','CarArtist','CarMeta','CarBack','CarUse'].forEach(function(k){el[k]=$('kefe'+k);});
  }

  /* ── data ── */
  function visible(){return S.filter==='all'?S.items:S.items.filter(function(i){return S.filter==='song'?(kindOf(i)==='song'||kindOf(i)==='local'):kindOf(i)===S.filter;});}
  function status(msg,cls){el.FindStatus.textContent=msg;el.FindStatus.className='kefe-find-status'+(cls?' '+cls:'');}
  function busy(on){el.FindBox.classList.toggle('busy',on);el.Carousel.classList.toggle('busy',on);}

  function normalise(value){
    return String(value||'').normalize('NFKD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
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
  async function itunes(query,entity){
    var requests=COUNTRIES.map(async function(country){
      var controller=new AbortController(),timer=setTimeout(function(){controller.abort();},12000);
      try{
        var url='https://itunes.apple.com/search?term='+encodeURIComponent(query)+'&entity='+entity+'&limit=200&country='+country;
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
  async function search(q){
    q=q.trim();var token=++S.token;
    S.mode='search';el.CarBack.hidden=true;
    if(!q){S.items=S.localUpload?[S.localUpload]:[];S.index=0;render();status(S.localUpload?'Uploaded file ready. Search for catalogue matches.':'Type a song or album name.');busy(false);return;}
    busy(true);status('Searching…','loading');
    try{
      var res=await Promise.allSettled([itunes(q,'song'),itunes(q,'album')]);
      if(token!==S.token)return;
      var songs=res[0].status==='fulfilled'?res[0].value:[],albums=res[1].status==='fulfilled'?res[1].value:[];
      if(res[0].status==='rejected'&&res[1].status==='rejected')throw res[0].reason;
      var catalogue=songs.concat(albums).sort(function(a,b){return relevance(b,q)-relevance(a,q);});
      S.items=catalogue.concat(S.localUpload?[S.localUpload]:[]);
      S.index=0;render();
      var count=visible().filter(function(item){return !item._kefeLocalUpload;}).length;
      status(count?(count+' result'+(count===1?'':'s')):S.localUpload&&S.filter!=='album'?'No catalogue matches. Your uploaded file is available below.':'No results','');
    }catch(e){
      if(token!==S.token)return;
      S.items=S.localUpload?[S.localUpload]:[];render();status('Search failed — check your connection.','error');
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

  /* ── render ── */
  function render(){
    var list=visible();el.CarStack.innerHTML='';
    el.CarEmpty.style.display=list.length?'none':'flex';
    el.Carousel.classList.toggle('has-items',list.length>0);
    if(S.index>=list.length)S.index=Math.max(0,list.length-1);
    /* Keep the full result set in memory, but only mount a small window of cards.
       iTunes can return hundreds of AU/US matches; mounting every artwork image
       at once can exhaust mobile Safari's rendering memory and reload the tab. */
    var start=Math.max(0,S.index-4),end=Math.min(list.length,start+9);
    start=Math.max(0,end-9);
    S.renderStart=start;S.renderEnd=end;
    for(var i=start;i<end;i++){
      var it=list[i],k=kindOf(it),b=mk('button','kefe-car-card');b.type='button';b.dataset.i=i;
      b.setAttribute('aria-label',titleOf(it)+' by '+it.artistName);
      var artwork=it._kefeLocalUpload?'<span class="kefe-car-local-icon" aria-hidden="true">♫</span>':'<img src="'+esc(art(it.artworkUrl100,300))+'" alt="" loading="lazy">';
      var tag=k==='local'?'Uploaded':k;
      b.innerHTML='<span class="kefe-car-art">'+artwork+'<span class="kefe-car-tag '+k+'">'+tag+'</span></span>'+
        '<span class="kefe-car-cap"><b>'+esc(titleOf(it))+'</b><i>'+esc(it.artistName||(it._kefeLocalUpload?'Local audio file':''))+'</i></span>';
      b.addEventListener('click',function(){var index=Number(this.dataset.i);if(S.moved)return;if(index===S.index)activate();else go(index);});
      el.CarStack.appendChild(b);
    }
    layout();
  }
  function layout(){
    var cards=el.CarStack.children,n=cards.length;
    for(var i=0;i<n;i++){
      var c=cards[i],cardIndex=Number(c.dataset.i),off=cardIndex-S.index,abs=Math.abs(off),vis=abs<=4;
      c.style.transform='translate3d('+(off*34)+'px,'+(abs*3)+'px,'+(-abs*38)+'px) rotateY('+(off*-6)+'deg) scale('+(1-abs*.05)+')';
      c.style.opacity=vis?Math.max(0,1-abs*.24):0;
      c.style.zIndex=50-abs;c.style.pointerEvents=vis?'auto':'none';
      c.style.filter=off===0?'none':'brightness('+Math.max(.72,1-abs*.08)+') saturate('+Math.max(.55,1-abs*.12)+')';
      c.tabIndex=off===0?0:-1;
      var cap=c.lastChild;if(cap)cap.style.opacity=off===0?'1':'0';
    }
    info();
  }
  function info(){
    var list=visible(),it=list[S.index];
    el.CarInfo.hidden=!it;
    el.CarCount.textContent=it?(String(S.index+1).padStart(2,'0')+' / '+String(list.length).padStart(2,'0')):'';
    el.CarPrev.disabled=!it||S.index<=0;el.CarNext.disabled=!it||S.index>=list.length-1;
    if(!it)return;
    var k=kindOf(it);
    el.CarBadge.textContent=k==='local'?'Uploaded file':k==='song'?'Song':'Album';el.CarBadge.className='kefe-badge '+(k==='local'?'song':k);
    el.CarTitle.textContent=titleOf(it);el.CarArtist.textContent=it.artistName||(k==='local'?'This file is already loaded':'');
    var year=it.releaseDate?String(it.releaseDate).slice(0,4):'',bits=k==='local'?[it.fileName||'Local audio file']:[year,it.primaryGenreName,k==='song'?it.collectionName:(it.trackCount?it.trackCount+' tracks':'')].filter(Boolean);
    el.CarMeta.textContent=bits.join(' · ');
    el.CarUse.textContent=k==='local'?'Confirm file metadata':k==='song'?'Confirm song':'Open album';
  }
  function go(i){
    var n=visible().length;S.index=Math.max(0,Math.min(n-1,i));
    if((S.renderStart>0&&S.index<S.renderStart+2)||S.index>=S.renderEnd-2)render();else layout();
  }
  function activate(){
    var it=visible()[S.index];if(!it)return;
    if(kindOf(it)==='local'){
      status('File metadata confirmed. Confirm the actual song in Song details or choose a catalogue match above.','');
      return;
    }
    if(kindOf(it)==='album'){openAlbum(it);return;}
    if(window.kefeApplyTrack){
      el.CarUse.disabled=true;
      Promise.resolve(window.kefeApplyTrack(it)).finally(function(){el.CarUse.disabled=false;});
      status('Selected “'+titleOf(it)+'”. Finding lyrics…','');
    }
  }
  function syncFilters(){[].forEach.call(el.FindFilters.children,function(b){b.classList.toggle('active',b.dataset.f===S.filter);});}

  /* ── events ── */
  function bind(){
    el.FindInput.addEventListener('input',function(){
      el.FindBox.classList.toggle('has-text',!!el.FindInput.value);
      clearTimeout(S.timer);S.timer=setTimeout(function(){search(el.FindInput.value);},380);
    });
    el.FindInput.addEventListener('keydown',function(e){
      if(e.key==='Enter'){clearTimeout(S.timer);search(el.FindInput.value);}
      if(e.key==='Escape'){el.FindClear.click();}
      if(e.key==='ArrowDown'){e.preventDefault();el.Carousel.focus();}
    });
    el.FindClear.addEventListener('click',function(){el.FindInput.value='';el.FindBox.classList.remove('has-text');clearTimeout(S.timer);search('');el.FindInput.focus();});
    el.FindFilters.addEventListener('click',function(e){
      var b=e.target.closest('[data-f]');if(!b)return;
      S.filter=b.dataset.f;syncFilters();S.index=0;render();
      var n=visible().length;status(S.items.length?(n+' result'+(n===1?'':'s')):el.FindStatus.textContent,'');
    });
    el.CarPrev.addEventListener('click',function(){go(S.index-1);});
    el.CarNext.addEventListener('click',function(){go(S.index+1);});
    el.CarUse.addEventListener('click',activate);
    el.CarBack.addEventListener('click',backToResults);
    el.Carousel.addEventListener('keydown',function(e){
      if(e.key==='ArrowRight'){e.preventDefault();go(S.index+1);}
      else if(e.key==='ArrowLeft'){e.preventDefault();go(S.index-1);}
      else if(e.key==='Enter'){e.preventDefault();activate();}
    });
    /* horizontal wheel/trackpad only – vertical scroll keeps scrolling the panel */
    var acc=0,cool=false;
    el.Carousel.addEventListener('wheel',function(e){
      if(Math.abs(e.deltaX)<=Math.abs(e.deltaY))return;
      e.preventDefault();if(cool)return;acc+=e.deltaX;
      if(Math.abs(acc)>50){go(S.index+(acc>0?1:-1));acc=0;cool=true;setTimeout(function(){cool=false;},170);}
    },{passive:false});
    /* drag / swipe */
    function down(x){S.drag=x;S.moved=false;}
    function move(x){if(S.drag!=null&&Math.abs(x-S.drag)>8)S.moved=true;}
    function up(x){
      if(S.drag==null)return;var dx=x-S.drag;S.drag=null;
      if(dx<-50)go(S.index+1);else if(dx>50)go(S.index-1);
      setTimeout(function(){S.moved=false;},30);
    }
    el.Carousel.addEventListener('mousedown',function(e){down(e.clientX);});
    window.addEventListener('mousemove',function(e){move(e.clientX);});
    window.addEventListener('mouseup',function(e){up(e.clientX);});
    el.Carousel.addEventListener('touchstart',function(e){if(e.touches.length)down(e.touches[0].clientX);},{passive:true});
    el.Carousel.addEventListener('touchmove',function(e){if(e.touches.length)move(e.touches[0].clientX);},{passive:true});
    el.Carousel.addEventListener('touchend',function(e){if(e.changedTouches.length)up(e.changedTouches[0].clientX);},{passive:true});
  }

  function setLocalUpload(item,reset){
    S.localUpload=item?Object.assign({},item,{_kefeLocalUpload:true}):null;
    if(!el.CarStack)return;
    var catalogue=S.items.filter(function(existing){return !existing._kefeLocalUpload;});
    if(reset){
      S.items=S.localUpload?[S.localUpload]:[];S.mode='search';S.filter='song';S.index=0;syncFilters();el.CarBack.hidden=true;
      if(S.localUpload){el.FindInput.value='';el.FindBox.classList.remove('has-text');}
    }else{
      S.items=catalogue.concat(S.localUpload?[S.localUpload]:[]);
      if(S.index>=S.items.length)S.index=0;
    }
    render();
    if(reset)status(S.localUpload?'Uploaded file ready. Search for catalogue matches.':'Type a song or album name.','');
  }

  /* Called by the editor when an uploaded file is identified (or the song fields are searched). */
  function showMatches(items,msg,query){
    if(!el.CarStack)return;
    S.mode='search';S.filter='song';syncFilters();el.CarBack.hidden=true;
    if(query!=null){el.FindInput.value=query;el.FindBox.classList.toggle('has-text',!!query);}
    var catalogue=(items||[]).filter(function(x){return !x._kefeLocalUpload;}).slice();
    S.items=catalogue.concat(S.localUpload?[S.localUpload]:[]);S.index=0;render();
    var displayMsg=msg;
    if(S.localUpload&&!(items||[]).length&&(!displayMsg||/no matches found/i.test(displayMsg)))displayMsg='No catalogue matches. Your uploaded file is available below.';
    status(displayMsg||(S.items.length?'Select the correct song':'No matches found'),'');
    busy(false);
    if(S.items.length)el.Carousel.scrollIntoView({block:'nearest',behavior:'smooth'});
  }

  function init(){
    if(!restructure())return;
    refs();bind();
    window.kefeCarousel={showMatches:showMatches,setLocalUpload:setLocalUpload,search:function(q){el.FindInput.value=q;el.FindBox.classList.toggle('has-text',!!q);return search(q);}};
    if(S.localUpload)setLocalUpload(S.localUpload,true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
