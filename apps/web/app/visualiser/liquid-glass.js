/* KEFE Liquid Glass — three bass-responsive surface styles. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const VERT='attribute vec2 p;varying vec2 uv;void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
const FRAG=String.raw\`precision highp float;varying vec2 uv;uniform sampler2D img;uniform vec2 res,src;uniform float time,bass,mid,treble,react,opacity,style;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=noise(p)*a;p=p*2.03+vec2(7.1,3.7);a*=.5;}return v;}
vec2 fit(vec2 q){float ca=res.x/res.y,ia=src.x/src.y;if(ca>ia)q.y=(q.y-.5)*ia/ca+.5;else q.x=(q.x-.5)*ca/ia+.5;return q;}
void main(){
 vec2 q=fit(uv),p=(q-.5)*vec2(res.x/res.y,1.);float b=bass*react;
 float n1=fbm(p*3.2+vec2(time*.09,-time*.06)),n2=fbm(p*6.0-vec2(time*.07,time*.11));
 vec2 grad=vec2(fbm(p*3.2+vec2(.01,time*.09))-n1,fbm(p*3.2+vec2(time*.09,.01))-n1);
 float h=0.;vec2 ripple=vec2(0.);
 if(style<.5){
   float field=fbm(p*2.2+vec2(time*.10,-time*.08));
   h=field*.48+sin(p.x*5.+field*5.-time*.7)*.08;
   ripple=grad*(.055+b*.19)+vec2(sin(p.y*8.+time)*.012,cos(p.x*7.-time)*.012);
   h+=sin(p.x*3.0+p.y*2.0-time*1.2)*(.025+b*.12);
 }else if(style<1.5){
   vec2 c1=vec2(sin(time*.23)*.28,cos(time*.19)*.2),c2=vec2(cos(time*.17+1.3)*.24,sin(time*.21+2.)*.22);
   float d1=length(p-c1),d2=length(p-c2);
   float w1=sin(d1*(24.+b*7.)-time*(1.8+b*5.))*exp(-d1*1.2);
   float w2=sin(d2*(21.+b*6.)-time*(1.5+b*4.))*exp(-d2*1.1);
   h=(w1+w2)*(.11+b*.23)+n1*.025;
   ripple=vec2(w1-w2,w2+w1)*(.035+b*.12)+grad*.025;
 }else{
   vec2 cell=fract((p+vec2(.5))*vec2(18.,12.))-.5;
   float rad=length(cell);
   float vib=sin(rad*35.-time*(3.+bass*14.))*exp(-rad*3.);
   float cone=sin(length(p-vec2(0.,-.05))*18.-time*(2.+bass*10.));
   h=vib*(.08+b*.3)+cone*(.025+b*.14)+n2*.025;
   ripple=normalize(cell+vec2(.001))*(vib*.035+b*vib*.12)+grad*.02;
 }
 ripple+=vec2(sin(p.y*5.+time*.7),cos(p.x*6.-time*.6))*(.008+mid*react*.025);
 vec2 texuv=clamp(q+ripple,vec2(.002),vec2(.998));
 vec2 chroma=ripple*(.18+treble*.15);
 vec3 col=vec3(texture2D(img,clamp(texuv-chroma,vec2(.002),vec2(.998))).r,texture2D(img,texuv).g,texture2D(img,clamp(texuv+chroma,vec2(.002),vec2(.998))).b);
 vec3 norm=normalize(vec3(-ripple*16.,1.));
 vec3 l1=normalize(vec3(-.5,.65,.8)),l2=normalize(vec3(.7,-.3,.6));
 float spec=pow(max(dot(norm,l1),0.),36.)*.7+pow(max(dot(norm,l2),0.),58.)*.45;
 float fres=pow(1.-max(norm.z,0.),3.);
 float edge=pow(abs(sin(h*18.+time*.2)),12.)*(.08+b*.22);
 col=mix(col,col*vec3(.78,.9,1.)+vec3(.25,.55,.85)*.15,fres*.38);
 col+=vec3(.68,.88,1.)*(spec*.45+edge)+vec3(.38,.12,.72)*fres*.12;
 col+=vec3(.8,.94,1.)*clamp(length(ripple)*2.,0.,.25)*(.2+treble*.3);
 gl_FragColor=vec4(clamp(col,0.,1.),opacity);
}\`;
let stage,canvas,gl,program,texture,loc={},tab,view,active=false,on=true,style=0,raf=0,analyser=null,freq=null,t=0,last=0,smoothed={bass:0,mid:0,treble:0},react=1,opacity=.92,rendererError=null;
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
function initGL(){gl=canvas.getContext('webgl',{alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});if(!gl)throw Error('WebGL unavailable');program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,VERT));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,FRAG));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);let b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);let a=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);['img','res','src','time','bass','mid','treble','react','opacity','style'].forEach(k=>loc[k]=gl.getUniformLocation(program,k));}
function setSource(){let source=null,bg=$('kefeBackgroundCanvas'),video=window.kefeGetProjectVideo?.(),art=window.kefeGetAlbumArt?.();if(window.kefeBackground?.mode?.()==='video'&&bg&&bg.width)source=bg;else if(video&&video.readyState>=2&&video.videoWidth)source=video;else if(art&&art.complete&&art.naturalWidth)source=art;else if(bg&&bg.width)source=bg;if(!source)return;try{gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);canvas.dataset.sw=source.videoWidth||source.naturalWidth||source.width;canvas.dataset.sh=source.videoHeight||source.naturalHeight||source.height;}catch(e){}}
function audio(){try{if(!analyser&&window.kefeAudioGraph){let g=window.kefeAudioGraph.ensure();if(g){analyser=g.analyser;freq=new Uint8Array(analyser.frequencyBinCount);}}if(!analyser)return {bass:0,mid:0,treble:0};if(freq.length!==analyser.frequencyBinCount)freq=new Uint8Array(analyser.frequencyBinCount);analyser.getByteFrequencyData(freq);let rate=window.kefeAudioGraph.context()?.sampleRate||44100,nyq=rate/2;function band(lo,hi){let a=Math.floor(lo/nyq*freq.length),b=Math.min(freq.length-1,Math.ceil(hi/nyq*freq.length)),s=0;for(let i=a;i<=b;i++)s+=freq[i];return Math.min(1,Math.pow(s/Math.max(1,b-a+1)/255*2.5,1.2));}return {bass:band(25,160),mid:band(160,1800),treble:band(1800,10000)};}catch(e){return {bass:0,mid:0,treble:0};}}
function resize(){if(!stage)return;let r=stage.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,1.75),w=Math.max(1,Math.round(r.width*d)),h=Math.max(1,Math.round(r.height*d));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;if(gl)gl.viewport(0,0,w,h);}}
function slider(label,min,max,step,value,fn){let l=el('label','kefe-visualiser-field'),head=el('span'),b=el('b',null,label),o=el('output',null,String(value)),i=el('input');i.type='range';i.min=min;i.max=max;i.step=step;i.value=value;head.append(b,o);i.addEventListener('input',()=>{o.textContent=i.value;fn(Number(i.value));});l.append(head,i);return l;}
function build(){let form=document.querySelector('[data-panel-view="visualiser"] .kefe-visualiser-form'),tabs=document.querySelector('.kefe-vis-tabs');if(!form||!tabs)return;
 view=el('div','kefe-vis-view kefe-liquid-glass-view');view.id='kefeVisLiquidGlassView';view.hidden=true;
 let row=el('div','kefe-visualiser-spin-row kefe-vis-power-row'),powerLabel=el('span','kefe-label','Liquid Glass'),power=el('button','kefe-btn kefe-switch','');power.type='button';power.id='kefeLiquidGlassPower';power.setAttribute('role','switch');power.setAttribute('aria-checked','true');power.setAttribute('aria-label','Liquid Glass effect');let state=el('span','kefe-switch-state','On'),track=el('span','kefe-switch-track');track.setAttribute('aria-hidden','true');track.appendChild(el('span','kefe-switch-thumb'));power.append(state,track);power.classList.add('is-on');row.append(powerLabel,power);view.appendChild(row);
 let modes=el('div','kefe-liquid-glass-modes');[['Liquid Surface','A continuous glass membrane that buckles and rolls with bass pressure.'],['Bass Ripple','Concentric shockwaves, circular interference and refractive rings.'],['Speaker Droplets','Glass droplets form resonant patterns on a violently vibrating surface.']].forEach((m,i)=>{let b=el('button','kefe-btn'+(!i?' primary':''),m[0]);b.type='button';b.setAttribute('aria-pressed',String(i===0));b.addEventListener('click',()=>{style=i;modes.querySelectorAll('button').forEach((x,j)=>{x.classList.toggle('primary',j===i);x.setAttribute('aria-pressed',String(j===i));});desc.textContent=m[1];});modes.appendChild(b);});view.appendChild(modes);
 let desc=el('p','kefe-meta','A continuous glass membrane that buckles and rolls with bass pressure.');view.appendChild(desc);
 let controls=el('div','kefe-visualiser-control-group');controls.appendChild(el('div','kefe-label','Response'));controls.appendChild(slider('Bass and vibration intensity',0,2.5,.05,1,v=>react=v));controls.appendChild(slider('Glass transparency',.25,1,.01,.92,v=>opacity=v));view.appendChild(controls);form.appendChild(view);
 tab=el('button','kefe-btn','Liquid Glass');tab.type='button';tab.id='kefeLiquidGlassTab';tab.dataset.visualiser='liquid-glass';tab.dataset.icon='◌';tab.title='Liquid Glass visualiser';tab.setAttribute('aria-label','Liquid Glass');tab.setAttribute('role','tab');tab.setAttribute('aria-controls',view.id);tab.setAttribute('aria-selected','false');let option=el('div','kefe-vis-option');option.appendChild(tab);tabs.appendChild(option);
 function hide(){active=false;view.hidden=true;tab.classList.remove('primary');tab.setAttribute('aria-selected','false');canvas.style.visibility='hidden';window.kefeLiquidGlassActive=false;}
 tabs.querySelectorAll('[role="tab"]').forEach(b=>{if(b!==tab)b.addEventListener('click',hide);});
 tab.addEventListener('click',()=>{active=true;view.hidden=false;if(rendererError){const notice=view.querySelector('[data-liquid-glass-error]');if(notice)notice.hidden=false;}tabs.querySelectorAll('[role="tab"]').forEach(b=>{b.classList.toggle('primary',b===tab);b.setAttribute('aria-selected',String(b===tab));});['kefeVisGradientView','kefeVisFlutedView','kefeVisHowBadView'].forEach(id=>{let n=$(id);if(n)n.hidden=true;});let ps=$('kefeGradientPresetSet');if(ps)ps.hidden=true;let pr=$('kefeVisualiserPresetRow');if(pr)pr.hidden=true;let slot=$('kefeVisualiserPowerSlot');if(slot)slot.replaceChildren(power);window.kefeLiquidGlassActive=true;canvas.style.visibility=gl&&on?'visible':'hidden';resize();});
 power.addEventListener('click',()=>{on=!on;state.textContent=on?'On':'Off';power.classList.toggle('is-on',on);power.setAttribute('aria-checked',String(on));canvas.style.visibility=active&&on&&gl?'visible':'hidden';window.kefeLiquidGlassEnabled=on;});
}
function frame(now){raf=requestAnimationFrame(frame);if(!gl||!canvas||!active||!on||document.hidden)return;let dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;t+=dt;resize();setSource();let a=audio();['bass','mid','treble'].forEach(k=>{let attack=a[k]>smoothed[k] ? .42 : .09;smoothed[k]+=(a[k]-smoothed[k])*attack;});gl.viewport(0,0,canvas.width,canvas.height);gl.useProgram(program);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(loc.img,0);gl.uniform2f(loc.res,canvas.width,canvas.height);gl.uniform2f(loc.src,Number(canvas.dataset.sw)||canvas.width,Number(canvas.dataset.sh)||canvas.height);gl.uniform1f(loc.time,t);gl.uniform1f(loc.bass,smoothed.bass);gl.uniform1f(loc.mid,smoothed.mid);gl.uniform1f(loc.treble,smoothed.treble);gl.uniform1f(loc.react,react);gl.uniform1f(loc.opacity,opacity);gl.uniform1f(loc.style,style);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);}
function init(){stage=document.querySelector('.kefe-stage');if(!stage||!document.querySelector('.kefe-vis-tabs'))return;canvas=document.createElement('canvas');canvas.id='kefeLiquidGlassCanvas';canvas.setAttribute('aria-label','Liquid Glass preview');canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:3;visibility:hidden;';stage.insertBefore(canvas,$('kefeCanvas')||null);try{build();}catch(e){console.error('[KEFE Liquid Glass UI]',e);return;}window.kefeLiquidGlassActive=false;window.kefeLiquidGlassEnabled=true;try{initGL();window.kefeLiquidGlassExport={canvas};window.addEventListener('resize',resize);window.addEventListener('kefe-stage-resize',resize);raf=requestAnimationFrame(frame);}catch(e){rendererError=e;const notice=el('p','kefe-meta','Liquid Glass preview could not initialise. Check that WebGL is enabled, then reload KEFE.');notice.dataset.liquidGlassError='true';notice.setAttribute('role','status');view.prepend(notice);console.error('[KEFE Liquid Glass]',e);}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();