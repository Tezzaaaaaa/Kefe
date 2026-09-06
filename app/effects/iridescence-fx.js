/* KEFE Visual FX — Iridescence background port.
   Native WebGL2 implementation (no OGL dependency), following the aurora-fx.js pattern. */
(() => {
  'use strict';
  const VERT=`#version 300 es
in vec2 position;
void main(){gl_Position=vec4(position,0.0,1.0);}`;
  const FRAG=`#version 300 es
precision highp float;
uniform float uTime;uniform vec3 uColor;uniform vec3 uResolution;uniform vec2 uMouse;uniform float uAmplitude;uniform float uSpeed;out vec4 fragColor;
void main(){
  float mr=min(uResolution.x,uResolution.y);
  vec2 uv=(gl_FragCoord.xy/uResolution.xy*2.0-1.0)*uResolution.xy/mr;
  uv+=(uMouse-vec2(0.5))*uAmplitude;
  float d=-uTime*0.5*uSpeed;
  float a=0.0;
  for(float i=0.0;i<8.0;++i){a+=cos(i-d-a*uv.x);d+=sin(uv.y*i+a);}
  d+=uTime*0.5*uSpeed;
  vec3 col=vec3(cos(uv*vec2(d,a))*0.6+0.4,cos(a+d)*0.5+0.5);
  col=cos(col*cos(vec3(d,a,2.5))*0.5+0.5)*uColor;
  fragColor=vec4(col,1.0);
}`;
  const defaults={color:[1,1,1],amplitude:.1,speed:1,intensity:1};
  let gl=null,program=null,canvas=null,buffer=null,width=1,height=1;
  const compile=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){gl.deleteShader(s);return null;}return s;};
  const resize=(w,h)=>{width=Math.max(1,w|0);height=Math.max(1,h|0);if(!canvas)return;const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);canvas.style.width=width+'px';canvas.style.height=height+'px';gl.viewport(0,0,canvas.width,canvas.height);};
  const init=()=>{if(canvas)return true;canvas=document.createElement('canvas');canvas.className='kefe-iridescence-fx';canvas.setAttribute('aria-hidden','true');gl=canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:true,antialias:true});if(!gl)return false;const vs=compile(gl.VERTEX_SHADER,VERT),fs=compile(gl.FRAGMENT_SHADER,FRAG);if(!vs||!fs)return false;program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))return false;buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);return true;};
  const renderIridescence=(time,settings)=>{if(!init())return null;const s={...defaults,...settings},dpr=Math.min(window.devicePixelRatio||1,2);gl.viewport(0,0,Math.round(width*dpr),Math.round(height*dpr));gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);const loc=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);gl.uniform1f(gl.getUniformLocation(program,'uTime'),time);gl.uniform3f(gl.getUniformLocation(program,'uColor'),s.color[0],s.color[1],s.color[2]);gl.uniform3f(gl.getUniformLocation(program,'uResolution'),width*dpr,height*dpr,(width*dpr)/(height*dpr));gl.uniform2f(gl.getUniformLocation(program,'uMouse'),0.5,0.5);gl.uniform1f(gl.getUniformLocation(program,'uAmplitude'),s.amplitude);gl.uniform1f(gl.getUniformLocation(program,'uSpeed'),s.speed);gl.disable(gl.BLEND);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);return canvas;};
  function addButton(){const buttons=document.getElementById('visualFxBackgroundButtons')||document.querySelector('.kefe-fx-button')?.parentElement;if(!buttons||buttons.querySelector('[data-fx="iridescence"]'))return;const b=document.createElement('button');b.type='button';b.dataset.fx='iridescence';b.className='kefe-fx-button';b.textContent='Iridescence';b.addEventListener('click',()=>{window.state.style.visualFx='iridescence';document.querySelectorAll('.kefe-fx-button').forEach(x=>x.classList.toggle('active-effect',x.dataset.fx==='iridescence'));const l=document.getElementById('visualFxLabel');if(l)l.textContent='Iridescence — animated WebGL colour shift';window.redrawCurrentPreviewFrame?.();});buttons.appendChild(b);}
  function boot(){if(!window.state||typeof window.render!=='function')return;addButton();const previous=window.render;if(previous.__kefeIridescence)return;const wrapped=function(ctx,w,h,state,media){previous(ctx,w,h,state,media);if(state?.style?.visualFx!=='iridescence')return;resize(w,h);const s={...defaults,color:state.style.iridescenceColor||defaults.color,amplitude:Number(state.style.iridescenceAmplitude)||defaults.amplitude,speed:Number(state.style.iridescenceSpeed)||defaults.speed,intensity:Number(state.style.iridescenceIntensity)||defaults.intensity};const c=renderIridescence(Number(state.playback?.currentTime)||0,s);if(!c)return;ctx.save();ctx.globalAlpha=Math.max(0,Math.min(1,s.intensity));ctx.drawImage(c,0,0,w,h);ctx.restore();};wrapped.__kefeIridescence=true;window.render=wrapped;const observer=new MutationObserver(addButton);observer.observe(document.body,{childList:true,subtree:true});window.KefeIridescenceFX={defaults,render:renderIridescence,canvas:()=>canvas};}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
