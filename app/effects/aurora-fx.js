/* KEFE Visual FX — React Bits Aurora background port.
   Native WebGL implementation of the supplied Aurora component; no React/OGL dependency. */
(() => {
  'use strict';

  const VERT = `#version 300 es
in vec2 position;
void main(){gl_Position=vec4(position,0.0,1.0);}`;

  const FRAG = `#version 300 es
precision highp float;
uniform float uTime;
uniform float uAmplitude;
uniform vec3 uColorStops[3];
uniform vec2 uResolution;
uniform float uBlend;
uniform float uLightMode;
out vec4 fragColor;
vec3 permute(vec3 x){return mod(((x*34.0)+1.0)*x,289.0);}
float snoise(vec2 v){
 const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
 vec2 i=floor(v+dot(v,C.yy)); vec2 x0=v-i+dot(i,C.xx);
 vec2 i1=(x0.x>x0.y)?vec2(1.0,0.0):vec2(0.0,1.0);
 vec4 x12=x0.xyxy+C.xxzz; x12.xy-=i1; i=mod(i,289.0);
 vec3 p=permute(permute(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));
 vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);
 m*=m; m*=m;
 vec3 x=2.0*fract(p*C.www)-1.0; vec3 h=abs(x)-0.5; vec3 ox=floor(x+0.5); vec3 a0=x-ox;
 m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);
 vec3 g; g.x=a0.x*x0.x+h.x*x0.y; g.yz=a0.yz*x12.xz+h.yz*x12.yw;
 return 130.0*dot(m,g);
}
struct ColorStop{vec3 color;float position;};
#define COLOR_RAMP(colors,factor,finalColor){int index=0;for(int i=0;i<2;i++){ColorStop currentColor=colors[i];bool isInBetween=currentColor.position<=factor;index=int(mix(float(index),float(i),float(isInBetween)));}ColorStop currentColor=colors[index];ColorStop nextColor=colors[index+1];float range=nextColor.position-currentColor.position;float lerpFactor=(factor-currentColor.position)/range;finalColor=mix(currentColor.color,nextColor.color,lerpFactor);}
void main(){
 vec2 uv=gl_FragCoord.xy/uResolution; ColorStop colors[3];
 colors[0]=ColorStop(uColorStops[0],0.0);colors[1]=ColorStop(uColorStops[1],0.5);colors[2]=ColorStop(uColorStops[2],1.0);
 vec3 rampColor;COLOR_RAMP(colors,uv.x,rampColor);
 float height=snoise(vec2(uv.x*2.0+uTime*0.1,uTime*0.25))*0.5*uAmplitude;
 height=exp(height); height=(uv.y*2.0-height+0.2); float intensity=0.6*height;
 float midPoint=0.20;float auroraAlpha=smoothstep(midPoint-uBlend*0.5,midPoint+uBlend*0.5,intensity);vec3 auroraColor=intensity*rampColor;
 if(uLightMode>0.5){float energy=clamp(max(intensity,0.0),0.0,1.0);float coverage=clamp(auroraAlpha*(0.55+0.45*energy),0.0,0.86);vec3 chroma=pow(clamp(rampColor,0.0,1.0),vec3(1.2));float chromaPeak=max(chroma.r,max(chroma.g,chroma.b));chroma/=max(chromaPeak,0.0001);fragColor=vec4(mix(vec3(1.0),chroma,min(coverage*1.08,0.94)),1.0);}
 else fragColor=vec4(auroraColor*auroraAlpha,auroraAlpha);
}`;

  const defaults={colorStops:['#5227FF','#7cff67','#5227FF'],amplitude:1,blend:.5,lightMode:false,speed:1,intensity:.78};
  let renderer=null,gl=null,program=null,canvas=null,buffer=null,vertexShader=null,fragmentShader=null,width=1,height=1;

  const hex=h=>{h=String(h||'#fff').replace('#','');if(h.length===3)h=h.split('').map(x=>x+x).join('');const n=parseInt(h,16);return[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255];};
  const compile=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){gl.deleteShader(s);return null;}return s;};
  const init=()=>{
    if(canvas)return true;
    canvas=document.createElement('canvas');canvas.className='kefe-aurora-fx';canvas.setAttribute('aria-hidden','true');
    gl=canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:true,antialias:true});
    if(!gl)return false;
    vertexShader=compile(gl.VERTEX_SHADER,VERT);fragmentShader=compile(gl.FRAGMENT_SHADER,FRAG);if(!vertexShader||!fragmentShader)return false;
    program=gl.createProgram();gl.attachShader(program,vertexShader);gl.attachShader(program,fragmentShader);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))return false;
    buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    renderer={start:performance.now()};return true;
  };
  const resize=(w,h)=>{width=Math.max(1,w|0);height=Math.max(1,h|0);if(!canvas)return;const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);canvas.style.width=width+'px';canvas.style.height=height+'px';gl.viewport(0,0,canvas.width,canvas.height);};
  const renderAurora=(time,settings)=>{
    if(!init())return null; const s={...defaults,...settings};
    const dpr=Math.min(window.devicePixelRatio||1,2);gl.viewport(0,0,Math.round(width*dpr),Math.round(height*dpr));gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    const loc=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
    gl.uniform1f(gl.getUniformLocation(program,'uTime'),time*s.speed*.1);gl.uniform1f(gl.getUniformLocation(program,'uAmplitude'),s.amplitude);gl.uniform2f(gl.getUniformLocation(program,'uResolution'),width*dpr,height*dpr);gl.uniform1f(gl.getUniformLocation(program,'uBlend'),s.blend);gl.uniform1f(gl.getUniformLocation(program,'uLightMode'),s.lightMode?1:0);
    const stops=(s.colorStops||defaults.colorStops).slice(0,3).map(hex);gl.uniform3fv(gl.getUniformLocation(program,'uColorStops'),new Float32Array(stops.flat()));
    gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);return canvas;
  };

  function addButton(){
    const buttons=document.querySelector('.kefe-fx-button')?.parentElement;if(!buttons||buttons.querySelector('[data-fx="aurora"]'))return;
    const b=document.createElement('button');b.type='button';b.dataset.fx='aurora';b.className='kefe-fx-button';b.textContent='Aurora';
    b.addEventListener('click',()=>{window.state.style.visualFx='aurora';document.querySelectorAll('.kefe-fx-button').forEach(x=>x.classList.toggle('active-effect',x.dataset.fx==='aurora'));const l=document.getElementById('visualFxLabel');if(l)l.textContent='Aurora — animated WebGL colour field';window.redrawCurrentPreviewFrame?.();});
    buttons.appendChild(b);
  }

  function boot(){
    if(!window.state||typeof window.render!=='function')return;
    addButton();
    const previous=window.render;
    if(previous.__kefeAurora)return;
    const wrapped=function(ctx,w,h,state,media){
      previous(ctx,w,h,state,media);
      if(state?.style?.visualFx!=='aurora')return;
      const s={...defaults,amplitude:Number(state.style.auroraAmplitude)||defaults.amplitude,blend:Number(state.style.auroraBlend)||defaults.blend,speed:Number(state.style.auroraSpeed)||defaults.speed,intensity:Number(state.style.auroraIntensity)||defaults.intensity,colorStops:state.style.auroraColorStops||defaults.colorStops};
      const c=renderAurora(Number(state.playback?.currentTime)||0,s);if(!c)return;
      ctx.save();ctx.globalAlpha=Math.max(0,Math.min(1,s.intensity));ctx.drawImage(c,0,0,w,h);ctx.restore();
    };wrapped.__kefeAurora=true;window.render=wrapped;
    const observer=new MutationObserver(addButton);observer.observe(document.body,{childList:true,subtree:true});
    window.KefeAuroraFX={defaults,render:renderAurora,canvas:()=>canvas};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
