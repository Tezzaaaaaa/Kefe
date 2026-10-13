/* KEFE Liquid Flow visualiser — WebGL liquid-glass renderer.
   Uses KEFE's existing audio graph and exposes the same paint API used by video export. */
(function(){
  'use strict';
  var canvas,gl,program,uniforms,raf=0,enabled=true,last=0,start=performance.now(),analyser=null,freq=null;
  var preset='silk',paletteIndex=0,advanced=false;
  var palettes=[
    {name:'Original',c:['#14020c','#5b003e','#e30f64','#fd362b','#fa7a24','#f2dc8c']},
    {name:'Ocean',c:['#01060f','#062b4a','#0a6a8f','#12b3c9','#6fe3e1','#eafcff']},
    {name:'Emerald',c:['#03120b','#0a3a22','#12794a','#35c46e','#a8e86a','#f6ffd0']},
    {name:'Violet',c:['#08030f','#2b0a4d','#5c158f','#a020c9','#e05ad0','#ffd9f2']},
    {name:'Sunset',c:['#180418','#4a0a3a','#a01158','#e8442c','#f9a03f','#ffe9b0']},
    {name:'Mono',c:['#050505','#1a1a1a','#3d3d3d','#6e6e6e','#b0b0b0','#ffffff']}
  ];
  var presets={
    silk:{speed:.85,warp:1.15,scale:1,zoom:1,gloss:.45,react:1.8,ior:1.42,dispersion:.03,thickness:.38,iridescence:.6,mix:.82,spread:1,offset:0,angle:-18,contrast:.95,hue:0,sat:1.05},
    chrome:{speed:1.35,warp:.55,scale:1.85,zoom:1.1,gloss:.7,react:2.2,ior:1.75,dispersion:.085,thickness:.55,iridescence:.95,mix:.22,spread:1.6,offset:.05,angle:32,contrast:1.4,hue:0,sat:.85},
    nebula:{speed:.5,warp:2.3,scale:.65,zoom:.85,gloss:.3,react:2.4,ior:1.35,dispersion:.02,thickness:.62,iridescence:.42,mix:.95,spread:.7,offset:-.1,angle:-45,contrast:.62,hue:0,sat:1.2},
    pulse:{speed:2.1,warp:1,scale:1.35,zoom:1,gloss:.55,react:3,ior:1.55,dispersion:.06,thickness:.42,iridescence:1.15,mix:.72,spread:1.4,offset:.05,angle:0,contrast:1.25,hue:0,sat:1.25}
  };
  var values=Object.assign({},presets.silk,{smooth:.42,drift:0,seed:17,fresnel:.04});
  var VS='attribute vec2 p; varying vec2 v; void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
  var FS='precision highp float; varying vec2 v; uniform vec2 res; uniform float tm,speed,warp,scale,zoom,gloss,react,ior,disp,thick,irid,mixv,spread,offset,angle,contrast,hue,sat,energy,bass,mid,treble; uniform vec3 stops[6];'+
  'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}'+
  'float n(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),u.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),u.x),u.y);}'+
  'float f(vec2 p){float a=.5,z=0.;for(int i=0;i<4;i++){z+=n(p)*a;p=p*2.03+vec2(1.7,9.2);a*=.5;}return z;}'+
  'float flow(vec2 p){float t=tm*speed;float warpA=f(p*1.35+vec2(t*.08,-t*.05));float warpB=f(p*1.7+vec2(4.2+t*.04,2.7-t*.06));vec2 q=p;q.x+=(warpA-.5)*.95+sin(p.y*1.7+t*.28)*.18;q.y+=(warpB-.5)*.52+sin(p.x*1.35-t*.23)*.14;float wave=sin(q.x*3.5+sin(q.y*1.8+t*.22)*.95+t*.35);float ridge=pow(max(0.,1.-abs(wave)),2.1);float detail=f(q*2.0+vec2(t*.06,-t*.045));return clamp(ridge*.68+detail*.32,0.,1.);}'+
  'vec3 ramp(float t){t=clamp(t,0.,.9999)*5.;float x=clamp(t,0.,1.)*5.;if(x<1.)return mix(stops[0],stops[1],smoothstep(0.,1.,x));if(x<2.)return mix(stops[1],stops[2],smoothstep(0.,1.,x-1.));if(x<3.)return mix(stops[2],stops[3],smoothstep(0.,1.,x-2.));if(x<4.)return mix(stops[3],stops[4],smoothstep(0.,1.,x-3.));return mix(stops[4],stops[5],smoothstep(0.,1.,x-4.));}'+
  'void main(){float ar=res.x/res.y;vec2 p=(v-.5)*vec2(ar,1.)*2./zoom;float t=tm*speed;float a=flow(p*scale);float b=flow(p*scale*1.65+vec2(3.1,7.4));vec2 e=vec2(.003,0.);float dx=flow((p+e)*scale)-a;float dy=flow((p+e.yx)*scale)-a;vec3 N=normalize(vec3(-dx*scale*warp*90.,-dy*scale*warp*90.,1.));vec3 V=normalize(vec3(p,2.));float fres=.04+.96*pow(1.-max(dot(N,V),0.),5.);float g=clamp(mixv+.3*energy,0.,1.);float tt=clamp((a*.6+b*.4)*spread+offset+.35,0.,1.);vec3 c=ramp(tt);float ang=angle*.0174533;float axis=clamp((p.x*cos(ang)-p.y*sin(ang))*.25+.5,0.,1.);c=mix(c,ramp(axis),.22);c*=mix(.75,1.25,smoothstep(.2,.8,a));vec2 ruv=v+N.xy*thick*(.28+disp*2.2)/max(ior,1.);float refr=f(ruv*vec2(ar,1.)*scale+vec2(t*.1));vec3 glass=mix(ramp(refr),c,g);glass=clamp((glass-.5)*contrast+.5,0.,1.);float phase=a*5.+t*.3+fres*2.+bass*2.;vec3 iri=.5+.5*cos(6.2831*(vec3(0.,.333,.667)+phase));glass+=iri*irid*fres*.28*(.35+treble*.35);glass+=vec3(1.)*pow(max(dot(N,normalize(V+vec3(0.,0.,1.))),0.),72.)*gloss*.55*(.35+energy*.4);glass+=stops[5]*pow(fres,2.)*gloss*.12*(.35+bass*.4);glass*=1.+.18*energy;float L=dot(glass,vec3(.299,.587,.114));glass=mix(glass,vec3(L),.04);float ca=cos(hue*.0174533),sa=sin(hue*.0174533);vec3 k=vec3(.57735);glass=glass*ca+cross(k,glass)*sa+k*dot(k,glass)*(1.-ca);glass=mix(vec3(L),glass,sat);gl_FragColor=vec4(clamp(glass,0.,1.),1.);}';
  function rgb(hex){var n=parseInt(hex.slice(1),16);return [((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255];}
  function shader(type,src){var s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
  function initGL(){
    uniforms={};
    gl=canvas.getContext('webgl',{alpha:false,antialias:false,preserveDrawingBuffer:true})||canvas.getContext('experimental-webgl',{alpha:false,preserveDrawingBuffer:true});
    if(!gl)throw Error('WebGL is unavailable in this browser.');
    program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,VS));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,FS));gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);var b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    var p=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,2,gl.FLOAT,false,0,0);
    ['res','tm','speed','warp','scale','zoom','gloss','react','ior','disp','thick','irid','mixv','spread','offset','angle','contrast','hue','sat','energy','bass','mid','treble','stops'].forEach(function(k){uniforms[k]=gl.getUniformLocation(program,k);});
  }
  function readAudio(){
    try{
      if(!analyser&&window.kefeAudioGraph){var graph=window.kefeAudioGraph.ensure();if(graph){analyser=graph.analyser;freq=new Uint8Array(analyser.frequencyBinCount);}}
      if(!analyser||!freq)return {bass:0,mid:0,treble:0};
      analyser.getByteFrequencyData(freq);var nyq=(window.kefeAudioGraph.context()?.sampleRate||44100)/2;
      function band(lo,hi){var a=Math.max(0,Math.floor(lo/nyq*freq.length)),b=Math.min(freq.length-1,Math.ceil(hi/nyq*freq.length)),sum=0;for(var i=a;i<=b;i++)sum+=freq[i];return Math.min(1,Math.pow((sum/Math.max(1,b-a+1))/255*2.6,1.3));}
      return {bass:band(20,250),mid:band(250,2000),treble:band(2000,12000)};
    }catch(e){return {bass:0,mid:0,treble:0};}
  }
  function draw(w,h,t){
    if(!gl)return;w=Math.max(2,w|0);h=Math.max(2,h|0);
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    gl.viewport(0,0,w,h);gl.useProgram(program);
    var a=readAudio(),energy=a.bass*.55+a.mid*.3+a.treble*.15;
    function f(k,v){gl.uniform1f(uniforms[k],v);}
    gl.uniform2f(uniforms.res,w,h);f('tm',t);({speed:'speed',warp:'warp',scale:'scale',zoom:'zoom',gloss:'gloss',react:'react',ior:'ior',disp:'dispersion',thick:'thickness',irid:'iridescence',mixv:'mix',spread:'spread',offset:'offset',angle:'angle',contrast:'contrast',hue:'hue',sat:'sat'} && Object.keys({speed:'speed',warp:'warp',scale:'scale',zoom:'zoom',gloss:'gloss',react:'react',ior:'ior',disp:'dispersion',thick:'thickness',irid:'iridescence',mixv:'mix',spread:'spread',offset:'offset',angle:'angle',contrast:'contrast',hue:'hue',sat:'sat'}).forEach(function(k){f(k,values[({speed:'speed',warp:'warp',scale:'scale',zoom:'zoom',gloss:'gloss',react:'react',ior:'ior',disp:'dispersion',thick:'thickness',irid:'iridescence',mixv:'mix',spread:'spread',offset:'offset',angle:'angle',contrast:'contrast',hue:'hue',sat:'sat'})[k]]);}));
    f('energy',energy);f('bass',a.bass*values.react);f('mid',a.mid*values.react);f('treble',a.treble*values.react);
    var flat=[];palettes[paletteIndex].c.forEach(function(c){flat=flat.concat(rgb(c));});gl.uniform3fv(uniforms.stops,new Float32Array(flat));gl.drawArrays(gl.TRIANGLES,0,3);
  }
  function active(){var h=document.getElementById('kefeVisualiserHeading'),p=document.querySelector('.kefe-visualiser-panel-head .kefe-switch');return enabled&&(!p||p.getAttribute('aria-checked')!=='false')&&(!h||h.textContent.indexOf('Gradient')!==-1);}
  function frame(now){raf=0;if(document.hidden)return;var stage=document.querySelector('.kefe-stage');if(stage&&canvas){var r=stage.getBoundingClientRect();if(r.width>1&&r.height>1){canvas.style.display=active()?'block':'none';if(active()){var scale=Math.min(devicePixelRatio||1,1400/Math.max(r.width,r.height));draw(Math.round(r.width*scale),Math.round(r.height*scale),(now-start)/1000);}}}raf=requestAnimationFrame(frame);}
  function setPreset(id){if(!presets[id])return;preset=id;Object.assign(values,presets[id]);syncSliders();document.querySelectorAll('[data-liquid-preset]').forEach(function(b){b.classList.toggle('primary',b.dataset.liquidPreset===id);});}
  var sliderDefs=[['speed','Speed',0,3,.01],['scale','Detail',.3,4,.01],['warp','Swirl',0,3,.01],['gloss','Shine',0,1.5,.01],['react','Audio React',0,4,.01],['mix','Palette Mix',0,1,.01],['zoom','Zoom',.3,3,.01]];
  var advDefs=[['ior','IOR',1,2.5,.01],['dispersion','Dispersion',0,.15,.001],['thickness','Thickness',0,1.5,.01],['iridescence','Iridescence',0,1.5,.01],['spread','Gradient spread',.2,3,.01],['offset','Gradient offset',-1,1,.01],['angle','Gradient angle',-180,180,1],['contrast','Gradient contrast',.3,3,.01],['hue','Hue',-180,180,1],['sat','Saturation',0,2,.01]];
  function buildControls(view){
    var wrap=document.createElement('div');wrap.className='kefe-liquid-flow-controls';
    var presetRow=document.createElement('div');presetRow.className='kefe-liquid-presets';
    [['silk','Silk','Smooth · flowing · iridescent'],['chrome','Chrome','Sharp glass · metallic highlights'],['nebula','Nebula','Dreamy · huge · warm'],['pulse','Pulse','Fast · punchy · colour flashing']].forEach(function(p){var b=document.createElement('button');b.type='button';b.className='kefe-btn';b.dataset.liquidPreset=p[0];b.innerHTML='<strong>'+p[1]+'</strong><small>'+p[2]+'</small>';b.addEventListener('click',function(){setPreset(p[0]);});presetRow.appendChild(b);});wrap.appendChild(presetRow);
    function addSliders(parent,defs){defs.forEach(function(d){var row=document.createElement('label');row.className='kefe-visualiser-field';var head=document.createElement('span'),title=document.createElement('b'),out=document.createElement('output'),input=document.createElement('input');title.textContent=d[1];input.type='range';input.min=d[2];input.max=d[3];input.step=d[4];input.dataset.liquidKey=d[0];out.dataset.liquidOut=d[0];head.appendChild(title);head.appendChild(out);input.addEventListener('input',function(){var key=d[0];values[key]=Number(input.value);out.textContent=Number(input.value).toFixed(d[4]<1?2:1);});row.appendChild(head);row.appendChild(input);parent.appendChild(row);});}
    var main=document.createElement('div');main.className='kefe-liquid-main-controls';addSliders(main,sliderDefs);wrap.appendChild(main);
    var advBtn=document.createElement('button');advBtn.type='button';advBtn.className='kefe-btn';advBtn.textContent='Advanced ▾';var adv=document.createElement('div');adv.className='kefe-liquid-advanced';adv.hidden=true;addSliders(adv,advDefs);advBtn.addEventListener('click',function(){advanced=!advanced;adv.hidden=!advanced;advBtn.textContent=advanced?'Advanced ▴':'Advanced ▾';});wrap.appendChild(advBtn);wrap.appendChild(adv);
    view.appendChild(wrap);syncSliders();
  }
  function syncSliders(){document.querySelectorAll('[data-liquid-key]').forEach(function(input){var k=input.dataset.liquidKey;input.value=values[k]??values.mix;});document.querySelectorAll('[data-liquid-out]').forEach(function(out){var k=out.dataset.liquidOut;out.textContent=Number(values[k]??values.mix).toFixed(2);});}
  function init(){
    var stage=document.querySelector('.kefe-stage'),view=document.getElementById('kefeVisGradientView');if(!stage||!view)return;
    var old=document.getElementById('kefeGradientCanvas');
    canvas=document.createElement('canvas');canvas.id='kefeLiquidFlowCanvas';canvas.setAttribute('aria-hidden','true');canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1;';
    try{initGL();}catch(e){var error=document.createElement('p');error.className='kefe-liquid-error';error.textContent='Liquid Flow could not start: '+e.message;view.appendChild(error);return;}
    if(old)old.remove();stage.insertBefore(canvas,document.getElementById('kefeCanvas')||null);
    var intro=view.querySelector('.kefe-visualiser-intro');Array.from(view.children).forEach(function(child){if(child!==intro)child.remove();});
    buildControls(view);setPreset('silk');
    var paletteStrip=document.querySelector('#kefeGradientPresetSet .kefe-gradient-palettes');
    if(paletteStrip){
      Array.from(paletteStrip.children).forEach(function(button,i){
        if(!palettes[i])return;
        button.style.background='linear-gradient(90deg,'+palettes[i].c.join(',')+')';
        button.title=palettes[i].name;button.setAttribute('aria-label',palettes[i].name+' palette');
        button.addEventListener('click',function(){paletteIndex=i;});
      });
    }
    var gradientIntro=view.querySelector('.kefe-visualiser-intro'),randomButton=gradientIntro&&gradientIntro.querySelector('button');
    if(randomButton)randomButton.addEventListener('click',function(){window.kefeGradientLayer.randomize();});
    if(gradientIntro){var introTitle=gradientIntro.querySelector('strong'),introText=gradientIntro.querySelector('span');if(introTitle)introTitle.textContent='Liquid Flow';if(introText)introText.textContent='Audio-reactive liquid glass presets and controls.'}
    var style=document.createElement('style');style.textContent='.kefe-liquid-flow-controls{display:flex;flex-direction:column;gap:12px;margin-top:12px}.kefe-liquid-presets{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.kefe-liquid-presets button{display:flex;flex-direction:column;align-items:flex-start;gap:4px;text-align:left;min-width:0;height:auto;padding:10px;border:1px solid var(--line);border-radius:12px;background:var(--surface);white-space:normal}.kefe-liquid-presets button strong{font-size:13px}.kefe-liquid-presets button small{font-size:11px;line-height:1.3;color:var(--muted)}.kefe-liquid-palettes{display:flex;gap:6px;padding:6px;border:1px solid var(--line-soft);border-radius:10px}.kefe-liquid-swatch{flex:1;min-width:0;height:18px;border:1px solid var(--line);border-radius:5px;padding:0}.kefe-liquid-swatch.selected{outline:2px solid var(--text);outline-offset:1px}.kefe-liquid-main-controls,.kefe-liquid-advanced{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.kefe-liquid-advanced{margin-top:10px}.kefe-liquid-advanced[hidden]{display:none}.kefe-liquid-flow-controls .kefe-btn{max-width:100%}.kefe-liquid-error{padding:10px;color:#a22}@media(max-width:560px){.kefe-liquid-main-controls,.kefe-liquid-advanced{grid-template-columns:repeat(2,minmax(0,1fr))}.kefe-liquid-presets button{padding:8px}.kefe-liquid-presets button small{font-size:10px}}';document.head.appendChild(style);

    window.kefeGradientLayer={
      paint:function(ctx,w,h,t){if(!active()||!gl)return;draw(w,h,Number(t)||0);try{ctx.drawImage(canvas,0,0,w,h);}catch(e){}},
      render:function(ctx,w,h,t){if(gl)draw(w,h,Number(t)||0);if(ctx)ctx.drawImage(canvas,0,0,w,h);},
      state:function(){return {on:active(),preset:preset,palette:palettes[paletteIndex].name,values:Object.assign({},values)};},
      isOn:active,randomize:function(){var ids=Object.keys(presets);setPreset(ids[Math.floor(Math.random()*ids.length)]);}
    };
    window.kefeLiquidFlow={setPreset:setPreset,paint:window.kefeGradientLayer.paint};
    if(raf)cancelAnimationFrame(raf);raf=requestAnimationFrame(frame);
    document.addEventListener('visibilitychange',function(){if(!document.hidden&&!raf)raf=requestAnimationFrame(frame);});
    window.addEventListener('kefe-stage-resize',function(){if(canvas&&stage){var r=stage.getBoundingClientRect();var scale=Math.min(devicePixelRatio||1,1400/Math.max(r.width,r.height));draw(Math.round(r.width*scale),Math.round(r.height*scale),(performance.now()-start)/1000);}});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();