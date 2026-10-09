/* KEFE visualiser — Gradient Overlay layer.
   Canvas port of the Gradient Studio tool: linear / radial / conic gradients with
   hue · saturation · lightness · temperature · vibrance adjustment, film grain,
   blend mode + opacity. Sits between the WebGL visualiser and the lyric canvas,
   is composited into video export, and has its own tab in the Visualiser panel. */
(function(){
  'use strict';
  var STORE_KEY='kefe.gradientOverlay.v1';
  var MAX_STOPS=8, MIN_STOPS=2;
  var BLENDS=['normal','screen','overlay','soft-light','hard-light','multiply','color-dodge','lighten','difference','exclusion','luminosity'];
  var PALETTES=[
    {name:'Sunset',stops:['#ff5e62','#ff9966','#ffd36e','#7b2ff7']},
    {name:'Aurora',stops:['#0f2027','#2c7a7b','#4fd1c5','#9f7aea']},
    {name:'Candy',stops:['#ff6ec7','#b388ff','#5ce1e6','#ffe29a']},
    {name:'Ember',stops:['#12040a','#7a1f2b','#e8542c','#ffd27a']},
    {name:'Ocean',stops:['#021b36','#0b5394','#1fa2c4','#b8f3ff']},
    {name:'Mono',stops:['#1e1e22','#5a5a62','#a2a2ac','#e8e8ec']}
  ];
  var DEFAULT={
    on:false, type:'linear', angle:108, pos:{x:50,y:50},
    stops:['#ff6ec7','#7c4dff','#1fa2c4','#ffe29a'].map(function(c,i,a){return {color:c,position:Math.round(i/(a.length-1)*100)};}),
    adjust:{hue:0,sat:0,light:0,temp:0,vibrance:0},
    grain:{on:true,amount:40,scale:1,blend:'overlay',opacity:60,seed:1234},
    blend:'screen', opacity:55, anim:{on:true,speed:0.6}
  };

  function clone(o){return JSON.parse(JSON.stringify(o));}
  var S=clone(DEFAULT);
  try{
    var saved=JSON.parse(localStorage.getItem(STORE_KEY)||'null');
    if(saved&&Array.isArray(saved.stops)&&saved.stops.length>=MIN_STOPS){
      S=Object.assign(clone(DEFAULT),saved);
      S.adjust=Object.assign({},DEFAULT.adjust,saved.adjust);S.grain=Object.assign({},DEFAULT.grain,saved.grain);
      S.anim=Object.assign({},DEFAULT.anim,saved.anim);S.pos=Object.assign({},DEFAULT.pos,saved.pos);
    }
  }catch(e){}
  function persist(){try{localStorage.setItem(STORE_KEY,JSON.stringify(S));}catch(e){}}

  /* ── colour maths (same model as the Gradient Studio tool) ── */
  var clamp=function(v,a,b){return Math.min(b,Math.max(a,v));};
  function hexToRgb(hex){hex=String(hex||'#000').replace('#','');if(hex.length===3)hex=hex.split('').map(function(c){return c+c;}).join('');var n=parseInt(hex,16)||0;return {r:(n>>16)&255,g:(n>>8)&255,b:n&255};}
  function rgbToHex(r,g,b){return '#'+[r,g,b].map(function(v){return clamp(Math.round(v),0,255).toString(16).padStart(2,'0');}).join('');}
  function hexToHsl(hex){
    var c=hexToRgb(hex),r=c.r/255,g=c.g/255,b=c.b/255,mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,h=0,s=0,d=mx-mn;
    if(d){s=l>.5?d/(2-mx-mn):d/(mx+mn);h=mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4;h*=60;}
    return {h:h,s:s,l:l};
  }
  function hslToHex(h,s,l){
    h=((h%360)+360)%360;var c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2,r=0,g=0,b=0;
    if(h<60){r=c;g=x;}else if(h<120){r=x;g=c;}else if(h<180){g=c;b=x;}else if(h<240){g=x;b=c;}else if(h<300){r=x;b=c;}else{r=c;b=x;}
    return rgbToHex((r+m)*255,(g+m)*255,(b+m)*255);
  }
  function applyAdjust(hex,adj){
    var o=hexToHsl(hex),h=(o.h+adj.hue+360)%360,s=clamp(o.s+adj.sat/100,0,1),l=clamp(o.l+adj.light/100,0,1);
    if(adj.temp!==0&&s>0.02){
      var t=adj.temp/100,target=t>0?32:212,inf=Math.abs(t)*0.4,diff=target-h;
      if(diff>180)diff-=360;if(diff<-180)diff+=360;
      h=(h+diff*inf+360)%360;s=clamp(s+Math.abs(t)*0.08,0,1);
    }
    if(adj.vibrance>0){s=clamp(s+(adj.vibrance/100)*(1-s)*0.7,0,1);}
    return hslToHex(h,s,l);
  }
  function sortedStops(){
    return S.stops.map(function(s){return {color:applyAdjust(s.color,S.adjust),position:s.position};}).sort(function(a,b){return a.position-b.position;});
  }

  /* ── grain tile ── */
  var tile=null,tileSeed=null;
  function grainTile(seed){
    if(tile&&tileSeed===seed)return tile;
    var c=document.createElement('canvas');c.width=c.height=256;
    var g=c.getContext('2d'),im=g.createImageData(256,256),a=(seed|0)||1;
    function rnd(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}
    for(var i=0;i<im.data.length;i+=4){var v=Math.floor(rnd()*256);im.data[i]=im.data[i+1]=im.data[i+2]=v;im.data[i+3]=255;}
    g.putImageData(im,0,0);tile=c;tileSeed=seed;return c;
  }

  /* ── rendering ── */
  var BLEND_OP={normal:'source-over'};
  function blendOp(b){return BLEND_OP[b]||b;}

  function renderLayer(ctx,w,h,t){
    var stops=sortedStops(),anim=S.anim.on?t*S.anim.speed:0,grad;
    var cx=S.pos.x/100*w,cy=S.pos.y/100*h;
    if(S.type==='radial'){
      cx+=Math.sin(anim*0.7)*w*0.12*(S.anim.on?1:0);cy+=Math.cos(anim*0.5)*h*0.12*(S.anim.on?1:0);
      var r=Math.max(Math.hypot(cx,cy),Math.hypot(w-cx,cy),Math.hypot(cx,h-cy),Math.hypot(w-cx,h-cy));
      grad=ctx.createRadialGradient(cx,cy,0,cx,cy,r);
    }else if(S.type==='conic'&&ctx.createConicGradient){
      grad=ctx.createConicGradient((S.angle+anim*24-90)*Math.PI/180,cx,cy);
    }else{
      var a=(S.angle+anim*24)*Math.PI/180,len=Math.abs(w*Math.sin(a))+Math.abs(h*Math.cos(a)),dx=Math.sin(a)*len/2,dy=-Math.cos(a)*len/2;
      grad=ctx.createLinearGradient(w/2-dx,h/2-dy,w/2+dx,h/2+dy);
    }
    stops.forEach(function(s){grad.addColorStop(clamp(s.position/100,0,1),s.color);});
    ctx.save();
    ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
    ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
    if(S.grain.on&&S.grain.amount>0){
      var k=Math.max(0.1,S.grain.scale)*Math.max(0.5,h/720),pat=ctx.createPattern(grainTile(S.grain.seed),'repeat');
      if(pat){
        ctx.globalCompositeOperation=blendOp(S.grain.blend);
        ctx.globalAlpha=clamp(S.grain.amount/100*S.grain.opacity/100*1.6,0,1);
        ctx.scale(k,k);ctx.fillStyle=pat;ctx.fillRect(0,0,w/k,h/k);
      }
    }
    ctx.restore();
  }

  var scratch=null;
  /* Composite the layer onto an existing context (video export) using the chosen blend + opacity. */
  function paint(ctx,w,h,t){
    if(!S.on||S.opacity<=0)return;
    if(!scratch)scratch=document.createElement('canvas');
    if(scratch.width!==w||scratch.height!==h){scratch.width=w;scratch.height=h;}
    var sctx=scratch.getContext('2d');sctx.clearRect(0,0,w,h);
    renderLayer(sctx,w,h,Number(t)||0);
    ctx.save();ctx.globalAlpha=clamp(S.opacity/100,0,1);ctx.globalCompositeOperation=blendOp(S.blend);
    ctx.drawImage(scratch,0,0,w,h);ctx.restore();
  }

  /* ── preview canvas ── */
  var stage=null,cv=null,cctx=null,raf=0,t0=performance.now();
  function mountCanvas(){
    stage=document.querySelector('.kefe-stage');if(!stage||cv)return;
    cv=document.createElement('canvas');cv.id='kefeGradientCanvas';cv.setAttribute('aria-hidden','true');
    var lyric=document.getElementById('kefeCanvas');
    stage.insertBefore(cv,lyric||null);cctx=cv.getContext('2d');
    if(window.ResizeObserver){var ro=new ResizeObserver(function(){sizeCanvas();drawPreview();});ro.observe(stage);ro.observe(cv);}
    window.addEventListener('kefe-stage-resize',function(){sizeCanvas();drawPreview();});
    sizeCanvas();
  }
  function sizeCanvas(){
    if(!cv||!stage)return;
    var r=(cv.clientWidth>2&&cv.clientHeight>2)?{width:cv.clientWidth,height:cv.clientHeight}:stage.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2),sc=Math.min(1,1400/Math.max(r.width*dpr,r.height*dpr,1));
    var w=Math.max(2,Math.round(r.width*dpr*sc)),h=Math.max(2,Math.round(r.height*dpr*sc));
    if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h;}
  }
  function drawPreview(){
    if(!cv)return;
    cv.style.display=S.on?'block':'none';
    cv.style.opacity=String(clamp(S.opacity/100,0,1));
    cv.style.mixBlendMode=S.blend==='normal'?'normal':S.blend;
    if(!S.on)return;
    cctx.clearRect(0,0,cv.width,cv.height);
    renderLayer(cctx,cv.width,cv.height,(performance.now()-t0)/1000);
  }
  function loop(){
    raf=0;drawPreview();
    if(S.on&&S.anim.on&&!document.hidden)raf=requestAnimationFrame(loop);
  }
  function update(){
    persist();
    if(!raf){
      if(S.on&&S.anim.on)raf=requestAnimationFrame(loop);else drawPreview();
    }
    if(!S.on||!S.anim.on)drawPreview();
    window.dispatchEvent(new CustomEvent('kefe-gradient-change'));
  }
  document.addEventListener('visibilitychange',function(){if(!document.hidden)update();});

  /* ── panel UI ── */
  var ui={};
  function el(tag,cls,html){var e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e;}
  function slider(label,min,max,step,get,set,fmt){
    var wrap=el('label','kefe-visualiser-field'),head=el('span'),b=el('b',null,label),out=el('output'),inp=el('input');
    inp.type='range';inp.min=min;inp.max=max;inp.step=step;
    function sync(){inp.value=get();out.textContent=fmt?fmt(get()):String(get());}
    inp.addEventListener('input',function(){set(Number(inp.value));out.textContent=fmt?fmt(Number(inp.value)):inp.value;update();});
    head.appendChild(b);head.appendChild(out);wrap.appendChild(head);wrap.appendChild(inp);sync();
    ui.syncs.push(sync);return wrap;
  }
  function group(title){var g=el('div','kefe-visualiser-control-group');g.appendChild(el('div','kefe-label',title));return g;}
  function segmented(options,get,set){
    var row=el('div','kefe-gradient-seg'),btns=[];
    options.forEach(function(o){
      var b=el('button','kefe-btn',o.label);b.type='button';
      b.addEventListener('click',function(){set(o.value);sync();update();});
      btns.push([b,o.value]);row.appendChild(b);
    });
    function sync(){btns.forEach(function(p){p[0].classList.toggle('primary',p[1]===get());p[0].setAttribute('aria-pressed',String(p[1]===get()));});}
    sync();ui.syncs.push(sync);return row;
  }
  function toggle(label,get,set){
    var row=el('div','kefe-visualiser-spin-row'),b=el('button','kefe-btn kefe-switch');
    b.type='button';b.setAttribute('role','switch');
    var state=el('span','kefe-switch-state'),track=el('span','kefe-switch-track');
    track.setAttribute('aria-hidden','true');track.appendChild(el('span','kefe-switch-thumb'));
    b.appendChild(state);b.appendChild(track);
    row.appendChild(el('span','kefe-label',label));row.appendChild(b);
    function sync(){
      var on=!!get();state.textContent=on?'On':'Off';
      b.classList.toggle('is-on',on);b.setAttribute('aria-checked',String(on));
      b.setAttribute('aria-label',label);
    }
    b.addEventListener('click',function(){set(!get());sync();update();});
    sync();ui.syncs.push(sync);return row;
  }

  function buildStops(){
    var box=ui.stopBox;box.innerHTML='';
    S.stops.forEach(function(s,i){
      var row=el('div','kefe-gradient-stop'),color=el('input'),pos=el('input'),del=el('button','kefe-btn','×');
      color.type='color';color.value=s.color;color.setAttribute('aria-label','Stop '+(i+1)+' colour');
      pos.type='range';pos.min=0;pos.max=100;pos.step=1;pos.value=s.position;pos.setAttribute('aria-label','Stop '+(i+1)+' position');
      del.type='button';del.title='Remove stop';del.disabled=S.stops.length<=MIN_STOPS;
      color.addEventListener('input',function(){s.color=color.value;update();});
      pos.addEventListener('input',function(){s.position=Number(pos.value);update();});
      del.addEventListener('click',function(){if(S.stops.length>MIN_STOPS){S.stops.splice(i,1);buildStops();update();}});
      row.appendChild(color);row.appendChild(pos);row.appendChild(del);box.appendChild(row);
    });
    ui.stopCount.textContent=S.stops.length+' / '+MAX_STOPS;
    ui.addBtn.disabled=S.stops.length>=MAX_STOPS;
  }
  function setStops(colors){
    S.stops=colors.map(function(c,i){return {color:c,position:Math.round(i/(colors.length-1)*100)};});
    buildStops();update();
  }
  function interp(pct){
    var st=S.stops.slice().sort(function(a,b){return a.position-b.position});
    if(pct<=st[0].position)return st[0].color;
    for(var i=1;i<st.length;i++){
      if(pct<=st[i].position){
        var a=hexToRgb(st[i-1].color),b=hexToRgb(st[i].color),t=(pct-st[i-1].position)/Math.max(1,st[i].position-st[i-1].position);
        return rgbToHex(a.r+(b.r-a.r)*t,a.g+(b.g-a.g)*t,a.b+(b.b-a.b)*t);
      }
    }
    return st[st.length-1].color;
  }
  function randomize(){
    S.adjust={hue:Math.round((Math.random()*2-1)*180),sat:Math.round((Math.random()*2-1)*55),light:Math.round((Math.random()*2-1)*30),temp:Math.round((Math.random()*2-1)*70),vibrance:Math.round(Math.random()*65)};
    if(Math.random()>0.4){
      var types=['linear','linear','linear','radial','conic'];
      S.type=types[Math.floor(Math.random()*types.length)];S.angle=Math.floor(Math.random()*360);
      S.pos={x:20+Math.random()*60,y:20+Math.random()*60};
    }
    var p=PALETTES[Math.floor(Math.random()*PALETTES.length)];
    S.stops=p.stops.map(function(c,i,a){return {color:c,position:Math.round(i/(a.length-1)*100)};});
    S.on=true;
    buildStops();syncAll();update();
  }
  function syncAll(){ui.syncs.forEach(function(f){f();});}

  function buildPanel(){
    var panel=document.querySelector('[data-panel-view="visualiser"]');
    if(!panel||panel.querySelector('.kefe-vis-tabs'))return;
    var form=panel.querySelector('.kefe-visualiser-form');if(!form)return;
    ui.syncs=[];
    /* wrap existing particle controls so the two engines can be switched */
    var particles=el('div','kefe-vis-view');particles.id='kefeVisParticlesView';
    while(form.firstChild)particles.appendChild(form.firstChild);
    var particleToggle=toggle('Show particles',function(){return window.kefeVisualiserEnabled!==false;},function(v){
      window.kefeVisualiserEnabled=v;var vc=document.getElementById('kefeVisualiserCanvas');if(vc)vc.style.visibility=v?'':'hidden';
    });
    particles.insertBefore(particleToggle,particles.firstChild);
    var howBad=el('div','kefe-vis-view kefe-howbad-view');howBad.id='kefeVisHowBadView';howBad.hidden=true;
    howBad.appendChild(toggle('Show How Bad',function(){return window.kefeVisualiserEnabled!==false;},function(v){
      window.kefeVisualiserEnabled=v;var vc=document.getElementById('kefeVisualiserCanvas');if(vc)vc.style.visibility=v?'':'hidden';
    }));
    var howBadPresets=el('div','kefe-visualiser-control-group kefe-howbad-presets');
    howBadPresets.appendChild(el('div','kefe-label','How Bad presets'));
    var howBadPreset=el('button','kefe-visualiser-preset active','How Bad — Reflection');howBadPreset.type='button';
    howBadPreset.setAttribute('aria-pressed','true');howBadPreset.addEventListener('click',function(){
      window.kefeParticleVisualiser?.selectPreset('how-bad-reflection');
    });
    howBadPresets.appendChild(howBadPreset);howBad.appendChild(howBadPresets);
    var gradient=el('div','kefe-vis-view kefe-gradient-view');gradient.id='kefeVisGradientView';gradient.hidden=true;
    var tabs=el('div','kefe-vis-tabs');tabs.setAttribute('role','tablist');
    var tp=el('button','kefe-btn primary','Particles'),tg=el('button','kefe-btn','Gradient'),th=el('button','kefe-btn','How Bad');
    tp.type=tg.type=th.type='button';tp.setAttribute('role','tab');tg.setAttribute('role','tab');th.setAttribute('role','tab');
    var promptWrap=document.getElementById('visualiserPrompt')?.parentElement?.parentElement;
    var presetWrap=document.getElementById('visualiserPreset')?.parentElement;
    var gridWrap=document.getElementById('visualiserPresetGrid')?.parentElement;
    var randomButton=document.getElementById('visualiserRandom');
    function show(which){
      var isGradient=which==='gradient',isHowBad=which==='howbad';
      particles.hidden=isGradient||isHowBad;howBad.hidden=!isHowBad;gradient.hidden=!isGradient;
      tp.classList.toggle('primary',which==='particles');tg.classList.toggle('primary',isGradient);th.classList.toggle('primary',isHowBad);
      tp.setAttribute('aria-selected',String(which==='particles'));tg.setAttribute('aria-selected',String(isGradient));th.setAttribute('aria-selected',String(isHowBad));
      if(promptWrap)promptWrap.style.display=isHowBad?'none':'';
      if(presetWrap)presetWrap.style.display=isHowBad?'none':'';
      if(gridWrap)gridWrap.style.display=isHowBad?'none':'';
      if(randomButton)randomButton.style.display=isHowBad?'none':'';
      if(isHowBad)window.kefeParticleVisualiser?.selectPreset('how-bad-reflection');
      else if(which==='particles'&&window.kefeParticleVisualiser?.getPreset()==='how-bad-reflection')window.kefeParticleVisualiser.selectPreset('particles-swarm');
    }
    tp.addEventListener('click',function(){show('particles');});tg.addEventListener('click',function(){show('gradient');});th.addEventListener('click',function(){show('howbad');});
    tabs.appendChild(tp);tabs.appendChild(tg);tabs.appendChild(th);
    form.appendChild(tabs);form.appendChild(particles);form.appendChild(howBad);form.appendChild(gradient);
    show('particles');

    /* ── gradient view ── */
    var intro=el('div','kefe-visualiser-intro');
    intro.innerHTML='<div><strong>Gradient Overlay</strong><span>Colour layer over the particles. Included in video export.</span></div>';
    var rnd=el('button','kefe-btn','Random');rnd.type='button';rnd.addEventListener('click',randomize);intro.appendChild(rnd);
    gradient.appendChild(toggle('Show gradient',function(){return S.on;},function(v){S.on=v;}));
    gradient.appendChild(intro);

    var look=group('Layer');
    look.appendChild(slider('Opacity',0,100,1,function(){return S.opacity;},function(v){S.opacity=v;},function(v){return v+'%';}));
    var bl=el('div');bl.appendChild(el('label','kefe-label','Blend mode'));
    var sel=el('select','kefe-select');BLENDS.forEach(function(b){var o=el('option',null,b);o.value=b;sel.appendChild(o);});
    sel.addEventListener('change',function(){S.blend=sel.value;update();});ui.syncs.push(function(){sel.value=S.blend;});
    bl.appendChild(sel);look.appendChild(bl);
    look.appendChild(toggle('Animate',function(){return S.anim.on;},function(v){S.anim.on=v;}));
    look.appendChild(slider('Motion speed',0.1,3,0.1,function(){return S.anim.speed;},function(v){S.anim.speed=v;},function(v){return v.toFixed(1)+'×';}));
    gradient.appendChild(look);

    var pal=group('Palettes'),chips=el('div','kefe-gradient-palettes');
    PALETTES.forEach(function(p){
      var b=el('button','kefe-gradient-chip',null);b.type='button';b.title=p.name;b.setAttribute('aria-label',p.name+' palette');
      b.style.background='linear-gradient(90deg,'+p.stops.join(',')+')';
      b.addEventListener('click',function(){S.adjust=clone(DEFAULT.adjust);setStops(p.stops);syncAll();});
      chips.appendChild(b);
    });
    pal.appendChild(chips);gradient.appendChild(pal);

    var geo=group('Geometry');
    geo.appendChild(segmented([{label:'Linear',value:'linear'},{label:'Radial',value:'radial'},{label:'Conic',value:'conic'}],function(){return S.type;},function(v){S.type=v;}));
    geo.appendChild(slider('Angle',0,360,1,function(){return S.angle;},function(v){S.angle=v;},function(v){return v+'°';}));
    geo.appendChild(slider('Centre X',0,100,1,function(){return S.pos.x;},function(v){S.pos.x=v;},function(v){return v+'%';}));
    geo.appendChild(slider('Centre Y',0,100,1,function(){return S.pos.y;},function(v){S.pos.y=v;},function(v){return v+'%';}));
    gradient.appendChild(geo);

    var stopsG=group('Colour stops');
    ui.stopCount=el('span','kefe-meta');ui.stopBox=el('div','kefe-gradient-stops');
    var actions=el('div','kefe-gradient-actions');
    ui.addBtn=el('button','kefe-btn','Add stop');ui.addBtn.type='button';
    ui.addBtn.addEventListener('click',function(){
      if(S.stops.length>=MAX_STOPS)return;
      S.stops.sort(function(a,b){return a.position-b.position;});
      var gi=0,gap=-1;for(var i=1;i<S.stops.length;i++){var d=S.stops[i].position-S.stops[i-1].position;if(d>gap){gap=d;gi=i;}}
      var pos=Math.round((S.stops[gi-1].position+S.stops[gi].position)/2);
      S.stops.push({color:interp(pos),position:pos});buildStops();update();
    });
    var dist=el('button','kefe-btn','Distribute');dist.type='button';
    dist.addEventListener('click',function(){S.stops.sort(function(a,b){return a.position-b.position;});S.stops.forEach(function(s,i){s.position=Math.round(i/(S.stops.length-1)*100);});buildStops();update();});
    var rev=el('button','kefe-btn','Reverse');rev.type='button';
    rev.addEventListener('click',function(){S.stops.sort(function(a,b){return a.position-b.position;});var cs=S.stops.map(function(s){return s.color;}).reverse();S.stops.forEach(function(s,i){s.color=cs[i];});buildStops();update();});
    actions.appendChild(ui.addBtn);actions.appendChild(dist);actions.appendChild(rev);
    stopsG.appendChild(ui.stopCount);stopsG.appendChild(ui.stopBox);stopsG.appendChild(actions);gradient.appendChild(stopsG);

    var adj=group('Adjust palette');
    [['hue','Hue',-180,180,'°'],['sat','Saturation',-100,100,''],['light','Lightness',-100,100,''],['temp','Temperature',-100,100,''],['vibrance','Vibrance',0,100,'']].forEach(function(a){
      adj.appendChild(slider(a[1],a[2],a[3],1,function(){return S.adjust[a[0]];},function(v){S.adjust[a[0]]=v;},function(v){return v+a[4];}));
    });
    var reset=el('button','kefe-btn','Reset adjustments');reset.type='button';
    reset.addEventListener('click',function(){S.adjust=clone(DEFAULT.adjust);syncAll();update();});
    adj.appendChild(reset);gradient.appendChild(adj);

    var gr=group('Grain');
    gr.appendChild(toggle('Grain',function(){return S.grain.on;},function(v){S.grain.on=v;}));
    gr.appendChild(slider('Amount',0,100,1,function(){return S.grain.amount;},function(v){S.grain.amount=v;},function(v){return v+'%';}));
    gr.appendChild(slider('Scale',0.1,4,0.05,function(){return S.grain.scale;},function(v){S.grain.scale=v;},function(v){return v.toFixed(2);}));
    gr.appendChild(slider('Grain opacity',0,100,1,function(){return S.grain.opacity;},function(v){S.grain.opacity=v;},function(v){return v+'%';}));
    var gb=el('div');gb.appendChild(el('label','kefe-label','Grain blend'));
    var gsel=el('select','kefe-select');BLENDS.forEach(function(b){var o=el('option',null,b);o.value=b;gsel.appendChild(o);});
    gsel.addEventListener('change',function(){S.grain.blend=gsel.value;update();});ui.syncs.push(function(){gsel.value=S.grain.blend;});
    gb.appendChild(gsel);gr.appendChild(gb);
    var rs=el('button','kefe-btn','New grain seed');rs.type='button';
    rs.addEventListener('click',function(){S.grain.seed=Math.floor(Math.random()*99999)+1;update();});
    gr.appendChild(rs);gradient.appendChild(gr);

    buildStops();syncAll();
  }

  function init(){mountCanvas();buildPanel();update();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();

  window.kefeGradientLayer={paint:paint,render:renderLayer,state:function(){return clone(S);},isOn:function(){return !!S.on;},randomize:randomize};
})();
