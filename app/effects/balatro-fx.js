/* KEFE Visual FX — Balatro swirling paint background port.
   Native WebGL2 implementation (no OGL dependency), following the aurora-fx.js pattern. */
(() => {
  'use strict';
  const VERT=`#version 300 es
in vec2 position;
void main(){gl_Position=vec4(position,0.0,1.0);}`;
  const FRAG=`#version 300 es
precision highp float;
#define PI 3.14159265359
uniform float iTime;uniform vec3 iResolution;uniform float uSpinRotation;uniform float uSpinSpeed;uniform vec2 uOffset;uniform vec4 uColor1;uniform vec4 uColor2;uniform vec4 uColor3;uniform float uContrast;uniform float uLighting;uniform float uSpinAmount;uniform float uPixelFilter;uniform float uSpinEase;uniform float uIsRotate;out vec4 fragColor;
vec4 effect(vec2 screenSize,vec2 screen_coords){
  float pixel_size=length(screenSize.xy)/uPixelFilter;
  vec2 uv=(floor(screen_coords.xy*(1.0/pixel_size))*pixel_size-0.5*screenSize.xy)/length(screenSize.xy)-uOffset;
  float uv_len=length(uv);
  float speed=(uSpinRotation*uSpinEase*0.2);
  if(uIsRotate>0.5){speed=iTime*speed;}
  speed+=302.2;
  float mouseInfluence=0.0;
  speed+=mouseInfluence*0.1;
  float new_pixel_angle=atan(uv.y,uv.x)+speed-uSpinEase*20.0*(uSpinAmount*uv_len+(1.0-uSpinAmount));
  vec2 mid=(screenSize.xy/length(screenSize.xy))/2.0;
  uv=(vec2(uv_len*cos(new_pixel_angle)+mid.x,uv_len*sin(new_pixel_angle)+mid.y)-mid);
  uv*=30.0;
  float baseSpeed=iTime*uSpinSpeed;
  speed=baseSpeed+mouseInfluence*2.0;
  vec2 uv2=vec2(uv.x+uv.y);
  for(int i=0;i<5;i++){
    uv2+=sin(max(uv.x,uv.y))+uv;
    uv+=0.5*vec2(cos(5.1123314+0.353*uv2.y+speed*0.131121),sin(uv2.x-0.113*speed));
    uv-=cos(uv.x+uv.y)-sin(uv.x*0.711-uv.y);
  }
  float contrast_mod=(0.25*uContrast+0.5*uSpinAmount+1.2);
  float paint_res=min(2.0,max(0.0,length(uv)*0.035*contrast_mod));
  float c1p=max(0.0,1.0-contrast_mod*abs(1.0-paint_res));
  float c2p=max(0.0,1.0-contrast_mod*abs(paint_res));
  float c3p=1.0-min(1.0,c1p+c2p);
  float light=(uLighting-0.2)*max(c1p*5.0-4.0,0.0)+uLighting*max(c2p*5.0-4.0,0.0);
  return (0.3/uContrast)*uColor1+(1.0-0.3/uContrast)*(uColor1*c1p+uColor2*c2p+vec4(c3p*uColor3.rgb,c3p*uColor1.a))+light;
}
void main(){
  vec2 uv=gl_FragCoord.xy;
  fragColor=effect(iResolution.xy,uv);
}`;
  const defaults={spinRotation:-2,spinSpeed:7,offset:[0,0],color1:'#DE443B',color2:'#006BB4',color3:'#162325',contrast:3.5,lighting:.4,spinAmount:.25,pixelFilter:745,spinEase:1,isRotate:false,intensity:1};
  let gl=null,program=null,canvas=null,buffer=null,width=1,height=1;
  const hex=h=>{h=String(h||'#fff').replace('#','');if(h.length===3)h=h.split('').map(x=>x+x).join('');if(h.length===8){const n=parseInt(h,16);return[(n>>>24&255)/255,(n>>16&255)/255,(n>>8&255)/255,(n&255)/255];}const n=parseInt(h,16);return[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255,1];};
  const compile=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){gl.deleteShader(s);return null;}return s;};
  const resize=(w,h)=>{width=Math.max(1,w|0);height=Math.max(1,h|0);if(!canvas)return;const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);canvas.style.width=width+'px';canvas.style.height=height+'px';gl.viewport(0,0,canvas.width,canvas.height);};
  const init=()=>{if(canvas)return true;canvas=document.createElement('canvas');canvas.className='kefe-balatro-fx';canvas.setAttribute('aria-hidden','true');gl=canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:true,antialias:true});if(!gl)return false;const vs=compile(gl.VERTEX_SHADER,VERT),fs=compile(gl.FRAGMENT_SHADER,FRAG);if(!vs||!fs)return false;program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))return false;buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);return true;};
  const renderBalatro=(time,settings)=>{if(!init())return null;const s={...defaults,...settings},dpr=Math.min(window.devicePixelRatio||1,2);gl.viewport(0,0,Math.round(width*dpr),Math.round(height*dpr));gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);const loc=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
    gl.uniform1f(gl.getUniformLocation(program,'iTime'),time);
    gl.uniform3f(gl.getUniformLocation(program,'iResolution'),width*dpr,height*dpr,(width*dpr)/(height*dpr));
    gl.uniform1f(gl.getUniformLocation(program,'uSpinRotation'),s.spinRotation);
    gl.uniform1f(gl.getUniformLocation(program,'uSpinSpeed'),s.spinSpeed);
    gl.uniform2f(gl.getUniformLocation(program,'uOffset'),s.offset[0],s.offset[1]);
    const c1=hex(s.color1),c2=hex(s.color2),c3=hex(s.color3);
    gl.uniform4f(gl.getUniformLocation(program,'uColor1'),c1[0],c1[1],c1[2],c1[3]);
    gl.uniform4f(gl.getUniformLocation(program,'uColor2'),c2[0],c2[1],c2[2],c2[3]);
    gl.uniform4f(gl.getUniformLocation(program,'uColor3'),c3[0],c3[1],c3[2],c3[3]);
    gl.uniform1f(gl.getUniformLocation(program,'uContrast'),s.contrast);
    gl.uniform1f(gl.getUniformLocation(program,'uLighting'),s.lighting);
    gl.uniform1f(gl.getUniformLocation(program,'uSpinAmount'),s.spinAmount);
    gl.uniform1f(gl.getUniformLocation(program,'uPixelFilter'),s.pixelFilter);
    gl.uniform1f(gl.getUniformLocation(program,'uSpinEase'),s.spinEase);
    gl.uniform1f(gl.getUniformLocation(program,'uIsRotate'),s.isRotate?1:0);
    gl.disable(gl.BLEND);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);return canvas;};
  function addButton(){const buttons=document.getElementById('visualFxBackgroundButtons')||document.querySelector('.kefe-fx-button')?.parentElement;if(!buttons||buttons.querySelector('[data-fx="balatro"]'))return;const b=document.createElement('button');b.type='button';b.dataset.fx='balatro';b.className='kefe-fx-button';b.textContent='Balatro';b.addEventListener('click',()=>{window.state.style.visualFx='balatro';document.querySelectorAll('.kefe-fx-button').forEach(x=>x.classList.toggle('active-effect',x.dataset.fx==='balatro'));const l=document.getElementById('visualFxLabel');if(l)l.textContent='Balatro — swirling WebGL paint field';window.redrawCurrentPreviewFrame?.();});buttons.appendChild(b);}
  function boot(){if(!window.state||typeof window.render!=='function')return;addButton();const previous=window.render;if(previous.__kefeBalatro)return;const wrapped=function(ctx,w,h,state,media){previous(ctx,w,h,state,media);if(state?.style?.visualFx!=='balatro')return;resize(w,h);const s={...defaults,spinRotation:Number(state.style.balatroSpinRotation)??defaults.spinRotation,spinSpeed:Number(state.style.balatroSpinSpeed)||defaults.spinSpeed,color1:state.style.balatroColor1||defaults.color1,color2:state.style.balatroColor2||defaults.color2,color3:state.style.balatroColor3||defaults.color3,contrast:Number(state.style.balatroContrast)||defaults.contrast,lighting:Number(state.style.balatroLighting)??defaults.lighting,spinAmount:Number(state.style.balatroSpinAmount)??defaults.spinAmount,pixelFilter:Number(state.style.balatroPixelFilter)||defaults.pixelFilter,isRotate:!!state.style.balatroIsRotate,intensity:Number(state.style.balatroIntensity)||defaults.intensity};const c=renderBalatro(Number(state.playback?.currentTime)||0,s);if(!c)return;ctx.save();ctx.globalAlpha=Math.max(0,Math.min(1,s.intensity));ctx.drawImage(c,0,0,w,h);ctx.restore();};wrapped.__kefeBalatro=true;window.render=wrapped;const observer=new MutationObserver(addButton);observer.observe(document.body,{childList:true,subtree:true});window.KefeBalatroFX={defaults,render:renderBalatro,canvas:()=>canvas};}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
