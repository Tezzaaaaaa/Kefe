/* KEFE Slow Light — faithful WebGL integration of the supplied Slow Light source.
   Uses KEFE's shared audio graph and export compositor; no second audio player. */
(function () {
  'use strict';
  const SCENES = [
    {name:'Ember',swirl:1.5,warp:.24,scale:1,sharp:2,glow:.5,grain:1,hue:30,orb:[.5,-.8,.7],orbCol:[1,.7,.4],P:[[-.4,.85,1.7],[.1,.55,1],[-.45,-.1,1.3],[.45,-.25,1],[.4,-.8,1.2],[-.1,-.95,1]],C:[[.02,.09,.11],[.06,.36,.38],[.55,.08,.07],[.95,.28,.1],[1,.55,.2],[1,.78,.45]]},
    {name:'Moonrise',swirl:1.2,warp:.2,scale:1,sharp:2.1,glow:.45,grain:.85,hue:34,orb:[0,.15,.65],orbCol:[1,.6,.3],P:[[0,.9,1.9],[-.35,.35,1],[.4,.2,1],[0,-.25,1.1],[-.3,-.8,1],[.5,-.85,1]],C:[[.01,.01,.04],[.04,.16,.62],[.4,.78,.95],[.86,.8,.96],[.96,.7,.88],[1,.55,.25]]},
    {name:'Dusk Sun',swirl:1.4,warp:.18,scale:1,sharp:2,glow:.6,grain:.6,hue:32,orb:[.1,-.25,.6],orbCol:[1,.75,.3],P:[[0,.9,1],[-.4,.4,1],[.35,.35,1],[.1,-.05,1],[0,-.35,1.1],[0,-.95,1.5]],C:[[.26,.4,.78],[.45,.3,.7],[.2,.3,.7],[.93,.42,.68],[1,.78,.15],[.12,.02,.12]]},
    {name:'Cobalt',swirl:2.4,warp:.22,scale:1.1,sharp:1.9,glow:0,grain:1.2,hue:38,orb:[0,0,.6],orbCol:[1,1,1],P:[[-.5,.7,1],[.45,.55,1],[0,.1,1.5],[-.35,-.3,1],[.45,-.5,1],[-.1,-.9,1]],C:[[.03,.2,.68],[.6,.86,1],[.02,.1,.45],[1,.95,.9],[.96,.42,.12],[.06,.32,.8]]},
    {name:'Peach',swirl:2.2,warp:.26,scale:1,sharp:2,glow:.2,grain:1.1,hue:34,orb:[-.1,.05,.6],orbCol:[1,.7,.5],P:[[-.4,.6,1],[.35,.45,1],[0,0,1.6],[-.35,-.5,1],[.4,-.65,1],[0,.95,1]],C:[[1,.52,.6],[.1,.62,.56],[.03,.09,.1],[.97,.3,.25],[1,.62,.1],[.96,.9,.75]]}
  ];
  const VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  const FS = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH','precision highp float;','#else','precision mediump float;','#endif',
    'uniform vec2 uRes;','uniform float uUnit,uDpr,uT,uExp,uSwirl,uWarp,uScale,uSharp,uGlow,uGrain;',
    'uniform vec3 uP[6];','uniform vec3 uCol[6];','uniform vec3 uOrb;','uniform vec3 uOrbCol;',
    'float hash(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}',
    'vec2 warp(vec2 q,float t,float a){',
    'q+=a*vec2(sin(q.y*1.9+t*.37)+.6*sin(q.y*3.7-t*.29+1.7),sin(q.x*1.7-t*.33+2.1)+.6*sin(q.x*3.3+t*.23));',
    'q+=a*.6*vec2(sin(q.y*2.7-t*.21+.5),sin(q.x*2.3+t*.27+4.));return q;}',
    'vec2 twist(vec2 q,float k,float t){float r=length(q);float a=k*exp(-r*r*.45)+.12*sin(t*.2+r*3.);float c=cos(a),s=sin(a);return vec2(c*q.x+s*q.y,-s*q.x+c*q.y);}',
    'void main(){vec2 px=gl_FragCoord.xy;vec2 p=(px-.5*uRes)/uUnit;float t=uT;vec2 q=warp(twist(p*uScale,uSwirl,t),t,uWarp);',
    'vec3 acc=vec3(0.);float ws=0.;for(int i=0;i<6;i++){vec2 d=q-uP[i].xy;float w=uP[i].z/pow(dot(d,d)+.06,uSharp);acc+=w*uCol[i];ws+=w;}',
    'vec3 col=acc/ws;vec2 od=(q-uOrb.xy)/uOrb.z;col+=uOrbCol*uGlow*exp(-dot(od,od)*1.1);',
    'float l0=dot(col,vec3(.2126,.7152,.0722));col=mix(vec3(l0),col,1.1)*uExp;col=mix(col,col*col*(3.-2.*col),.35);',
    'vec2 gp=floor(px/max(uDpr,1.));float g=hash(gp)+hash(gp+17.3)-1.;vec3 gc=vec3(g)+(vec3(hash(gp+3.1),hash(gp+9.7),hash(gp+5.5))-.5)*.5;',
    'float lum=dot(col,vec3(.3,.59,.11));col+=gc*uGrain*(.035+.05*(1.-abs(lum-.45)*1.3));gl_FragColor=vec4(clamp(col,0.,1.),1.);}'
  ].join('\n');
  const defaults = {react:1,flow:1,grain:1,len:28,drift:1,auto:true};
  let cfg = {...defaults};
  try { const saved=JSON.parse(localStorage.getItem('kefe.slowLight.v1')||'null'); if(saved)cfg={...cfg,...saved}; } catch (_) {}
  const reducedMotion = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let stage,canvas,gl,program,locations={},enabled=false,active=false,raf=0,last=0,t=0,colourTime=0,hold=0,index=0,from=SCENES[0],to=SCENES[0],morph=1,morphDuration=12,current;
  let width=2,height=2,dpr=1,tick=0,audioBins=null,smoothed={bass:.4,low:.4,mid:.4,high:.3,cent:.5},peak={bass:.1,low:.1,mid:.1,high:.1};
  const pBuffer=new Float32Array(18),cBuffer=new Float32Array(18);
  const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
  const ease=x=>{x=clamp(x);return x*x*x*(x*(x*6-15)+10)};
  const mix=(a,b,f)=>a+(b-a)*f;
  const blend=(a,b,f)=>{
    const g=ease(f/.92),c=ease((f-.08)/.92),o={name:b.name};
    ['swirl','warp','scale','sharp','glow','grain','hue'].forEach(k=>o[k]=mix(a[k],b[k],g));
    o.orb=[0,1,2].map(i=>mix(a.orb[i],b.orb[i],g));
    o.orbCol=[0,1,2].map(i=>mix(a.orbCol[i],b.orbCol[i],c));
    o.P=a.P.map((p,i)=>[mix(p[0],b.P[i][0],g),mix(p[1],b.P[i][1],g),mix(p[2],b.P[i][2],g)]);
    o.C=a.C.map((p,i)=>[mix(p[0],b.C[i][0],c),mix(p[1],b.C[i][1],c),mix(p[2],b.C[i][2],c)]);
    return o;
  };
  const rgb2hsl=c=>{
    const [r,g,b]=c,mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,d=mx-mn;let h=0,s=0;
    if(d>1e-6){s=l>.5?d/(2-mx-mn):d/(mx+mn);if(mx===r)h=(g-b)/d+(g<b?6:0);else if(mx===g)h=(b-r)/d+2;else h=(r-g)/d+4;h/=6;}
    return [h,s,l];
  };
  const hue2=(p,q,x)=>{if(x<0)x+=1;if(x>1)x-=1;if(x<1/6)return p+(q-p)*6*x;if(x<.5)return q;if(x<2/3)return p+(q-p)*(2/3-x)*6;return p;};
  const hsl2rgb=(h,s,l)=>{if(s<1e-6)return [l,l,l];const q=l<.5?l*(1+s):l+s-l*s,p=2*l-q;return [hue2(p,q,h+1/3),hue2(p,q,h),hue2(p,q,h-1/3)];};
  function compile(type,source){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){console.error('[KEFE Slow Light shader]',gl.getShaderInfoLog(shader));gl.deleteShader(shader);return null;}return shader;}
  function build(){
    const vs=compile(gl.VERTEX_SHADER,VS),fs=compile(gl.FRAGMENT_SHADER,FS);if(!vs||!fs)return false;
    const next=gl.createProgram();gl.attachShader(next,vs);gl.attachShader(next,fs);gl.linkProgram(next);
    gl.deleteShader(vs);gl.deleteShader(fs);
    if(!gl.getProgramParameter(next,gl.LINK_STATUS)){console.error('[KEFE Slow Light program]',gl.getProgramInfoLog(next));gl.deleteProgram(next);return false;}
    if(program)gl.deleteProgram(program);program=next;gl.useProgram(program);
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    const attr=gl.getAttribLocation(program,'a');gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,2,gl.FLOAT,false,0,0);
    ['uRes','uUnit','uDpr','uT','uExp','uSwirl','uWarp','uScale','uSharp','uGlow','uGrain','uP','uCol','uOrb','uOrbCol'].forEach(k=>locations[k]=gl.getUniformLocation(program,k));
    return true;
  }
  function resize(){
    if(!canvas||!stage)return;
    const r=stage.getBoundingClientRect();dpr=Math.min(window.devicePixelRatio||1,2);
    width=Math.max(2,Math.round((r.width||2)*dpr));height=Math.max(2,Math.round((r.height||2)*dpr));
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
    gl?.viewport(0,0,width,height);
  }
  function audio(dt){
    const analyser=window.kefeAudioGraph?.analyser?.();let target;
    if(analyser){
      if(!audioBins||audioBins.length!==analyser.frequencyBinCount)audioBins=new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(audioBins);
      const hz=(analyser.context?.sampleRate||48000)/(analyser.fftSize||2048);
      const band=(lo,hi)=>{const a=Math.max(1,Math.floor(lo/hz)),b=Math.min(audioBins.length-1,Math.ceil(hi/hz));let sum=0;for(let i=a;i<=b;i++)sum+=audioBins[i];return sum/(Math.max(1,b-a+1)*255);};
      const raw={bass:band(30,140),low:band(140,500),mid:band(500,2200),high:band(2200,9000)};
      const centroidBins=Math.min(audioBins.length,Math.floor(8000/hz));let num=0,den=0;
      for(let i=2;i<centroidBins;i++){num+=i*hz*audioBins[i];den+=audioBins[i];}
      target={cent:clamp(Math.log(Math.max(den?num/den:400,1)/200)/Math.log(2)/4)};
      Object.keys(raw).forEach(k=>{peak[k]=Math.max(raw[k],peak[k]*Math.exp(-dt/30),.06);target[k]=Math.pow(clamp(raw[k]/peak[k]),1.3);});
    }else{
      target={bass:.48+.28*Math.sin(tick*.48),low:.45+.25*Math.sin(tick*.37+1.3),mid:.42+.2*Math.sin(tick*.31+2.1),high:.34+.15*Math.sin(tick*.53+.4),cent:.5+.2*Math.sin(tick*.11)};
    }
    Object.keys(smoothed).forEach(k=>{const tc=target[k] > smoothed[k] ? 0.9 : 2.4;smoothed[k]+= (target[k]-smoothed[k])*(1-Math.exp(-dt/tc));});
  }
  function goTo(next,duration=6){if(next===index&&morph>=1)return;from=current;to=SCENES[next];index=next;morph=0;hold=0;morphDuration=reducedMotion?duration*1.6:duration;syncScene();}
  function syncScene(){if(!ui)return;ui.sceneName.textContent=SCENES[index].name;ui.sceneButtons.forEach((b,i)=>{b.classList.toggle('primary',i===index);b.setAttribute('aria-pressed',String(i===index));});}
  function frame(now){
    raf=0;if(!shown()||!gl||!program||document.hidden)return;
    const dt=Math.min(.1,Math.max(0,(now-(last||now))/1000));last=now;tick+=dt;audio(dt);
    if(morph<1){morph=Math.min(1,morph+dt/morphDuration);current=blend(from,to,morph);}
    else if(cfg.auto){hold+=dt;if(hold>=cfg.len)goTo((index+1)%SCENES.length,Math.min(16,Math.max(8,cfg.len*.5)));}
    const b=smoothed,re=cfg.react,dr=cfg.drift,mo=reducedMotion ? 0.5 : 1,level=b.bass*.4+b.low*.3+b.mid*.2+b.high*.1;
    t+=dt*cfg.flow*mo*(.55+.75*re*(b.low*.6+b.mid*.4))*.8;colourTime+=dt*cfg.flow*mo*(.8+.9*re*b.cent);
    const c=current,U=Math.min(width,height)*(width<height?1:.85),aspect=Math.max(1,width/U);
    for(let i=0;i<6;i++){
      const bp=c.P[i],A=.2+.05*(i%3),bd=b[['bass','low','mid','high'][i%4]];
      pBuffer[i*3]=(bp[0]+A*Math.sin(t*(.10+.031*i)+i*1.7)*(1+.5*re*b.bass))*aspect;
      pBuffer[i*3+1]=bp[1]+A*1.25*Math.cos(t*(.08+.027*i)+i*2.3)*(1+.5*re*b.bass);
      pBuffer[i*3+2]=bp[2]*(1+re*.6*(bd-.4));
      const hsl=rgb2hsl(c.C[i]),hh=((hsl[0]+c.hue/360*dr*Math.sin(colourTime*(.06+.018*i)+i*2.1)+dr*.035*Math.sin(colourTime*.023+.7))%1+1)%1;
      const ss=clamp(hsl[1]*(1+.14*dr*Math.sin(colourTime*(.07+.011*i)+i)),0,1),ll=clamp(hsl[2]+.06*dr*Math.sin(colourTime*(.05+.017*i)+i*1.3),.01,.95),rgb=hsl2rgb(hh,ss,ll);
      cBuffer[i*3]=clamp(rgb[0]);cBuffer[i*3+1]=clamp(rgb[1]);cBuffer[i*3+2]=clamp(rgb[2]);
    }
    gl.useProgram(program);gl.uniform2f(locations.uRes,width,height);gl.uniform1f(locations.uUnit,U);gl.uniform1f(locations.uDpr,dpr);gl.uniform1f(locations.uT,t);
    gl.uniform3fv(locations.uP,pBuffer);gl.uniform3fv(locations.uCol,cBuffer);
    gl.uniform3f(locations.uOrb,(c.orb[0]+.05*Math.sin(t*.07))*aspect,c.orb[1]+.04*Math.cos(t*.06),c.orb[2]*(1+re*.25*(level-.4)));
    gl.uniform3f(locations.uOrbCol,...c.orbCol.map(v=>clamp(v)));gl.uniform1f(locations.uGlow,c.glow*.75*(.8+re*.5*level));
    gl.uniform1f(locations.uSwirl,c.swirl*(1+re*.6*(b.low-.3)));gl.uniform1f(locations.uWarp,Math.max(0,c.warp*(1+re*.6*(b.bass-.35))));
    gl.uniform1f(locations.uScale,c.scale);gl.uniform1f(locations.uSharp,c.sharp);gl.uniform1f(locations.uExp,1+re*.06*(level-.4));gl.uniform1f(locations.uGrain,c.grain*cfg.grain);
    gl.drawArrays(gl.TRIANGLES,0,3);raf=requestAnimationFrame(frame);
  }
  let ui=null;
  function persist(){try{localStorage.setItem('kefe.slowLight.v1',JSON.stringify(cfg));}catch(_){}}
  function field(label,key,min,max,step,format){
    const wrap=document.createElement('label');wrap.className='kefe-visualiser-field';
    const head=document.createElement('span'),name=document.createElement('b'),out=document.createElement('output'),input=document.createElement('input');
    name.textContent=label;input.type='range';input.min=min;input.max=max;input.step=step;input.value=cfg[key];out.textContent=format(Number(cfg[key]));head.append(name,out);wrap.append(head,input);
    input.addEventListener('input',()=>{cfg[key]=Number(input.value);out.textContent=format(cfg[key]);persist();});
    return wrap;
  }
  function init(){
    const tabs=document.querySelector('.kefe-vis-tabs'),form=document.querySelector('.kefe-visualiser-form');
    stage=document.querySelector('.kefe-stage');
    if(!tabs||!form||!stage){console.error('[KEFE Slow Light] Required preview or controls are missing.');return;}
    canvas=document.createElement('canvas');canvas.id='kefeSlowLightCanvas';canvas.setAttribute('aria-label','Slow Light visualiser output');
    Object.assign(canvas.style,{position:'absolute',inset:'0',width:'100%',height:'100%',display:'none',opacity:'0.56',zIndex:'2',pointerEvents:'none',borderRadius:'0'});
    const lyric=document.getElementById('kefeCanvas');stage.insertBefore(canvas,lyric||null);
    gl=canvas.getContext('webgl',{antialias:false,alpha:false,powerPreference:'high-performance'});
    if(!gl||!build()){canvas.remove();console.error('[KEFE Slow Light] WebGL initialization failed.');return;}
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();if(raf)cancelAnimationFrame(raf);raf=0;gl=null;});
    canvas.addEventListener('webglcontextrestored',()=>{gl=canvas.getContext('webgl',{antialias:false,alpha:false,powerPreference:'high-performance'});if(gl&&build()){resize();if(shown())start();}});
    const view=document.createElement('section');view.className='kefe-vis-view kefe-slow-light-view';view.id='kefeVisSlowLightView';view.hidden=true;
    const intro=document.createElement('div');intro.className='kefe-visualiser-intro';intro.hidden=true;
    /* The power switch lives in the panel header (same pattern as Fluted Glass) so the header
       switch always controls the visualiser that is actually selected. */
    const power=document.createElement('button');power.type='button';power.className='kefe-btn kefe-switch kefe-slow-light-power';power.setAttribute('role','switch');power.setAttribute('aria-checked','false');power.setAttribute('aria-label','Slow Light Visualiser');
    const powerState=document.createElement('span');powerState.className='kefe-switch-state';powerState.textContent='Off';
    const powerTrack=document.createElement('span');powerTrack.className='kefe-switch-track';powerTrack.setAttribute('aria-hidden','true');
    const powerThumb=document.createElement('span');powerThumb.className='kefe-switch-thumb';powerTrack.appendChild(powerThumb);power.append(powerState,powerTrack);
    power.addEventListener('click',e=>{e.stopPropagation();setEnabled(!enabled);});view.appendChild(intro);
    ui={sceneName:document.createElement('span'),sceneButtons:[],power,powerState};
    const presetRow=document.querySelector('.kefe-visualiser-preset-row');
    const sceneSet=document.createElement('div');sceneSet.className='kefe-visualiser-preset-set';sceneSet.id='kefeSlowLightPresetSet';sceneSet.hidden=true;
    const sceneRow=document.createElement('div');sceneRow.className='kefe-slow-light-scenes';
    SCENES.forEach((scene,i)=>{const b=document.createElement('button');b.type='button';b.className='kefe-btn';b.dataset.scene=scene.name.toLowerCase().replace(/\\s+/g,'-');b.textContent=scene.name;b.addEventListener('click',()=>goTo(i,6));sceneRow.appendChild(b);ui.sceneButtons.push(b);});
    sceneSet.appendChild(sceneRow);if(presetRow)presetRow.appendChild(sceneSet);
    const motion=document.createElement('div');motion.className='kefe-visualiser-control-group';const motionHead=document.createElement('div');motionHead.className='kefe-label';motionHead.textContent='Motion and texture';motion.appendChild(motionHead);
    motion.append(field('Audio reactivity','react',0,2,.05,v=>v.toFixed(2)+'×'));
    motion.append(field('Flow speed','flow',0.2,2,.05,v=>v.toFixed(2)+'×'));
    motion.append(field('Colour drift','drift',0,2,.05,v=>v.toFixed(2)+'×'));
    motion.append(field('Film grain','grain',0,1.6,.05,v=>v.toFixed(2)+'×'));
    motion.append(field('Seconds per scene','len',10,120,2,v=>Math.round(v)+'s'));
    const auto=document.createElement('label');auto.className='kefe-slow-light-auto';const check=document.createElement('input');check.type='checkbox';check.checked=!!cfg.auto;const copy=document.createElement('span');copy.textContent='Change scenes automatically';check.addEventListener('change',()=>{cfg.auto=check.checked;hold=0;persist();});auto.append(check,copy);motion.append(auto);view.appendChild(motion);
    const tabsList=tabs.querySelector('[role="tablist"]')||tabs;
    const tab=document.createElement('button');tab.type='button';tab.className='kefe-btn';tab.setAttribute('role','tab');tab.dataset.visualiser='slow-light';tab.dataset.icon='☼';tab.setAttribute('aria-controls',view.id);tab.setAttribute('aria-label','Slow Light visualiser');tab.title='Slow Light visualiser';tab.textContent='Slow Light';tabsList.appendChild(tab);
    const option=document.createElement('div');option.className='kefe-vis-option';option.appendChild(tab);tabsList.appendChild(option);
    form.appendChild(view);
    tabsList.addEventListener('click',e=>{const clicked=e.target.closest('[role="tab"]');if(clicked&&clicked!==tab){setActive(false);sceneSet.hidden=true;}});
    tab.addEventListener('click',()=>{
      const powerSlot=document.getElementById('kefeVisualiserPowerSlot');if(powerSlot)powerSlot.replaceChildren(power);
      form.querySelectorAll('.kefe-vis-view').forEach(v=>v.hidden=v!==view);
      tabs.querySelectorAll('[role="tab"]').forEach(b=>{const selected=b===tab;b.classList.toggle('primary',selected);b.setAttribute('aria-selected',String(selected));});
      const presetRow=document.querySelector('.kefe-editing > .kefe-visualiser-preset-row');if(presetRow)presetRow.hidden=false;
      presetRow?.querySelectorAll('.kefe-visualiser-preset-set').forEach(set=>set.hidden=set!==sceneSet);
      const heading=document.getElementById('kefeVisualiserHeading'),description=document.getElementById('kefeVisualiserDescription');
      if(heading)heading.textContent='Slow Light';if(description)description.textContent='';
      setActive(true);
    });
    tabsList.appendChild(option);
    ui.sceneName.textContent=SCENES[0].name;current=blend(from,to,1);syncScene();resize();

    window.addEventListener('resize',resize);window.addEventListener('kefe-stage-resize',resize);
    document.addEventListener('visibilitychange',()=>{if(document.hidden){if(raf)cancelAnimationFrame(raf);raf=0;}else if(shown())start();});
    /* getState().enabled means "Slow Light is the visible preview" (export picks its canvas from it). */
    window.kefeSlowLight={setEnabled,setActive,setScene:i=>goTo(clamp(Math.floor(i),0,SCENES.length-1)),getState:()=>({enabled:shown(),power:enabled,active,scene:SCENES[index].name,settings:{...cfg}}),canvas:()=>canvas};
  }
  function shown(){return enabled&&active;}
  function start(){if(!shown()||!gl||raf||document.hidden)return;last=performance.now();raf=requestAnimationFrame(frame);}
  function sync(){
    if(canvas)canvas.style.display=shown()?'block':'none';
    if(ui){ui.powerState.textContent=enabled?'On':'Off';ui.power.classList.toggle('is-on',enabled);ui.power.setAttribute('aria-checked',String(enabled));}
    if(shown()){resize();start();}else{if(raf)cancelAnimationFrame(raf);raf=0;last=0;}
    window.dispatchEvent(new CustomEvent('kefe-slow-light-change',{detail:{enabled:shown(),power:enabled,active}}));
  }
  function setEnabled(value){enabled=!!value;sync();}
  function setActive(value){active=!!value;sync();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();