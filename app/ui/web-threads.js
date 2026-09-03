/* KEFE — Web Threads (React Bits-compatible vanilla WebGL port) */
(() => {
  'use strict';

  const DEFAULTS = {
    color1:'#EF4444', color2:'#9b0707', color3:'#ff2626',
    speed:0.1, threadCount:2, frequency:2.5, spread:0.14, taper:0.3,
    position:0.5, fanMode:'right', glow:0.06, falloff:1.2,
    thickness:0.3, brightness:2.5, opacity:0.02, mirror:true,
    shimmer:true, grain:true, grainIntensity:0,
    mouseInteraction:true, mouseStrength:0.61
  };

  const FAN_MODE = {center:0,left:1,right:2};
  const hexToRgb = hex => {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex));
    return m ? [parseInt(m[1],16)/255,parseInt(m[2],16)/255,parseInt(m[3],16)/255] : [1,1,1];
  };

  const vertex = `#version 300 es
in vec2 position;
void main(){gl_Position=vec4(position,0.0,1.0);}`;

  const fragment = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime,uSpeed,uThreadCount,uFrequency,uSpread,uTaper,uPosition,uFanMode,uGlow,uFalloff,uThickness,uBrightness,uOpacity,uMirror,uShimmer,uGrain,uGrainIntensity;
uniform vec3 uColor1,uColor2,uColor3;
uniform vec2 uMouse;
uniform float uMouseStrength,uEnableMouse,uMouseActive;
out vec4 fragColor;
#define TAU 6.28318530718
#define MAX_THREADS 10
float glow(float x,float str,float dist){return dist/pow(max(x,1e-4),str);}
void main(){
  vec2 uv=gl_FragCoord.xy/iResolution.xy;
  float n=max(uThreadCount,1.0);
  float pinchX=uFanMode<0.5?0.5:(uFanMode<1.5?0.0:1.0);
  if(uEnableMouse>0.5) pinchX=mix(pinchX,uMouse.x,clamp(uMouseStrength,0.0,1.0)*uMouseActive);
  float spreadDx=uSpread*abs(uv.x-pinchX);
  float baseT=iTime*uSpeed;
  float tauOverN=TAU/n;
  float mirror=uMirror>0.5?sign(pinchX-uv.x):1.0;
  bool doShimmer=uShimmer>0.5;
  float shimmerT=iTime*1.7;
  float invThickness=1.0/max(uThickness,0.01);
  float xFreq=uv.x*uFrequency;
  float yOff=uv.y-uPosition;
  float ciScale=n>1.0?1.0/(n-1.0):0.0;
  vec3 col=vec3(0.0); float gsum=0.0;
  for(int idx=0;idx<MAX_THREADS;idx++){
    float i=float(idx); if(i>=n) break;
    float amplitude=spreadDx*(1.0+i*uTaper);
    float shimmer=doShimmer?sin(shimmerT+i*1.3)*0.35:0.0;
    float phase=(baseT+i*tauOverN)*mirror+shimmer;
    float sdf=abs(yOff+sin(xFreq+phase)*amplitude)*invThickness;
    float g=glow(sdf,uFalloff,uGlow);
    float ci=i*ciScale;
    vec3 threadCol=mix(uColor1,uColor2,ci);
    col+=g*threadCol; gsum+=g;
  }
  float coreAmt=smoothstep(0.5,2.2,gsum);
  col=mix(col,uColor3*gsum,coreAmt*0.5);
  float bright=uBrightness;
  if(uEnableMouse>0.5){vec2 md=uv-uMouse;float d2=dot(md,md);bright+=clamp(uMouseStrength,0.0,1.0)*uMouseActive*exp(-d2*6.0)*0.6;}
  col*=bright;
  float alpha=clamp(gsum,0.0,1.0)*uOpacity;
  vec3 outRgb=col*alpha;
  if(uGrain>0.5){float gv=(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233))+iTime)*43758.5453)-0.5)*uGrainIntensity;outRgb=clamp(outRgb+gv,0.0,1.0);alpha=clamp(alpha+gv,0.0,1.0);}
  fragColor=vec4(outRgb,alpha);
}`;

  const create = (options={}) => {
    const s={...DEFAULTS,...options};
    const canvas=document.createElement('canvas');
    canvas.className='kefe-web-threads';
    canvas.setAttribute('aria-hidden','true');
    const gl=canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:true,antialias:false});
    if(!gl){canvas.style.display='none';return {canvas,refresh(){},start(){},stop(){},destroy(){canvas.remove()}};}

    const compile=(type,source)=>{const sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh));return sh};
    const program=gl.createProgram();
    gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));
    gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);

    const positions=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,positions);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    const pos=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);

    const names=['iResolution','iTime','uSpeed','uThreadCount','uFrequency','uSpread','uTaper','uPosition','uFanMode','uGlow','uFalloff','uThickness','uBrightness','uOpacity','uMirror','uShimmer','uGrain','uGrainIntensity','uColor1','uColor2','uColor3','uMouse','uMouseStrength','uEnableMouse','uMouseActive'];
    const u={};names.forEach(n=>u[n]=gl.getUniformLocation(program,n));
    const set3=(n,c)=>{const v=hexToRgb(c);gl.uniform3f(u[n],v[0],v[1],v[2]);};
    const apply=()=>{
      gl.useProgram(program);
      gl.uniform1f(u.uSpeed,s.speed);gl.uniform1f(u.uThreadCount,Math.min(10,Math.max(1,Math.round(s.threadCount))));
      gl.uniform1f(u.uFrequency,s.frequency);gl.uniform1f(u.uSpread,s.spread);gl.uniform1f(u.uTaper,s.taper);gl.uniform1f(u.uPosition,s.position);
      gl.uniform1f(u.uFanMode,FAN_MODE[s.fanMode]??0);gl.uniform1f(u.uGlow,s.glow);gl.uniform1f(u.uFalloff,s.falloff);gl.uniform1f(u.uThickness,s.thickness);
      gl.uniform1f(u.uBrightness,s.brightness);gl.uniform1f(u.uOpacity,s.opacity);gl.uniform1f(u.uMirror,s.mirror?1:0);gl.uniform1f(u.uShimmer,s.shimmer?1:0);
      gl.uniform1f(u.uGrain,s.grain?1:0);gl.uniform1f(u.uGrainIntensity,s.grainIntensity);gl.uniform1f(u.uMouseStrength,s.mouseStrength);gl.uniform1f(u.uEnableMouse,s.mouseInteraction?1:0);
      set3('uColor1',s.color1);set3('uColor2',s.color2);set3('uColor3',s.color3);
    };
    apply();

    let w=1,h=1,raf=0,running=true,start=performance.now();
    let mx=.5,my=.5,tx=.5,ty=.5,active=0;
    const resize=()=>{const r=canvas.getBoundingClientRect();w=Math.max(1,Math.floor(r.width));h=Math.max(1,Math.floor(r.height));const d=Math.min(devicePixelRatio||1,2);canvas.width=Math.max(1,Math.floor(w*d));canvas.height=Math.max(1,Math.floor(h*d));gl.viewport(0,0,canvas.width,canvas.height);gl.uniform2f(u.iResolution,canvas.width,canvas.height);};
    const move=e=>{if(!s.mouseInteraction)return;const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;tx=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));ty=Math.max(0,Math.min(1,1-(e.clientY-r.top)/r.height));active=1;};
    const enter=()=>{active=1;};const leave=()=>{active=0;};
    canvas.addEventListener('mousemove',move);canvas.addEventListener('mouseenter',enter);canvas.addEventListener('mouseleave',leave);
    const ro='ResizeObserver'in window?new ResizeObserver(resize):null;ro?.observe(canvas);window.addEventListener('resize',resize,{passive:true});resize();
    const frame=now=>{if(!running)return;mx+=.05*(tx-mx);my+=.05*(ty-my);gl.useProgram(program);gl.uniform1f(u.iTime,(now-start)*.001);gl.uniform2f(u.uMouse,mx,my);gl.uniform1f(u.uMouseActive,active);gl.drawArrays(gl.TRIANGLES,0,3);raf=requestAnimationFrame(frame);};
    raf=requestAnimationFrame(frame);
    return {canvas,refresh:resize,start(){if(!running){running=true;start=performance.now();raf=requestAnimationFrame(frame);}},stop(){running=false;cancelAnimationFrame(raf);raf=0;},destroy(){running=false;cancelAnimationFrame(raf);ro?.disconnect();window.removeEventListener('resize',resize);canvas.removeEventListener('mousemove',move);canvas.removeEventListener('mouseenter',enter);canvas.removeEventListener('mouseleave',leave);canvas.remove();}};
  };

  window.KefeWebThreads={create,defaults:{...DEFAULTS}};
})();
