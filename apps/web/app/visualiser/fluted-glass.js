/* KEFE Glass Lens — dedicated WebGL layer and fourth visualiser tab. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const MODES=[
{name:'Prism facets',desc:'Precision-cut crystalline facets with angular light splitting.',keys:['cellSize','relief','depth','angle','dispersion','sheen']},
{name:'Fluted reeds',desc:'Vertical reeded glass: every flute stretches the scene into a soft ribbon with a bright face and a dark shadowed edge.',keys:['cellSize','relief','depth','angle','dispersion','sheen']},
{name:'Grid flat',desc:'Sharp grid cells with edge-focused distortion.',keys:['cellSize','relief','depth','angle','dispersion']},
{name:'Satin crystal',desc:'Fine etched glass with controlled frosted diffusion and soft refraction.',keys:['cellSize','relief','depth','dispersion','sheen','grain']},
{name:'Zigzag',desc:'Reeds whose distortion follows a repeating zigzag.',keys:['cellSize','relief','depth','angle','dispersion','sheen']},
{name:'Waves',desc:'Smooth, rolling refractive waves.',keys:['cellSize','relief','depth','angle','dispersion','sheen']}
];
const D={cellSize:['Cell size',10,300,79],relief:['Relief',0,300,130],depth:['Depth',0,200,152],angle:['Angle',0,360,110],dispersion:['Dispersion',0,200,54],sheen:['Sheen',0,200,32],grain:['Micro texture',0,200,68]};
const DEF={1:{cellSize:34,relief:150,depth:160,angle:0,dispersion:40,sheen:60}};
const P=MODES.map((m,i)=>Object.fromEntries(m.keys.map(k=>[k,(DEF[i]&&DEF[i][k]!==undefined)?DEF[i][k]:D[k][3]])));
const VERT='attribute vec2 a_pos;varying vec2 v_uv;void main(){v_uv=a_pos*.5+.5;gl_Position=vec4(a_pos,0.,1.);}';
const FRAG=String.raw`precision highp float;
varying vec2 v_uv;
uniform sampler2D uImg;
uniform vec2 uRes,uSiz;
uniform int uMod;
uniform float uCel,uRel,uDep,uAng,uDis,uShe,uGrn,uTim,uMot;
mat2 rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);}
vec2 fit(vec2 uv){float ca=uRes.x/uRes.y,ia=uSiz.x/uSiz.y;vec2 s=vec2(1.);if(ca>ia)s.y=ia/ca;else s.x=ca/ia;return(uv-.5)*s+.5;}
float sdB(vec2 p,vec2 b,float r){vec2 d=abs(p)-b+r;return min(max(d.x,d.y),0.)+length(max(d,0.))-r;}
vec2 mv(vec2 uv,float t){vec2 c=uv-.5;float M=uMot;float bz=(sin(t*.62)*.55+sin(t*.29+1.7)*.3+sin(t*1.13+.4)*.15)*.12*M;float B=0.,P=0.;
if(uMod==0){c=rot(t*.08)*c;c.x+=sin(t*.36)*.025*M;c.y+=cos(t*.31)*.022*M;B=.22;P=.3;}
else if(uMod==1){c=rot(t*.06)*c;c.x+=sin(t*.33)*.035*M;c.y+=cos(t*.27)*.035*M;B=.2;P=.28;}
else if(uMod==2){float r=length(c);c*=1.+sin(r*14.-t*2.8)*.028*M;B=.26;P=.38;}
else if(uMod==3){c.x+=sin(t*.42+c.y*3.)*.012*M;c.y+=cos(t*.35+c.x*3.)*.012*M;c=rot(sin(t*.12)*.12*M)*c;B=.12;P=.16;}
else if(uMod==4){c.x+=sin(t*.48)*.055*M;c.y+=sin(t*.48+1.5707)*.055*M;c=rot(sin(t*.7)*.15*M)*c;B=.1;P=.24;}
else{c.y+=sin(t*.95)*.055*M;c.x+=cos(t*.62)*.045*M;c=rot(sin(t*.28)*.35*M)*c;B=.2;P=.15;}
c/=max(1.,1.12+bz);
if(uMod==0){c.x+=sin(t*42.)*M*.006;c.y+=cos(t*38.)*M*.006;}else if(uMod==1)c.x+=sin(t*44.)*M*.005;else if(uMod==2)c*=1.+sin(length(c)*55.+t*5.)*M*.008;else if(uMod==3)c.x+=sin(t*36.+c.y*3.)*M*.007;else if(uMod==4)c.y+=cos(t*50.)*M*.01;else c.y+=sin(c.x*8.+t*3.)*M*.008;return c+.5;}
float surfaceHeight(vec2 uv){
float a=radians(uAng);vec2 p=rot(a)*(uv-.5);float fp=max(2.,uSiz.x/max(1.,uCel));
float h=0.;
if(uMod==0){vec2 q=vec2(p.x*fp,p.y*fp*1.1547);q.x+=mod(floor(q.y),2.)*.5;vec2 g=fract(q)-.5;float d=max(abs(g.y),abs(g.x)*.8660254+abs(g.y)*.5);float facet=1.-smoothstep(.18,.48,d);float ridge=1.-smoothstep(.015,.065,abs(d-.29));h=facet*.78+ridge*.22;h+=.035*sin((g.x-g.y)*18.+uTim*.2);}
else if(uMod==1){h=.5;}
else if(uMod==2){vec2 g=fract(p*fp)-.5;float edge=max(abs(g.x),abs(g.y));h=1.-smoothstep(.29,.49,edge);h-=.22*smoothstep(.25,.49,edge);}
else if(uMod==3){float scale=max(3.,fp*.72);vec2 g=p*scale;float etched=sin(g.x*2.1+sin(g.y*1.3)*.7)*.42+cos(g.y*2.6-g.x*.8)*.34;float micro=sin(g.x*17.+sin(g.y*11.)*1.7)*cos(g.y*15.-g.x*9.);h=etched*.42+micro*(uGrn/200.)*.12;h+=.025*sin(g.x*31.+g.y*23.)*(uGrn/200.);}
else if(uMod==4){float x=p.x*fp*3.1415926;float z=p.y*fp*3.1415926;h=sin(x+sin(z)*.8);h*=.72+.28*cos(z*.5);}
else{float x=p.x*fp*6.2831853;float z=p.y*fp*6.2831853;h=sin(x+sin(z+uTim*.12)*.8+uTim*.18)*.7+cos(z-x*.45-uTim*.14)*.3;}
h+=(sin(uv.x*37.+uTim*1.6)+cos(uv.y*31.-uTim*1.2))*.012;
return h;}
void main(){
vec2 base=fit(v_uv);float a=radians(uAng);float eps=max(.0018,2.5/max(uRes.x,uRes.y));
float h=surfaceHeight(base);
float hx=surfaceHeight(base+vec2(eps,0.))-surfaceHeight(base-vec2(eps,0.));
float hy=surfaceHeight(base+vec2(0.,eps))-surfaceHeight(base-vec2(0.,eps));
vec2 grad=vec2(hx,hy)/(2.*eps);
vec2 n2=rot(-a)*(-grad*.032*(uRel/100.));
n2+=vec2(sin(uTim*.7+base.y*9.),cos(uTim*.53+base.x*8.))*.006*uMot;
n2=clamp(n2,vec2(-1.4),vec2(1.4));
vec3 normal=normalize(vec3(n2,1.));
vec2 warped=mv(base,uTim);
float thickness=.82+clamp(h,0.,1.)*.36;
float depth=uDep*.00048*thickness;
vec2 refractUV=warped+n2*depth;
float reedG=0.;vec2 reedDelta=vec2(0.);
if(uMod==1){float fpr=max(2.,uSiz.x/max(1.,uCel));vec2 pr=rot(a)*(base-.5);float xr=pr.x*fpr;float id=floor(xr);reedG=fract(xr)-.5;float k=mix(.85,.08,clamp(uDep/200.,0.,1.));float lens=reedG*k+sin(reedG*3.1415926)*.06*(uRel/150.);float xs=(id+.5+lens)/fpr;reedDelta=rot(-a)*vec2(xs-pr.x,0.);refractUV=warped+reedDelta+n2*depth*.15;}
float da=uDis*.00012*(.72+clamp(h,0.,1.)*.42);
vec2 split=uMod==1?reedDelta*(uDis*.0045):n2*da;
vec3 col;
float frost=uMod==3?clamp(uRel/300.,0.,1.)*.48:0.;
vec3 sharpR=texture2D(uImg,refractUV-split).rgb;
vec3 sharpG=texture2D(uImg,refractUV).rgb;
vec3 sharpB=texture2D(uImg,refractUV+split).rgb;
if(uMod==3){vec2 blurStep=(vec2(1.)/max(uSiz,vec2(1.)))*(2.+uGrn*.04);vec3 softR=(sharpR+texture2D(uImg,refractUV-split+vec2(blurStep.x,0.)).rgb+texture2D(uImg,refractUV-split-vec2(blurStep.x,0.)).rgb+texture2D(uImg,refractUV-split+vec2(0.,blurStep.y)).rgb+texture2D(uImg,refractUV-split-vec2(0.,blurStep.y)).rgb)/5.;vec3 softG=(sharpG+texture2D(uImg,refractUV+vec2(blurStep.x,0.)).rgb+texture2D(uImg,refractUV-vec2(blurStep.x,0.)).rgb+texture2D(uImg,refractUV+vec2(0.,blurStep.y)).rgb+texture2D(uImg,refractUV-vec2(0.,blurStep.y)).rgb)/5.;vec3 softB=(sharpB+texture2D(uImg,refractUV+split+vec2(blurStep.x,0.)).rgb+texture2D(uImg,refractUV+split-vec2(blurStep.x,0.)).rgb+texture2D(uImg,refractUV+split+vec2(0.,blurStep.y)).rgb+texture2D(uImg,refractUV+split-vec2(0.,blurStep.y)).rgb)/5.;sharpR=mix(sharpR,softR,frost);sharpG=mix(sharpG,softG,frost);sharpB=mix(sharpB,softB,frost);}
col=vec3(sharpR.r,sharpG.g,sharpB.b);
vec3 lightA=normalize(vec3(-.48,.62,.62));
vec3 lightB=normalize(vec3(.72,-.32,.61));
float specA=pow(max(dot(normal,lightA),0.),22.);
float specB=pow(max(dot(normal,lightB),0.),38.);
float fresnel=pow(1.-clamp(normal.z,0.,1.),3.);
float bevel=clamp(length(n2)*.72,0.,1.);
float sheen=clamp(uShe*.006,0.,1.2);
vec3 reflection=mix(vec3(.68,.84,1.),vec3(1.,.76,.54),clamp(base.y+.25,0.,1.));
col=mix(col,col*vec3(.82,.91,1.)+reflection*.08,fresnel*.62);
col+=reflection*(specA*.44+specB*.3)*(.35+sheen);
col+=vec3(.72,.9,1.)*bevel*sheen*.045;
col*=1.-fresnel*.12;
col=pow(max(col,vec3(0.)),vec3(.96));
if(uMod==1){float face=1.-smoothstep(-.5,.5,reedG);float lit=mix(.62,1.12,pow(face,.8));col*=mix(1.,lit,clamp(uRel/200.,0.,1.));float gap=smoothstep(.40,.5,abs(reedG));col*=1.-gap*.55;col+=reflection*smoothstep(.0,.12,.5-abs(reedG+.28))*clamp(uShe*.004,0.,.6)*.22;}
float vignette=1.-length((v_uv-.5)*1.15)*.18;
col*=vignette;
float pulse=.5+.5*sin(uTim*.8);
col+=reflection*(specA+specB)*pulse*.025;
gl_FragColor=vec4(clamp(col,0.,1.),1.);
}`;
let stage,canvas,gl,prog,buf,tex,un={},power,powerState,active=false,on=false,mode=0,motion=1,t=0,last=performance.now(),fallbackTexture=null,lastStillSource=null,rendererError=null,loop=null;
const failedSources=new WeakSet();
const scope=window.kefeResilience?.createScope?.();

function el(tag,cls,txt){const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n;}
function sh(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const err=gl.getShaderInfoLog(s);gl.deleteShader(s);throw Error(err||'Shader compile error');}return s;}
function destroyGL(){
  if(gl&&!gl.isContextLost()){
    try{if(buf)gl.deleteBuffer(buf);}catch(_){}
    try{if(tex)gl.deleteTexture(tex);}catch(_){}
    try{if(prog)gl.deleteProgram(prog);}catch(_){}
  }
  buf=null;tex=null;prog=null;
}
function buildFallbackTexture(){
  if(fallbackTexture)return fallbackTexture;
  const c=document.createElement('canvas');c.width=c.height=1200;
  const x=c.getContext('2d');
  if(!x)return null;
  const g=x.createLinearGradient(0,0,1200,1200);
  g.addColorStop(0,'#ff5e7e');g.addColorStop(.33,'#ffb84d');g.addColorStop(.66,'#4dd2ff');g.addColorStop(1,'#8a5eff');
  x.fillStyle=g;x.fillRect(0,0,1200,1200);
  x.fillStyle='rgba(255,255,255,.8)';x.beginPath();x.arc(600,600,320,0,Math.PI*2);x.fill();
  fallbackTexture=c;
  return fallbackTexture;
}
function initGL(){
  destroyGL();
  gl=canvas.getContext('webgl',{alpha:false,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
  if(!gl||gl.isContextLost())throw Error('WebGL is unavailable');
  const vs=sh(gl.VERTEX_SHADER,VERT),fs=sh(gl.FRAGMENT_SHADER,FRAG);
  prog=gl.createProgram();gl.attachShader(prog,vs);gl.attachShader(prog,fs);gl.linkProgram(prog);
  gl.deleteShader(vs);gl.deleteShader(fs);
  if(!gl.getProgramParameter(prog,gl.LINK_STATUS)){const err=gl.getProgramInfoLog(prog);gl.deleteProgram(prog);prog=null;throw Error(err||'Program link error');}
  gl.useProgram(prog);
  buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  const a=gl.getAttribLocation(prog,'a_pos');
  if(a<0)throw Error('Vertex attribute missing');
  gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
  tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
  ['TEXTURE_WRAP_S','TEXTURE_WRAP_T'].forEach(k=>gl.texParameteri(gl.TEXTURE_2D,gl[k],gl.CLAMP_TO_EDGE));
  ['TEXTURE_MIN_FILTER','TEXTURE_MAG_FILTER'].forEach(k=>gl.texParameteri(gl.TEXTURE_2D,gl[k],gl.LINEAR));
  const fb=buildFallbackTexture();
  if(fb)setTex(fb);
  ['uImg','uRes','uSiz','uMod','uCel','uRel','uDep','uAng','uDis','uShe','uGrn','uTim','uMot'].forEach(k=>un[k]=gl.getUniformLocation(prog,k));
  resize();
}
function setTex(s){
  if(!s||!gl||gl.isContextLost()||!tex||failedSources.has(s))return false;
  try{
    lastStillSource=s;
    gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,s);
    const w=s.videoWidth||s.naturalWidth||s.width||1200,h=s.videoHeight||s.naturalHeight||s.height||1200;
    canvas.dataset.sw=w;canvas.dataset.sh=h;
    const r=$('flutedResolution'),e=$('flutedEmpty');
    if(r)r.textContent=w+' × '+h;
    if(e)e.hidden=true;
    return true;
  }catch(err){
    failedSources.add(s);
    console.warn('[KEFE Glass Lens texture]',err);
    return false;
  }
}
function syncPowerUI(){
  if(!power||!powerState)return;
  power.disabled=!!rendererError;
  powerState.textContent=rendererError?'Unavailable':(on?'On':'Off');
  power.classList.toggle('is-on',on&&!rendererError);
  power.setAttribute('aria-checked',String(on&&!rendererError));
  power.title=rendererError?'WebGL unavailable':(on?'Turn Glass Lens off':'Turn Glass Lens on');
  window.kefeFlutedGlassEnabled=on&&!rendererError;
  window.kefeFlutedGlassActive=active;
  if(canvas)canvas.style.visibility=active&&on&&!rendererError&&gl&&!gl.isContextLost()?'visible':'hidden';
}
function reportError(err,title,message){
  rendererError=err||new Error('WebGL unavailable');
  on=false;
  syncPowerUI();
  loop?.stop();
  window.kefeResilience?.panelError('visualiser',{
    id:'fluted-glass-gl',
    title:title||'Glass Lens preview could not initialise',
    message:message||'WebGL graphics acceleration is unavailable or blocked in this browser.',
    retryLabel:'Retry',
    onRetry:()=>{
      rendererError=null;
      if(ensureGL()){on=true;syncPowerUI();resize();loop?.start();}
    },
    continueLabel:'Continue with Fluid Ink (2D)',
    onContinue:()=>{document.querySelector('[data-visualiser="gradient"]')?.click();}
  });
}
function ensureGL(){
  if(gl&&!gl.isContextLost()&&prog)return true;
  if(rendererError)return false;
  try{
    initGL();
    rendererError=null;
    window.kefeResilience?.clearPanelError('visualiser','fluted-glass-gl');
    syncPowerUI();
    return true;
  }catch(e){
    console.error('[KEFE Glass Lens]',e);
    reportError(e);
    return false;
  }
}
function resize(){
  if(!stage||!canvas)return false;
  const r=stage.getBoundingClientRect();
  if(r.width<2||r.height<2)return false;
  const d=Math.min(devicePixelRatio||1,2),w=Math.max(2,Math.round(r.width*d)),h=Math.max(2,Math.round(r.height*d));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  if(gl&&!gl.isContextLost())gl.viewport(0,0,canvas.width,canvas.height);
  return true;
}
function slider(label,min,max,step,value,id,onInput){const wrap=el('label','kefe-visualiser-field'),head=el('span'),b=el('b',null,label),out=el('output'),input=el('input');input.type='range';input.min=min;input.max=max;input.step=step;input.value=value;input.id=id;out.textContent=String(value);head.append(b,out);input.addEventListener('input',()=>{out.textContent=input.value;onInput(Number(input.value));});wrap.append(head,input);return wrap;}
function buildSliders(){const c=$('flutedSliders');if(!c)return;c.innerHTML='';MODES[mode].keys.forEach(k=>{const d=D[k];c.appendChild(slider(d[0],d[1],d[2],1,P[mode][k],'fluted-'+k,v=>P[mode][k]=v));});}
function setMode(i){mode=i;document.querySelectorAll('#flutedModes button').forEach((b,j)=>{b.classList.toggle('primary',i===j);b.setAttribute('aria-pressed',String(i===j));});$('flutedModeDesc').textContent=MODES[i].desc;buildSliders();}
function buildUI(){
  const form=document.querySelector('[data-panel-view="visualiser"] .kefe-visualiser-form'),tabs=document.querySelector('.kefe-vis-tabs');if(!form||!tabs)return;
  const view=el('div','kefe-vis-view kefe-fluted-view');view.id='kefeVisFlutedView';view.hidden=true;
  power=el('button','kefe-btn kefe-switch kefe-vis-option-power','');power.type='button';power.id='flutedPower';power.setAttribute('role','switch');power.setAttribute('aria-checked','false');power.setAttribute('aria-label','Glass Lens visualiser');power.title='Turn Glass Lens on';
  powerState=el('span','kefe-switch-state','Off');const powerTrack=el('span','kefe-switch-track');powerTrack.setAttribute('aria-hidden','true');powerTrack.appendChild(el('span','kefe-switch-thumb'));power.append(powerState,powerTrack);

  const modes=el('div','kefe-fluted-modes');modes.id='flutedModes';MODES.forEach((m,i)=>{const b=el('button','kefe-btn'+(!i?' primary':''),m.name);b.type='button';b.dataset.mode=i;b.setAttribute('aria-pressed',String(!i));b.addEventListener('click',()=>setMode(i));modes.appendChild(b);});
  const presetSet=$('kefeFlutedPresetSet');if(presetSet)presetSet.appendChild(modes);else view.appendChild(modes);
  const desc=el('p','kefe-meta',MODES[0].desc);desc.id='flutedModeDesc';view.appendChild(desc);
  const src=el('div','kefe-visualiser-control-group');src.appendChild(el('div','kefe-label','Glass source'));
  const empty=el('p','kefe-meta','Uses the uploaded video or album artwork as the glass source. Album artwork keeps moving independently of the audio.');empty.id='flutedEmpty';src.appendChild(empty);
  const res=el('div','kefe-meta','1200 × 1200');res.id='flutedResolution';src.appendChild(res);view.appendChild(src);
  const ag=el('div','kefe-visualiser-control-group');ag.appendChild(el('div','kefe-label','Movement'));ag.appendChild(slider('Motion',0,2.5,.05,1,'flutedMotion',v=>motion=v));view.appendChild(ag);
  const pg=el('div','kefe-visualiser-control-group');pg.appendChild(el('div','kefe-label','Glass parameters'));const sl=el('div');sl.id='flutedSliders';pg.appendChild(sl);view.appendChild(pg);
  const reset=el('button','kefe-btn','Reset');reset.type='button';reset.id='flutedReset';view.appendChild(reset);form.appendChild(view);

  const tab=el('button','kefe-btn','Glass Lens');tab.type='button';tab.id='kefeFlutedTab';tab.dataset.visualiser='fluted';tab.dataset.icon='◇';tab.title='Glass Lens refraction';tab.setAttribute('aria-label','Glass Lens');tab.textContent='Glass Lens';tab.setAttribute('role','tab');tab.setAttribute('aria-controls','kefeVisFlutedView');tab.setAttribute('aria-selected','false');
  const option=el('div','kefe-vis-option');option.style.cssText='display:flex;align-items:center;gap:8px;min-width:0';tab.style.flex='1 1 auto';tab.style.minWidth='0';power.style.flex='0 0 auto';option.append(tab,power);
  power.addEventListener('click',e=>{
    e.stopPropagation();
    if(rendererError){ensureGL();return;}
    on=!on;
    if(on&&!ensureGL())return;
    syncPowerUI();
    if(active&&on){resize();loop?.start();}else loop?.stop();
  });
  tabs.appendChild(option);

  function hide(){active=false;view.hidden=true;tab.classList.remove('primary');tab.setAttribute('aria-selected','false');canvas.style.visibility='hidden';window.kefeFlutedGlassActive=false;loop?.stop();}
  const onSelect=e=>{if(e.detail&&e.detail.id&&e.detail.id!=='fluted')hide();};
  scope?scope.on(window,'kefe-visualiser-select',onSelect):window.addEventListener('kefe-visualiser-select',onSelect);
  tabs.querySelectorAll('.kefe-vis-option [role="tab"]').forEach(b=>{if(b===tab)return;b.addEventListener('click',hide);});
  tab.addEventListener('click',()=>{
    active=true;view.hidden=false;
    tabs.querySelectorAll('.kefe-vis-option [role="tab"]').forEach(b=>{b.classList.toggle('primary',b===tab);b.setAttribute('aria-selected',String(b===tab));});
    power.setAttribute('aria-label','Glass Lens visualiser');
    const heading=$('kefeVisualiserHeading'),description=$('kefeVisualiserDescription');
    if(heading)heading.textContent='Visualisers';if(description)description.textContent='';
    ['kefeGradientPresetSet'].forEach(id=>{const n=$(id);if(n)n.hidden=true;});
    const presetRow=$('kefeVisualiserPresetRow'),presetSet=$('kefeFlutedPresetSet');
    if(presetRow)presetRow.hidden=false;if(presetSet)presetSet.hidden=false;
    form.querySelectorAll('.kefe-vis-view').forEach(n=>{n.hidden=n!==view;});
    window.kefeFlutedGlassActive=true;
    window.dispatchEvent(new CustomEvent('kefe-visualiser-select',{detail:{id:'fluted'}}));
    if(ensureGL()){resize();syncPowerUI();if(on)loop?.start();}
    else{syncPowerUI();reportError(rendererError);}
  });

  reset.addEventListener('click',()=>{
    P.forEach((p,i)=>MODES[i].keys.forEach(k=>p[k]=(DEF[i]&&DEF[i][k]!==undefined)?DEF[i][k]:D[k][3]));
    motion=1;setMode(0);
    const m=$('flutedMotion');
    if(m){m.value='1';m.dispatchEvent(new Event('input',{bubbles:true}));}
  });
  buildSliders();
}
function step(now){
  if(!active||!on||document.hidden)return false;
  if(!gl||gl.isContextLost()||!prog)return false;
  if(window.kefeFrameGate&&!window.kefeFrameGate(now))return true;
  if(!resize())return true;
  const dt=Math.min(.05,Math.max(0,(now-(last||now))/1000));last=now;t+=dt;
  const backgroundCanvas=document.getElementById('kefeBackgroundCanvas');
  let texOk=false;
  if(window.kefeBackground?.mode?.()==='video'&&backgroundCanvas&&backgroundCanvas.width>1){texOk=setTex(backgroundCanvas);}
  else{
    const projectVideo=window.kefeGetProjectVideo?.();
    if(projectVideo?.src&&projectVideo.readyState>=2&&projectVideo.videoWidth){texOk=setTex(projectVideo);}
    else{
      const art=window.kefeGetAlbumArt?.();
      if(art&&art.complete&&art.naturalWidth){texOk=lastStillSource===art||setTex(art);}
    }
  }
  if(!texOk&&lastStillSource!==fallbackTexture&&fallbackTexture)setTex(fallbackTexture);
  const p=P[mode];
  gl.viewport(0,0,canvas.width,canvas.height);gl.useProgram(prog);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.uniform1i(un.uImg,0);gl.uniform2f(un.uRes,canvas.width,canvas.height);
  gl.uniform2f(un.uSiz,Number(canvas.dataset.sw)||1200,Number(canvas.dataset.sh)||1200);
  gl.uniform1i(un.uMod,mode);
  const vals={uCel:p.cellSize??79,uRel:p.relief??130,uDep:p.depth??152,uAng:p.angle??110,uDis:p.dispersion??54,uShe:p.sheen??32,uGrn:p.grain??68,uTim:t,uMot:motion};
  Object.entries(vals).forEach(([k,v])=>gl.uniform1f(un[k],v));
  gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  return true;
}
function init(){
  stage=document.querySelector('.kefe-stage');
  if(!stage||!document.querySelector('.kefe-vis-tabs'))return;
  canvas=document.createElement('canvas');canvas.id='kefeFlutedGlassCanvas';canvas.setAttribute('aria-label','Glass Lens preview');
  canvas.style.visibility='hidden';
  stage.insertBefore(canvas,$('kefeCanvas')||null);
  loop=window.kefeResilience?.createRenderLoop
    ? window.kefeResilience.createRenderLoop(step,{onError:err=>reportError(err,'Glass Lens stopped rendering','A graphics error interrupted Glass Lens.')})
    : {start(){},stop(){},dispose(){}};
  try{buildUI();}catch(e){console.error('[KEFE Glass Lens UI]',e);return;}
  window.kefeFlutedGlassActive=false;window.kefeFlutedGlassEnabled=false;
  window.kefeFlutedGlassExport={canvas,isReady:()=>!!(gl&&!gl.isContextLost()&&prog&&canvas.width>1&&canvas.height>1)};
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();loop?.stop();gl=null;if(active&&on)reportError(new Error('WebGL context lost'),'Glass Lens paused','The browser paused 3D graphics. Tap Retry or switch to Fluid Ink.');});
  canvas.addEventListener('webglcontextrestored',()=>{rendererError=null;if(ensureGL()&&active&&on){syncPowerUI();resize();loop?.start();}});
  const onResize=()=>{if(active&&on)resize();};
  if(scope){scope.on(window,'resize',onResize);scope.on(window,'kefe-stage-resize',onResize);scope.add(()=>{loop?.dispose();destroyGL();});}
  else{window.addEventListener('resize',onResize);window.addEventListener('kefe-stage-resize',onResize);}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
