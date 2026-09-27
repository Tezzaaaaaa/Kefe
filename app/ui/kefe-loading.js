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
      '.kefe-official-loader{position:relative;display:flex;align-items:center;justify-content:center;width:var(--kefe-loader-size,112px);height:var(--kefe-loader-size,112px);pointer-events:none;user-select:none}',
      '.kefe-official-loader__matrix{width:100%;height:100%;display:block;overflow:visible}',
      '.kefe-official-loader__text{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text","Helvetica Neue",Arial,sans-serif;font-size:15px;font-weight:500;letter-spacing:-.015em;line-height:1.4;color:#85899a;white-space:nowrap;will-change:opacity}',
      '.kefe-official-loader--compact{--kefe-loader-size:88px}',
      '.kefe-official-loader--compact .kefe-official-loader__text{font-size:13px}',
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
    text.textContent=options.text||'Loading…';
    root.appendChild(text);

    var svg=document.createElementNS(NS,'svg');
    svg.setAttribute('viewBox','0 0 120 120');
    svg.setAttribute('xmlns',NS);
    svg.setAttribute('aria-hidden','true');
    host.appendChild(svg);

    var defs=document.createElementNS(NS,'defs');
    var gradient=document.createElementNS(NS,'linearGradient');
    var gradientId='kefe-loader-gradient-'+Math.random().toString(36).slice(2);
    gradient.setAttribute('id',gradientId);
    gradient.setAttribute('x1','0%');
    gradient.setAttribute('y1','0%');
    gradient.setAttribute('x2','100%');
    gradient.setAttribute('y2','0%');

    [
      ['0%','#1D97F1'],
      ['34%','#1767AF'],
      ['62%','#16C9C6'],
      ['82%','#11EDAA'],
      ['100%','#0D986F']
    ].forEach(function(stop){
      var node=document.createElementNS(NS,'stop');
      node.setAttribute('offset',stop[0]);
      node.setAttribute('stop-color',stop[1]);
      gradient.appendChild(node);
    });

    var glow=document.createElementNS(NS,'filter');
    var glowId=gradientId+'-glow';
    glow.setAttribute('id',glowId);
    glow.setAttribute('x','-50%');
    glow.setAttribute('y','-50%');
    glow.setAttribute('width','200%');
    glow.setAttribute('height','200%');

    var blur=document.createElementNS(NS,'feGaussianBlur');
    blur.setAttribute('stdDeviation','3.2');
    blur.setAttribute('result','blur');
    glow.appendChild(blur);

    var merge=document.createElementNS(NS,'feMerge');
    var blurNode=document.createElementNS(NS,'feMergeNode');
    blurNode.setAttribute('in','blur');
    var sourceNode=document.createElementNS(NS,'feMergeNode');
    sourceNode.setAttribute('in','SourceGraphic');
    merge.appendChild(blurNode);
    merge.appendChild(sourceNode);
    glow.appendChild(merge);

    defs.appendChild(gradient);
    defs.appendChild(glow);
    svg.appendChild(defs);

    var ring=document.createElementNS(NS,'circle');
    ring.setAttribute('cx','60');
    ring.setAttribute('cy','60');
    ring.setAttribute('r','45');
    ring.setAttribute('fill','none');
    ring.setAttribute('stroke','#303343');
    ring.setAttribute('stroke-width','7');
    ring.setAttribute('opacity','.72');
    svg.appendChild(ring);

    var arc=document.createElementNS(NS,'circle');
    arc.setAttribute('cx','60');
    arc.setAttribute('cy','60');
    arc.setAttribute('r','45');
    arc.setAttribute('fill','none');
    arc.setAttribute('stroke','url(#'+gradientId+')');
    arc.setAttribute('stroke-width','7');
    arc.setAttribute('stroke-linecap','round');
    arc.setAttribute('stroke-dasharray','210 73');
    arc.setAttribute('stroke-dashoffset','0');
    arc.setAttribute('filter','url(#'+glowId+')');
    svg.appendChild(arc);

    var highlight=document.createElementNS(NS,'circle');
    highlight.setAttribute('cx','60');
    highlight.setAttribute('cy','15');
    highlight.setAttribute('r','2.4');
    highlight.setAttribute('fill','#58eaff');
    highlight.setAttribute('opacity','.95');
    svg.appendChild(highlight);

    var sparkles=[];
    for(var s=0;s<4;s++){
      var sparkle=document.createElementNS(NS,'circle');
      sparkle.setAttribute('r',s%2===0?'1.2':'.8');
      sparkle.setAttribute('fill',s%2===0?'#16C9C6':'#1D97F1');
      sparkle.setAttribute('opacity','0');
      svg.appendChild(sparkle);
      sparkles.push(sparkle);
    }

    root.__kefeLoader={arc:arc,highlight:highlight,sparkles:sparkles};
    return {
      root:root,
      text:text,
      start:performance.now(),
      destroyed:false,
      setText:function(value){ text.textContent=String(value==null?'':value); },
      destroy:function(){ this.destroyed=true; if(root.parentNode) root.parentNode.removeChild(root); }
    };
  }

  function animate(now){
    var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    for(var n=loaderInstances.length-1;n>=0;n--){
      var inst=loaderInstances[n];
      if(inst.destroyed){ loaderInstances.splice(n,1); continue; }

      var elapsed=(now-inst.start)/1000;
      if(reduce){
        inst.text.style.opacity='.65';
        inst.text.style.backgroundPosition='center';
        if(inst.root.__kefeLoader){
          inst.root.__kefeLoader.arc.style.strokeDashoffset='0';
          inst.root.__kefeLoader.highlight.style.opacity='.65';
        }
        continue;
      }

      inst.text.style.opacity=.48+.52*((Math.sin(elapsed*2.6)+1)/2);
      inst.text.style.backgroundPosition=((elapsed*28)%200)+'% center';

      var parts=inst.root.__kefeLoader;
      if(!parts) continue;

      var rotation=elapsed*42;
      parts.arc.style.transformOrigin='60px 60px';
      parts.arc.style.transform='rotate('+rotation+'deg)';
      parts.highlight.style.transformOrigin='60px 60px';
      parts.highlight.style.transform='rotate('+rotation+'deg)';

      var pulse=(Math.sin(elapsed*5)+1)/2;
      parts.arc.style.opacity=.84+.16*pulse;

      for(var i=0;i<parts.sparkles.length;i++){
        var sparkle=parts.sparkles[i];
        var angle=(rotation-28-i*7)*Math.PI/180;
        var radius=49+i%2*3;
        sparkle.setAttribute('cx',60+Math.cos(angle)*radius);
        sparkle.setAttribute('cy',60+Math.sin(angle)*radius);
        var life=(Math.sin(elapsed*4.5+i*1.7)+1)/2;
        sparkle.setAttribute('opacity',life>.62?(life-.62)*2.6:0);
      }
    }
    requestAnimationFrame(animate);
  }


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