/* KEFE — official loading animation + time-remaining estimates.
   The loader is the shared KEFE loading treatment: a synchronized 5×5
   red matrix with a soft ripple, paired with a muted text shimmer.
   Existing progress/ETA behaviour is preserved. */
(function(){
  'use strict';
  if (window.__kefeLoading) return;
  window.__kefeLoading = true;

  var NS = 'http://www.w3.org/2000/svg';
  var loaderInstances = [];

  function injectStyles(){
    if (document.getElementById('kefe-official-loader-css')) return;
    var css = document.createElement('style');
    css.id = 'kefe-official-loader-css';
    css.textContent = [
      '.kefe-official-loader{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;pointer-events:none;user-select:none}',
      '.kefe-official-loader__matrix{width:var(--kefe-loader-size,84px);height:var(--kefe-loader-size,84px);display:block;filter:drop-shadow(0 4px 16px rgba(0,0,0,.55))}',
      '.kefe-official-loader__text{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text","Helvetica Neue",Arial,sans-serif;font-size:15px;font-weight:500;letter-spacing:-.015em;line-height:1.4;background:linear-gradient(90deg,#555 0%,#fff 50%,#555 100%);background-size:200% auto;color:transparent;-webkit-background-clip:text;background-clip:text;white-space:nowrap;will-change:opacity,background-position}',
      '.kefe-official-loader--compact{--kefe-loader-size:64px;gap:10px}',
      '.kefe-official-loader--compact .kefe-official-loader__text{font-size:14px}',
      '.kefe-caption-loader{margin:10px 0 4px}',
      '.kefe-export-loader{margin:4px auto 12px}',
      '#exportOverlay .kefe-export-loader + #exportStatus{margin-top:0}',
      '@media(prefers-reduced-motion:reduce){.kefe-official-loader__text{opacity:.65!important;background:none;color:currentColor;-webkit-background-clip:initial;background-clip:initial}}'
    ].join('\n');
    document.head.appendChild(css);
  }

  function createLoader(options){
    options=options||{};
    injectStyles();

    var root=document.createElement('div');
    root.className='kefe-official-loader'+(options.compact?' kefe-official-loader--compact':'');
    root.setAttribute('aria-hidden','true');

    var host=document.createElement('div');
    host.className='kefe-official-loader__matrix';
    root.appendChild(host);

    var text=document.createElement('div');
    text.className='kefe-official-loader__text';
    text.textContent=options.text||'Generating';
    root.appendChild(text);

    var svg=document.createElementNS(NS,'svg');
    svg.setAttribute('viewBox','0 0 100 100');
    svg.setAttribute('xmlns',NS);
    svg.setAttribute('aria-hidden','true');
    host.appendChild(svg);

    var dots=[];
    var COLS=5, ROWS=5, STEP=14, START_X=15, START_Y=15;
    var RED='#EF2B0F', SHADOW='#5e0a04';

    for(var row=0;row<ROWS;row++){
      for(var col=0;col<COLS;col++){
        var rect=document.createElementNS(NS,'rect');
        var x=START_X+col*STEP, y=START_Y+row*STEP;
        rect.setAttribute('rx','2');
        svg.appendChild(rect);
        dots.push({rect:rect,x:x,y:y,distance:Math.sqrt(Math.pow(col-2,2)+Math.pow(row-2,2))});
      }
    }

    var instance={
      root:root,
      text:text,
      start:performance.now(),
      destroyed:false,
      setText:function(value){ text.textContent=String(value==null?'':value); },
      destroy:function(){ this.destroyed=true; if(root.parentNode) root.parentNode.removeChild(root); }
    };
    loaderInstances.push(instance);
    return instance;
  }

  function animate(now){
    var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    for(var n=loaderInstances.length-1;n>=0;n--){
      var inst=loaderInstances[n];
      if(inst.destroyed){ loaderInstances.splice(n,1); continue; }

      var elapsed=(now-inst.start)/1000;
      var globalWave=(Math.sin(elapsed*4)+1)/2;

      if(reduce){
        inst.text.style.opacity='.65';
        inst.text.style.backgroundPosition='center';
      }else{
        inst.text.style.opacity=.25+.75*globalWave;
        inst.text.style.backgroundPosition=((elapsed*80)%200)+'% center';

        var dots=inst.root.querySelectorAll('rect');
        for(var i=0;i<dots.length;i++){
          var dot=inst.root.__kefeDots?inst.root.__kefeDots[i]:null;
          if(!dot) continue;
          var wave=Math.sin(elapsed*4-dot.distance*.8);
          var weight=(wave+1)/2;
          var size=2.2+(5.5-2.2)*weight;
          var cx=dot.x+STEP/2, cy=dot.y+STEP/2;
          dot.rect.setAttribute('x',cx-size);
          dot.rect.setAttribute('y',cy-size);
          dot.rect.setAttribute('width',size*2);
          dot.rect.setAttribute('height',size*2);
          dot.rect.setAttribute('fill',weight<.3?SHADOW:RED);
          dot.rect.setAttribute('opacity',.25+.75*weight);
        }
      }
    }
    requestAnimationFrame(animate);
  }

  // Attach the generated dot metadata after the animation loop is defined.
  var originalCreate=createLoader;
  createLoader=function(options){
    var inst=originalCreate(options);
    var rects=inst.root.querySelectorAll('rect');
    // Reconstruct the fixed grid metadata without keeping a second DOM system.
    var dots=[], COLS=5, ROWS=5, STEP=14, START_X=15, START_Y=15;
    for(var row=0;row<ROWS;row++){
      for(var col=0;col<COLS;col++){
        dots.push({rect:rects[row*COLS+col],x:START_X+col*STEP,y:START_Y+row*STEP,distance:Math.sqrt(Math.pow(col-2,2)+Math.pow(row-2,2))});
      }
    }
    inst.root.__kefeDots=dots;
    return inst;
  };

  window.KefeLoader={
    create:createLoader,
    show:function(container,options){
      var inst=createLoader(options);
      (container||document.body).appendChild(inst.root);
      return inst;
    },
    setText:function(newText){
      for(var i=0;i<loaderInstances.length;i++) loaderInstances[i].setText(newText);
    }
  };

  function fmt(seconds){
    if(!isFinite(seconds)||seconds<0) return '—';
    var s=Math.round(seconds);
    if(s<5) return 'a few seconds';
    if(s<60) return s+'s';
    var m=Math.floor(s/60), rem=s%60;
    return rem===0?m+'m':m+'m '+rem+'s';
  }

  function makeTracker(getProgress,isRunning){
    var samples=[],startTime=0,running=false,lastEstimate=null;
    function snapshot(p,now){
      var elapsed=(now-startTime)/1000;
      if(samples.length<2||p<=.01) return {elapsed:elapsed,remaining:null};
      var cutoff=now-10000,first=samples[0];
      for(var i=0;i<samples.length;i++){if(samples[i].t>=cutoff){first=samples[i];break;}}
      var dt=(now-first.t)/1000,dp=p-first.p;
      if(dt<1||dp<=.001) return {elapsed:elapsed,remaining:lastEstimate};
      var rate=dp/dt,remaining=(1-p)/rate;
      if(!isFinite(remaining)||remaining<0||remaining>3600) remaining=null;
      lastEstimate=remaining;
      return {elapsed:elapsed,remaining:remaining};
    }
    return {tick:function(){
      var now=performance.now(),nowRunning=isRunning();
      if(!nowRunning){if(running){samples=[];running=false;lastEstimate=null;}return null;}
      if(!running){running=true;startTime=now;samples=[];}
      var p=getProgress(); if(p==null||!isFinite(p)) return null;
      var last=samples[samples.length-1];
      if(!last||now-last.t>=400){samples.push({t:now,p:p});if(samples.length>120)samples.shift();}
      else last.p=p;
      return snapshot(p,now);
    }};
  }

  var capTracker=makeTracker(function(){
    var el=document.getElementById('captionGenProgress');
    if(!el||el.hidden)return null;
    var v=Number(el.value);return isFinite(v)?v/100:null;
  },function(){
    var el=document.getElementById('captionGenTimer');return Boolean(el&&!el.hidden);
  });

  var expTracker=makeTracker(function(){
    var el=document.getElementById('exportProgress');if(!el)return null;
    var v=Number(el.value);return isFinite(v)?v/100:null;
  },function(){
    var ov=document.getElementById('exportOverlay');return Boolean(ov&&!ov.classList.contains('hidden'));
  });

  var capLoader=null,expLoader=null;

  function ensureCaptionLoader(){
    var timer=document.getElementById('captionGenTimer');
    if(!timer||timer.hidden){
      if(capLoader) capLoader.destroy(),capLoader=null;
      return;
    }
    if(!capLoader){
      capLoader=createLoader({text:'Generating captions',compact:true});
      capLoader.root.classList.add('kefe-caption-loader');
      timer.insertBefore(capLoader.root,timer.firstChild);
    }
  }

  function ensureExportLoader(){
    var ov=document.getElementById('exportOverlay');
    if(!ov||ov.classList.contains('hidden')){
      if(expLoader) expLoader.destroy(),expLoader=null;
      return;
    }
    var content=ov.querySelector('.modal-content');
    if(!content)return;
    if(!expLoader){
      expLoader=createLoader({text:'Exporting',compact:false});
      expLoader.root.classList.add('kefe-export-loader');
      var status=document.getElementById('exportStatus');
      content.insertBefore(expLoader.root,status||content.firstChild);
    }
  }

  function updateCaption(){
    ensureCaptionLoader();
    var timer=document.getElementById('captionGenTimer');
    if(!timer||timer.hidden){
      var stale=document.getElementById('kefeCaptionEta');if(stale)stale.remove();
      return;
    }
    var snap=capTracker.tick();if(!snap)return;
    var eta=document.getElementById('kefeCaptionEta');
    if(!eta){
      eta=document.createElement('div');eta.id='kefeCaptionEta';
      eta.style.cssText='margin-top:6px;font-size:11px;color:var(--text-2);font-variant-numeric:tabular-nums';
      timer.appendChild(eta);
    }
    var msg='';
    if(snap.remaining!=null&&snap.remaining>2)msg='About '+fmt(snap.remaining)+' remaining';
    else if(snap.elapsed>4)msg='Estimating time…';
    eta.textContent=msg;
  }

  function updateExport(){
    ensureExportLoader();
    var ov=document.getElementById('exportOverlay');
    if(!ov||ov.classList.contains('hidden')){
      var stale=document.getElementById('kefeExportEta');if(stale)stale.remove();
      return;
    }
    var snap=expTracker.tick();if(!snap)return;
    var box=document.getElementById('kefeExportEta');
    if(!box){
      box=document.createElement('div');box.id='kefeExportEta';
      box.style.cssText='margin-top:8px;text-align:center;font-size:11.5px;color:var(--text-2);font-variant-numeric:tabular-nums';
      var content=ov.querySelector('.modal-content');if(content)content.appendChild(box);
    }
    var msg='Elapsed '+fmt(snap.elapsed);
    if(snap.remaining!=null&&snap.remaining>2)msg+=' · About '+fmt(snap.remaining)+' left';
    else if(snap.elapsed>4)msg+=' · Estimating time…';
    box.textContent=msg;
  }

  setInterval(function(){
    try{updateCaption();}catch(e){}
    try{updateExport();}catch(e){}
  },250);

  requestAnimationFrame(animate);
  console.log('[KEFE] official matrix loader active');
})();