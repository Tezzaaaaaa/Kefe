/* KEFE — Media panel: search + album carousel.
   Re-organises the Media panel into clear steps and adds a 3D cover carousel:
     1. Upload  – audio/video file, identified track, optional background video
     2. Find    – search songs & albums (iTunes), browse as a carousel, pick one (albums open their track list)
     3. Details – the editable song fields
   Picking a song goes through the same path as the old suggestion list (window.kefeApplyTrack). */
(function(){
  'use strict';
  var COUNTRIES=['AU','US'];
  var S={items:[],filter:'all',index:0,mode:'search',albumTitle:'',token:0,drag:null,timer:0};
  var el={};

  function $(id){return document.getElementById(id);}
  function mk(tag,cls,html){var e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e;}
  function esc(s){var d=document.createElement('div');d.textContent=s==null?'':String(s);return d.innerHTML;}
  function art(url,size){return String(url||'').replace(/\/\d+x\d+(bb)?\.(jpg|jpeg|png)$/i,'/'+(size||300)+'x'+(size||300)+'bb.$2');}
  function kindOf(it){return it.wrapperType==='collection'||it.collectionType==='Album'&&!it.trackName?'album':'song';}
  function titleOf(it){return kindOf(it)==='album'?(it.collectionName||'Untitled album'):(it.trackName||'Untitled');}

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
    var s2=step(1,'Find your song','Upload audio or video, search for the correct track, then review its details.');
    s2.classList.add('kefe-find-step');

    var uploads=mk('div','kefe-media-upload-row');
    if(zone)uploads.appendChild(zone);
    if(bgWrap)uploads.appendChild(bgWrap);
    s2.body.appendChild(uploads);
    if(track)s2.body.appendChild(track);
    if(sugg)s2.body.appendChild(sugg);
    s2.body.appendChild(buildSearch());

    var details=mk('section','kefe-song-details');
    details.innerHTML='<header class="kefe-song-details-head"><h4>Song details</h4><p>Review or edit the track information.</p></header>';
    var grid=mk('div','kefe-details-grid');fields.forEach(function(f){grid.appendChild(f);});
    details.appendChild(grid);
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
  function visible(){return S.filter==='all'?S.items:S.items.filter(function(i){return kindOf(i)===S.filter;});}
  function status(msg,cls){el.FindStatus.textContent=msg;el.FindStatus.className='kefe-find-status'+(cls?' '+cls:'');}
  function busy(on){el.FindBox.classList.toggle('busy',on);el.Carousel.classList.toggle('busy',on);}

  async function itunes(query,entity){
    var last=null,all=[];
    for(var i=0;i<COUNTRIES.length;i++){
      var c=new AbortController(),t=setTimeout(function(){c.abort();},9000);
      try{
        var r=await fetch('https://itunes.apple.com/search?term='+encodeURIComponent(query)+'&entity='+entity+'&limit=50&country='+COUNTRIES[i],{signal:c.signal});
        if(!r.ok)throw new Error('HTTP '+r.status);
        var j=await r.json();
        if(Array.isArray(j.results))all=all.concat(j.results);
      }catch(e){last=e;}finally{clearTimeout(t);}
    }
    if(all.length)return all;
    if(last)throw last;return [];
  }
  async function search(q){
    q=q.trim();var token=++S.token;
    S.mode='search';el.CarBack.hidden=true;
    if(!q){S.items=[];S.index=0;render();status('Type a song or album name.');busy(false);return;}
    busy(true);status('Searching…','loading');
    try{
      var res=await Promise.allSettled([itunes(q,'song'),itunes(q,'album')]);
      if(token!==S.token)return;
      var songs=res[0].status==='fulfilled'?res[0].value:[],albums=res[1].status==='fulfilled'?res[1].value:[];
      if(res[0].status==='rejected'&&res[1].status==='rejected')throw res[0].reason;
      var seen={};
      S.items=albums.concat(songs).filter(function(it){
        if(!it.artworkUrl100)return false;
        var k=kindOf(it)+'|'+titleOf(it)+'|'+it.artistName;if(seen[k])return false;seen[k]=1;return true;
      });
      S.index=0;render();
      status(S.items.length?(visible().length+' result'+(visible().length===1?'':'s')):'No results','');
    }catch(e){
      if(token!==S.token)return;
      S.items=[];render();status('Search failed — check your connection.','error');
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
    list.forEach(function(it,i){
      var k=kindOf(it),b=mk('button','kefe-car-card');b.type='button';b.dataset.i=i;
      b.setAttribute('aria-label',titleOf(it)+' by '+it.artistName);
      b.innerHTML='<span class="kefe-car-art"><img src="'+esc(art(it.artworkUrl100,300))+'" alt="" loading="lazy"><span class="kefe-car-tag '+k+'">'+k+'</span></span>'+
        '<span class="kefe-car-cap"><b>'+esc(titleOf(it))+'</b><i>'+esc(it.artistName)+'</i></span>';
      b.addEventListener('click',function(){if(S.moved)return;if(i===S.index)activate();else go(i);});
      el.CarStack.appendChild(b);
    });
    layout();
  }
  function layout(){
    var cards=el.CarStack.children,n=cards.length;
    for(var i=0;i<n;i++){
      var off=i-S.index,abs=Math.abs(off),vis=abs<=4,c=cards[i];
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
    el.CarBadge.textContent=k==='song'?'Song':'Album';el.CarBadge.className='kefe-badge '+k;
    el.CarTitle.textContent=titleOf(it);el.CarArtist.textContent=it.artistName||'';
    var year=it.releaseDate?String(it.releaseDate).slice(0,4):'',bits=[year,it.primaryGenreName,k==='song'?it.collectionName:(it.trackCount?it.trackCount+' tracks':'')].filter(Boolean);
    el.CarMeta.textContent=bits.join(' · ');
    el.CarUse.textContent=k==='song'?'Use this song':'Open album';
  }
  function go(i){var n=visible().length;S.index=Math.max(0,Math.min(n-1,i));layout();}
  function activate(){
    var it=visible()[S.index];if(!it)return;
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

  /* Called by the editor when an uploaded file is identified (or the song fields are searched). */
  function showMatches(items,msg,query){
    if(!el.CarStack)return;
    S.mode='search';S.filter='song';syncFilters();el.CarBack.hidden=true;
    if(query!=null){el.FindInput.value=query;el.FindBox.classList.toggle('has-text',!!query);}
    S.items=(items||[]).map(function(x){return x;});S.index=0;render();
    status(msg||(S.items.length?'Select the correct song':'No matches found'),'');
    busy(false);
    if(S.items.length)el.Carousel.scrollIntoView({block:'nearest',behavior:'smooth'});
  }

  function init(){
    if(!restructure())return;
    refs();bind();
    window.kefeCarousel={showMatches:showMatches,search:function(q){el.FindInput.value=q;el.FindBox.classList.toggle('has-text',!!q);return search(q);}};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
