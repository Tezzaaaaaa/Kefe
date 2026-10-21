/* KEFE Fluid Ink visualiser.
   A real-time 2D stable-fluid solver inspired by the fluid-dynamics approach in
   Pavel Dobryakov's MIT-licensed WebGL Fluid Simulation:
   https://github.com/PavelDoGreat/WebGL-Fluid-Simulation
   This implementation is purpose-built for KEFE's audio graph, preview and export APIs. */
(function(){
  'use strict';
  var canvas,ctx,simCanvas,simCtx,imageData,raf=0,start=performance.now(),lastTime=null;
  var analyser=null,freq=null,gridW=384,gridH=216,size=0;
  var u,v,u0,v0,p,div,dyeR,dyeG,dyeB,dyeR0,dyeG0,dyeB0;
  var preset='ink-bloom',paletteIndex=0;
  var palettes=[
    {name:'Aurora',c:['#06121e','#1d6570','#5de0bd','#c4ffb0','#9b7bff','#f4c9ff']},
    {name:'Ocean',c:['#020b20','#064a79','#087fbd','#28d6d0','#9cf7ed','#e9ffff']},
    {name:'Ember',c:['#16050b','#6d102b','#d52c43','#ff6b35','#ffc05b','#fff1b0']},
    {name:'Violet',c:['#10051d','#45156e','#8737c8','#d05be8','#ff9bd8','#ffe8fb']},
    {name:'Neon',c:['#030814','#173bff','#00c8ff','#00f5a0','#f5ff4b','#ff4ecb']},
    {name:'Mono',c:['#030303','#24242a','#50505a','#858591','#c7c7d0','#ffffff']}
  ];
  var presets={
    'ink-bloom':{label:'Ink Bloom',speed:1,swirl:1.3,react:1.7,density:.994,bloom:.7},
    vortex:{label:'Vortex',speed:1.25,swirl:2.3,react:1.5,density:.991,bloom:.85},
    marbling:{label:'Marbling',speed:.72,swirl:.8,react:1.2,density:.998,bloom:.35},
    'liquid-chrome':{label:'Liquid Chrome',speed:1.05,swirl:1.1,react:2,density:.993,bloom:1.1},
    'deep-ocean':{label:'Deep Ocean',speed:.62,swirl:1.5,react:1.4,density:.997,bloom:.5},
    kaleidoscope:{label:'Kaleidoscope',speed:1.45,swirl:2,react:2.4,density:.99,bloom:.75}
  };
  var values=Object.assign({},presets['ink-bloom'],{quality:1});
  var palettesRgb=[];
  function hexRgb(hex){var n=parseInt(hex.slice(1),16);return [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255];}
  palettes.forEach(function(pal){palettesRgb.push(pal.c.map(hexRgb));});
  function clamp(x,a,b){return Math.max(a,Math.min(b,x));}
  function idx(x,y){return x+(gridW+2)*y;}
  function allocate(){
    /* Keep the simulation dense enough for high-resolution preview and export.
       Resolution scales with the quality control, while the bounded grid prevents
       the CPU fluid solver from exploding in cost on large 4K output canvases. */
    gridW=clamp(Math.round(512*values.quality),320,768);
    gridH=clamp(Math.round(gridW*(canvas.height/Math.max(1,canvas.width))),120,432);
    size=(gridW+2)*(gridH+2);
    function field(){return new Float32Array(size);}
    u=field();v=field();u0=field();v0=field();p=field();div=field();
    dyeR=field();dyeG=field();dyeB=field();dyeR0=field();dyeG0=field();dyeB0=field();
    simCanvas.width=gridW;simCanvas.height=gridH;
    imageData=simCtx.createImageData(gridW,gridH);
    lastTime=null;
  }
  function boundary(b,x){
    for(var i=1;i<=gridW;i++){
      x[idx(i,0)]=b===2?-x[idx(i,1)]:x[idx(i,1)];
      x[idx(i,gridH+1)]=b===2?-x[idx(i,gridH)]:x[idx(i,gridH)];
    }
    for(var j=1;j<=gridH;j++){
      x[idx(0,j)]=b===1?-x[idx(1,j)]:x[idx(1,j)];
      x[idx(gridW+1,j)]=b===1?-x[idx(gridW,j)]:x[idx(gridW,j)];
    }
    x[idx(0,0)]=.5*(x[idx(1,0)]+x[idx(0,1)]);
    x[idx(0,gridH+1)]=.5*(x[idx(1,gridH+1)]+x[idx(0,gridH)]);
    x[idx(gridW+1,0)]=.5*(x[idx(gridW,0)]+x[idx(gridW+1,1)]);
    x[idx(gridW+1,gridH+1)]=.5*(x[idx(gridW,gridH+1)]+x[idx(gridW+1,gridH)]);
  }
  function linearSolve(b,x,x0,a,c){
    for(var k=0;k<6;k++){
      for(var y=1;y<=gridH;y++)for(var xPos=1;xPos<=gridW;xPos++){
        var n=idx(xPos,y);
        x[n]=(x0[n]+a*(x[idx(xPos-1,y)]+x[idx(xPos+1,y)]+x[idx(xPos,y-1)]+x[idx(xPos,y+1)]))/c;
      }
      boundary(b,x);
    }
  }
  function diffuse(b,x,x0,amount,dt){
    var a=dt*amount*gridW*gridH;
    linearSolve(b,x,x0,a,1+4*a);
  }
  function advect(b,d,d0,velX,velY,dt){
    var scale=dt*Math.max(gridW,gridH);
    for(var y=1;y<=gridH;y++)for(var xPos=1;xPos<=gridW;xPos++){
      var n=idx(xPos,y),x=xPos-scale*velX[n],yBack=y-scale*velY[n];
      x=clamp(x,.5,gridW+.5);yBack=clamp(yBack,.5,gridH+.5);
      var i0=Math.floor(x),i1=i0+1,j0=Math.floor(yBack),j1=j0+1;
      var s1=x-i0,s0=1-s1,t1=yBack-j0,t0=1-t1;
      d[n]=s0*(t0*d0[idx(i0,j0)]+t1*d0[idx(i0,j1)])+s1*(t0*d0[idx(i1,j0)]+t1*d0[idx(i1,j1)]);
    }
    boundary(b,d);
  }
  function project(velX,velY,pressure,divergence){
    for(var y=1;y<=gridH;y++)for(var xPos=1;xPos<=gridW;xPos++){
      var n=idx(xPos,y);
      divergence[n]=-.5*(velX[idx(xPos+1,y)]-velX[idx(xPos-1,y)]+velY[idx(xPos,y+1)]-velY[idx(xPos,y-1)])/Math.max(gridW,gridH);
      pressure[n]=0;
    }
    boundary(0,divergence);boundary(0,pressure);
    linearSolve(0,pressure,divergence,1,4);
    for(var yy=1;yy<=gridH;yy++)for(var xx=1;xx<=gridW;xx++){
      var at=idx(xx,yy);
      velX[at]-=.5*gridW*(pressure[idx(xx+1,yy)]-pressure[idx(xx-1,yy)]);
      velY[at]-=.5*gridH*(pressure[idx(xx,yy+1)]-pressure[idx(xx,yy-1)]);
    }
    boundary(1,velX);boundary(2,velY);
  }
  function velocityStep(dt){
    u0.set(u);v0.set(v);
    diffuse(1,u,u0,.00002,dt);diffuse(2,v,v0,.00002,dt);
    project(u,v,u0,v0);
    u0.set(u);v0.set(v);
    advect(1,u,u0,u0,v0,dt);advect(2,v,v0,u0,v0,dt);
    project(u,v,u0,v0);
  }
  function dyeStep(dt){
    [[dyeR,dyeR0],[dyeG,dyeG0],[dyeB,dyeB0]].forEach(function(pair){
      pair[1].set(pair[0]);diffuse(0,pair[0],pair[1],.000008,dt);
      pair[1].set(pair[0]);advect(0,pair[0],pair[1],u,v,dt);
      for(var i=0;i<size;i++)pair[0][i]*=values.density;
    });
  }
  function splat(x,y,forceX,forceY,color,radius,amount){
    var cx=1+x*gridW,cy=1+y*gridH,rx=Math.max(2,radius*gridW),ry=Math.max(2,radius*gridH);
    var minX=Math.max(1,Math.floor(cx-rx*2)),maxX=Math.min(gridW,Math.ceil(cx+rx*2));
    var minY=Math.max(1,Math.floor(cy-ry*2)),maxY=Math.min(gridH,Math.ceil(cy+ry*2));
    for(var yy=minY;yy<=maxY;yy++)for(var xx=minX;xx<=maxX;xx++){
      var n=idx(xx,yy),dx=(xx-cx)/rx,dy=(yy-cy)/ry,g=Math.exp(-3.2*(dx*dx+dy*dy));
      if(g<.005)continue;
      u[n]+=forceX*g;v[n]+=forceY*g;
      dyeR[n]+=color[0]*amount*g;dyeG[n]+=color[1]*amount*g;dyeB[n]+=color[2]*amount*g;
    }
  }
  function readAudio(){
    try{
      if(!analyser&&window.kefeAudioGraph){var graph=window.kefeAudioGraph.ensure();if(graph){analyser=graph.analyser;freq=new Uint8Array(analyser.frequencyBinCount);}}
      if(!analyser||!freq)return {bass:0,mid:0,treble:0};
      if(freq.length!==analyser.frequencyBinCount)freq=new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(freq);
      var nyq=(window.kefeAudioGraph.context()?.sampleRate||44100)/2;
      function band(lo,hi){var a=Math.max(0,Math.floor(lo/nyq*freq.length)),b=Math.min(freq.length-1,Math.ceil(hi/nyq*freq.length)),sum=0;for(var i=a;i<=b;i++)sum+=freq[i];return clamp(Math.pow(sum/Math.max(1,b-a+1)/255*2.8,1.25),0,1);}
      return {bass:band(20,250),mid:band(250,2000),treble:band(2000,12000)};
    }catch(e){return {bass:0,mid:0,treble:0};}
  }
  function simulate(t,dt){
    var audio=readAudio(),energy=audio.bass*.58+audio.mid*.3+audio.treble*.12;
    /* Emitters enter from beyond the frame and travel across it instead of
       continuously injecting colour around the centre. At the default speed,
       each sweep takes roughly 12.5 seconds for a slow, ink-like drift. */
    var colors=palettesRgb[paletteIndex],phase=t*values.speed*.08;
    var pulse=.14+energy*values.react*.55;
    var travel=(t*values.speed*.08)%1;
    var reverse=1-travel;
    var x1=travel*1.24-.12,y1=.18+.64*(.5+.5*Math.sin(phase*1.7));
    var x2=reverse*1.24-.12,y2=.2+.62*(.5+.5*Math.sin(phase*1.25+2.1));
    var x3=.16+.68*(.5+.5*Math.sin(phase*1.15+4.2)),y3=travel*1.24-.12;
    var f=values.swirl*(.12+energy*values.react*.42);
    splat(x1,y1,Math.cos(phase*.8)*f+audio.bass*values.react*.75,Math.sin(phase*.7)*f,colors[2],.08,.16+pulse*.16);
    splat(x2,y2,Math.sin(phase*.65)*f,Math.cos(phase*.55)*f+audio.mid*values.react*.45,colors[4],.072,.13+pulse*.12);
    if(audio.treble>.04||Math.sin(phase*1.8)>.72)splat(x3,y3,Math.cos(phase)*f*.55,Math.sin(phase*1.1)*f*.55,colors[3],.045,.07+audio.treble*values.react*.14);
    velocityStep(dt);dyeStep(dt);
  }
  function paintPixels(){
    var data=imageData.data,colors=palettesRgb[paletteIndex],mirror=values.label==='Kaleidoscope';
    for(var y=0;y<gridH;y++)for(var x=0;x<gridW;x++){
      var xx=mirror?Math.min(x,gridW-1-x):x,n=idx(xx+1,y+1),at=(x+y*gridW)*4;
      var r=Math.max(0,dyeR[n]),g=Math.max(0,dyeG[n]),b=Math.max(0,dyeB[n]);
      var max=Math.max(r,g,b);
      if(max>0.02){
        var lift=values.bloom;
        r=1-Math.exp(-r*(1.4+lift*.7));g=1-Math.exp(-g*(1.4+lift*.7));b=1-Math.exp(-b*(1.4+lift*.7));
        var lum=Math.max(r,g,b);
        var glint=Math.pow(lum,2.2)*lift*.18;
        data[at]=Math.min(255,(r+glint)*255);data[at+1]=Math.min(255,(g+glint)*255);data[at+2]=Math.min(255,(b+glint)*255);
      }else{data[at]=2;data[at+1]=3;data[at+2]=7;}
      data[at+3]=max>0.012?Math.round(clamp(Math.max(r,g,b)*2.8,0,.98)*255):0;
    }
    simCtx.putImageData(imageData,0,0);
  }
  function draw(w,h,t){
    if(!canvas||!ctx)return;
    w=Math.max(2,w|0);h=Math.max(2,h|0);
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    if(!size||simCanvas.width!==gridW||simCanvas.height!==gridH)allocate();
    var now=Number(t)||0,dt=lastTime===null?1/60:clamp(now-lastTime,1/120,.04);
    if(lastTime!==null&&now<lastTime)dt=1/60;
    lastTime=now;
    simulate(now,dt);paintPixels();
    ctx.clearRect(0,0,w,h);ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=.45+values.bloom*.18;ctx.filter='blur('+(5+values.bloom*11)+'px)';
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(simCanvas,0,0,w,h);ctx.restore();
    ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=1;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(simCanvas,0,0,w,h);ctx.restore();
  }
  function active(){
    var tab=document.querySelector('.kefe-vis-tabs [data-visualiser="gradient"]');
    var power=document.querySelector('#kefeVisualiserPowerSlot .kefe-switch')||
      document.querySelector('.kefe-vis-tabs [data-visualiser="gradient"] .kefe-vis-option-power');
    return !!tab&&tab.getAttribute('aria-selected')==='true'&&(!power||power.getAttribute('aria-checked')==='true');
  }
  function setPreset(id){
    if(!presets[id])return;preset=id;Object.assign(values,presets[id]);
    document.querySelectorAll('[data-fluid-preset]').forEach(function(b){b.classList.toggle('primary',b.dataset.fluidPreset===id);b.setAttribute('aria-pressed',String(b.dataset.fluidPreset===id));});document.querySelectorAll('[data-fluid-key]').forEach(function(input){if(Object.prototype.hasOwnProperty.call(values,input.dataset.fluidKey))input.value=values[input.dataset.fluidKey];var output=input.parentNode.querySelector('output');if(output)output.textContent=Number(input.value).toFixed(Number(input.step)<1?2:1);});
  }
  function buildControls(view){
    var wrap=document.createElement('div');wrap.className='kefe-fluid-ink-controls';
    var presetList=document.createElement('div');presetList.className='kefe-fluid-presets';
    Object.keys(presets).forEach(function(id){
      var pset=presets[id],button=document.createElement('button');button.type='button';button.className='kefe-btn';button.dataset.fluidPreset=id;
      var strong=document.createElement('strong');strong.textContent=pset.label;
      button.appendChild(strong);button.addEventListener('click',function(){setPreset(id);});presetList.appendChild(button);
    });
    var presetSet=document.getElementById('kefeGradientPresetSet');
    if(presetSet){presetSet.appendChild(presetList);}
    else{wrap.appendChild(presetList);}
    var settings=document.createElement('section');settings.className='kefe-fluid-settings kefe-visualiser-control-group';
    var settingsTitle=document.createElement('div');settingsTitle.className='kefe-label kefe-fluid-settings-title';settingsTitle.textContent='Settings';settings.appendChild(settingsTitle);
    function addSlider(key,label,min,max,step){
      var row=document.createElement('label');row.className='kefe-visualiser-field';
      var head=document.createElement('span'),title=document.createElement('b'),out=document.createElement('output'),input=document.createElement('input');
      title.textContent=label;input.type='range';input.min=min;input.max=max;input.step=step;input.value=values[key];input.dataset.fluidKey=key;
      out.textContent=Number(values[key]).toFixed(step<1?2:1);head.appendChild(title);head.appendChild(out);
      input.addEventListener('input',function(){values[key]=Number(input.value);out.textContent=Number(input.value).toFixed(step<1?2:1);if(key==='quality')allocate();});
      row.appendChild(head);row.appendChild(input);settings.appendChild(row);
    }
    addSlider('speed','Flow speed',.2,2.5,.05);addSlider('swirl','Swirl strength',.2,3,.05);
    addSlider('react','Audio response',0,3,.05);addSlider('bloom','Glow',0,1.5,.05);
    addSlider('density','Ink persistence',.96,.999,.001);addSlider('quality','Simulation quality',.6,1.5,.05);
    wrap.appendChild(settings);
    var random=document.createElement('button');random.type='button';random.className='kefe-btn';random.textContent='Randomise';random.addEventListener('click',function(){
      var ids=Object.keys(presets);setPreset(ids[Math.floor(Math.random()*ids.length)]);
      paletteIndex=Math.floor(Math.random()*palettes.length);resetDye();syncPaletteButtons();
    });wrap.appendChild(random);view.appendChild(wrap);

    function syncPaletteButtons(){
      var buttons=document.querySelectorAll('.kefe-fluid-palette-options .kefe-gradient-chip');
      buttons.forEach(function(button,i){button.setAttribute('aria-pressed',String(i===paletteIndex));});
    }
    var paletteSet=document.getElementById('kefeGradientPresetSet');
    if(paletteSet){
      var paletteStrip=document.createElement('div');paletteStrip.className='kefe-gradient-preset-strip kefe-fluid-palette-options';
      paletteStrip.setAttribute('aria-label','Fluid Ink colour palettes');
      var chips=document.createElement('div');chips.className='kefe-gradient-palettes';
      palettes.forEach(function(palette,i){
        var button=document.createElement('button');button.type='button';button.className='kefe-gradient-chip';
        button.title=palette.name;button.setAttribute('aria-label',palette.name+' palette');
        button.setAttribute('aria-pressed',String(i===paletteIndex));
        button.style.background='linear-gradient(90deg,'+palette.c.join(',')+')';
        button.addEventListener('click',function(){paletteIndex=i;resetDye();syncPaletteButtons();});
        chips.appendChild(button);
      });
      paletteStrip.appendChild(chips);
      var paletteLabel=document.createElement('p');paletteLabel.className='kefe-fluid-description';paletteLabel.textContent='Colour palette';
      paletteLabel.className='kefe-fluid-palette-label';
      paletteStrip.classList.add('kefe-fluid-palette-in-controls');
      view.insertBefore(paletteLabel,wrap);
      view.insertBefore(paletteStrip,wrap);
    }
  }
  function resetDye(){
    [u,v,u0,v0,dyeR,dyeG,dyeB,dyeR0,dyeG0,dyeB0].forEach(function(a){if(a)a.fill(0);});
  }
  function init(){
    var stage=document.querySelector('.kefe-stage'),view=document.getElementById('kefeVisGradientView');
    if(!stage||!view)return;
    canvas=document.createElement('canvas');canvas.id='kefeFluidInkCanvas';canvas.setAttribute('aria-hidden','true');
    canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2;';
    ctx=canvas.getContext('2d',{alpha:true});
    simCanvas=document.createElement('canvas');simCtx=simCanvas.getContext('2d',{alpha:true});
    if(!ctx||!simCtx){var error=document.createElement('p');error.className='kefe-liquid-error';error.textContent='Fluid Ink could not start because this browser does not support canvas rendering.';view.appendChild(error);return;}
    if(window.kefeGradientLayer&&window.kefeGradientLayer.stopPreview)window.kefeGradientLayer.stopPreview();
    stage.insertBefore(canvas,document.getElementById('kefeCanvas')||null);
    var intro=view.querySelector('.kefe-visualiser-intro');
    Array.from(view.children).forEach(function(child){if(child!==intro)child.remove();});
    var tab=document.querySelector('.kefe-vis-tabs [data-visualiser="gradient"]');
    if(tab){tab.dataset.icon='≈';tab.title='Fluid Ink visualiser';tab.setAttribute('aria-label','Fluid Ink visualiser');}
    var title=intro&&intro.querySelector('strong'),description=intro&&intro.querySelector('span');
    if(title)title.textContent='';
    if(description)description.textContent='';

    buildControls(view);setPreset(preset);
    window.kefeGradientLayer={
      paint:function(target,w,h,t){if(!active())return;draw(w,h,Number(t)||0);if(target)target.drawImage(canvas,0,0,w,h);},
      render:function(target,w,h,t){draw(w,h,Number(t)||0);if(target)target.drawImage(canvas,0,0,w,h);},
      state:function(){return {on:active(),preset:preset,palette:palettes[paletteIndex].name,values:Object.assign({},values)};},
      isOn:active,randomize:function(){var ids=Object.keys(presets);setPreset(ids[Math.floor(Math.random()*ids.length)]);paletteIndex=Math.floor(Math.random()*palettes.length);resetDye();},
      stopPreview:function(){if(raf)cancelAnimationFrame(raf);raf=0;}
    };
    window.kefeFluidInk={setPreset:setPreset,paint:window.kefeGradientLayer.paint,reset:resetDye};
    function frame(now){
      raf=0;if(document.hidden)return;
      var rect=stage.getBoundingClientRect();
      if(rect.width>1&&rect.height>1){
        canvas.style.display=active()?'block':'none';
        if(active()){
          var scale=Math.min(window.devicePixelRatio||1,1920/Math.max(rect.width,rect.height));
          draw(Math.round(rect.width*scale),Math.round(rect.height*scale),(now-start)/1000);
        }
      }
      raf=requestAnimationFrame(frame);
    }
    raf=requestAnimationFrame(frame);
    document.addEventListener('visibilitychange',function(){if(!document.hidden&&!raf)raf=requestAnimationFrame(frame);});
    window.addEventListener('kefe-stage-resize',function(){if(canvas&&stage){var rect=stage.getBoundingClientRect(),scale=Math.min(window.devicePixelRatio||1,1200/Math.max(rect.width,rect.height));draw(Math.round(rect.width*scale),Math.round(rect.height*scale),(performance.now()-start)/1000);}});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();