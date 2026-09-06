/* KEFE Visual FX — LiquidEther fluid-simulation background port.
   Native raw WebGL2 implementation (no Three.js/OGL dependency), following the
   aurora-fx.js pattern. Multi-pass Navier-Stokes-ish fluid sim: advection, external
   force, optional viscosity relaxation, divergence, pressure (Jacobi), and a final
   velocity-to-colour pass composited on top of the frame like the other Visual FX.

   NOTE: unlike aurora/iridescence/balatro (which are pure functions of time), this
   fluid sim's FBOs accumulate state frame-to-frame, so exported frames rendered
   out of sequence (e.g. seeking during export) will not be bit-exact vs. live
   preview playback — same tradeoff any real-time fluid sim has in a video tool.
   Mouse interactivity is replaced with a deterministic drifting force (a pure
   function of playback time) so behaviour is at least reproducible run-to-run. */
(() => {
  'use strict';

  const face_vert=`attribute vec3 position;uniform vec2 px;uniform vec2 boundarySpace;varying vec2 uv;precision highp float;void main(){vec3 pos=position;vec2 scale=1.0-boundarySpace*2.0;pos.xy=pos.xy*scale;uv=vec2(0.5)+(pos.xy)*0.5;gl_Position=vec4(pos,1.0);}`;
  const mouse_vert=`precision highp float;attribute vec3 position;attribute vec2 uv;uniform vec2 center;uniform vec2 scale;uniform vec2 px;varying vec2 vUv;void main(){vec2 pos=position.xy*scale*2.0*px+center;vUv=uv;gl_Position=vec4(pos,0.0,1.0);}`;
  const advection_frag=`precision highp float;uniform sampler2D velocity;uniform float dt;uniform bool isBFECC;uniform vec2 fboSize;uniform vec2 px;varying vec2 uv;void main(){vec2 ratio=max(fboSize.x,fboSize.y)/fboSize;if(isBFECC==false){vec2 vel=texture2D(velocity,uv).xy;vec2 uv2=uv-vel*dt*ratio;vec2 newVel=texture2D(velocity,uv2).xy;gl_FragColor=vec4(newVel,0.0,0.0);}else{vec2 spot_new=uv;vec2 vel_old=texture2D(velocity,uv).xy;vec2 spot_old=spot_new-vel_old*dt*ratio;vec2 vel_new1=texture2D(velocity,spot_old).xy;vec2 spot_new2=spot_old+vel_new1*dt*ratio;vec2 error=spot_new2-spot_new;vec2 spot_new3=spot_new-error/2.0;vec2 vel_2=texture2D(velocity,spot_new3).xy;vec2 spot_old2=spot_new3-vel_2*dt*ratio;vec2 newVel2=texture2D(velocity,spot_old2).xy;gl_FragColor=vec4(newVel2,0.0,0.0);}}`;
  const color_frag=`precision highp float;uniform sampler2D velocity;uniform sampler2D palette;uniform vec4 bgColor;varying vec2 uv;void main(){vec2 vel=texture2D(velocity,uv).xy;float lenv=clamp(length(vel),0.0,1.0);vec3 c=texture2D(palette,vec2(lenv,0.5)).rgb;vec3 outRGB=mix(bgColor.rgb,c,lenv);float outA=mix(bgColor.a,1.0,lenv);gl_FragColor=vec4(outRGB,outA);}`;
  const divergence_frag=`precision highp float;uniform sampler2D velocity;uniform float dt;uniform vec2 px;varying vec2 uv;void main(){float x0=texture2D(velocity,uv-vec2(px.x,0.0)).x;float x1=texture2D(velocity,uv+vec2(px.x,0.0)).x;float y0=texture2D(velocity,uv-vec2(0.0,px.y)).y;float y1=texture2D(velocity,uv+vec2(0.0,px.y)).y;float divergence=(x1-x0+y1-y0)/2.0;gl_FragColor=vec4(divergence/dt);}`;
  const externalForce_frag=`precision highp float;uniform vec2 force;uniform vec2 center;uniform vec2 scale;uniform vec2 px;varying vec2 vUv;void main(){vec2 circle=(vUv-0.5)*2.0;float d=1.0-min(length(circle),1.0);d*=d;gl_FragColor=vec4(force*d,0.0,1.0);}`;
  const poisson_frag=`precision highp float;uniform sampler2D pressure;uniform sampler2D divergence;uniform vec2 px;varying vec2 uv;void main(){float p0=texture2D(pressure,uv+vec2(px.x*2.0,0.0)).r;float p1=texture2D(pressure,uv-vec2(px.x*2.0,0.0)).r;float p2=texture2D(pressure,uv+vec2(0.0,px.y*2.0)).r;float p3=texture2D(pressure,uv-vec2(0.0,px.y*2.0)).r;float div=texture2D(divergence,uv).r;float newP=(p0+p1+p2+p3)/4.0-div;gl_FragColor=vec4(newP);}`;
  const pressure_frag=`precision highp float;uniform sampler2D pressure;uniform sampler2D velocity;uniform vec2 px;uniform float dt;varying vec2 uv;void main(){float step=1.0;float p0=texture2D(pressure,uv+vec2(px.x*step,0.0)).r;float p1=texture2D(pressure,uv-vec2(px.x*step,0.0)).r;float p2=texture2D(pressure,uv+vec2(0.0,px.y*step)).r;float p3=texture2D(pressure,uv-vec2(0.0,px.y*step)).r;vec2 v=texture2D(velocity,uv).xy;vec2 gradP=vec2(p0-p1,p2-p3)*0.5;v=v-gradP*dt;gl_FragColor=vec4(v,0.0,1.0);}`;
  const viscous_frag=`precision highp float;uniform sampler2D velocity;uniform sampler2D velocity_new;uniform float v;uniform vec2 px;uniform float dt;varying vec2 uv;void main(){vec2 old=texture2D(velocity,uv).xy;vec2 new0=texture2D(velocity_new,uv+vec2(px.x*2.0,0.0)).xy;vec2 new1=texture2D(velocity_new,uv-vec2(px.x*2.0,0.0)).xy;vec2 new2=texture2D(velocity_new,uv+vec2(0.0,px.y*2.0)).xy;vec2 new3=texture2D(velocity_new,uv-vec2(0.0,px.y*2.0)).xy;vec2 newv=4.0*old+v*dt*(new0+new1+new2+new3);newv/=4.0*(1.0+v*dt);gl_FragColor=vec4(newv,0.0,0.0);}`;

  const defaults={mouseForce:20,cursorSize:100,isViscous:false,viscous:30,iterationsViscous:32,iterationsPoisson:32,dt:.014,BFECC:true,resolution:.5,colors:['#FF8A4C','#FFC18A','#FF6B2C'],autoSpeed:.5,autoIntensity:2.2,intensity:1};

  let gl=null,canvas=null,width=1,height=1,fboWidth=1,fboHeight=1;
  let quadBuf=null,mouseBuf=null,paletteTex=null,paletteKey='';
  let progs=null,fbos=null,extType=null;
  let autoT0=performance.now();

  const compile=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){console.warn('[LiquidEther]',gl.getShaderInfoLog(s));gl.deleteShader(s);return null;}return s;};
  const link=(vsSrc,fsSrc,uniformNames)=>{const vs=compile(gl.VERTEX_SHADER,vsSrc),fs=compile(gl.FRAGMENT_SHADER,fsSrc);if(!vs||!fs)return null;const p=gl.createProgram();gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS)){console.warn('[LiquidEther]',gl.getProgramInfoLog(p));return null;}const u={};uniformNames.forEach(n=>{u[n]=gl.getUniformLocation(p,n);});const attribs={position:gl.getAttribLocation(p,'position'),uv:gl.getAttribLocation(p,'uv')};return{program:p,u,attribs};};

  const createFBO=(w,h)=>{const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,extType.internalFormat,w,h,0,gl.RGBA,extType.type,null);const fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);gl.bindFramebuffer(gl.FRAMEBUFFER,null);return{fbo,tex,w,h};};

  const bindQuad=(attribs)=>{gl.bindBuffer(gl.ARRAY_BUFFER,quadBuf);gl.enableVertexAttribArray(attribs.position);gl.vertexAttribPointer(attribs.position,3,gl.FLOAT,false,0,0);};
  const bindMouseQuad=(attribs)=>{gl.bindBuffer(gl.ARRAY_BUFFER,mouseBuf);const stride=5*4;gl.enableVertexAttribArray(attribs.position);gl.vertexAttribPointer(attribs.position,3,gl.FLOAT,false,stride,0);if(attribs.uv>=0){gl.enableVertexAttribArray(attribs.uv);gl.vertexAttribPointer(attribs.uv,2,gl.FLOAT,false,stride,3*4);}};

  const drawToFBO=(fbo,w,h)=>{gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.viewport(0,0,w,h);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);};

  function initGL(){
    if(canvas)return !!progs;
    canvas=document.createElement('canvas');
    canvas.className='kefe-liquidether-fx';
    canvas.setAttribute('aria-hidden','true');
    gl=canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:true,antialias:false});
    if(!gl)return false;
    if(gl.getExtension('EXT_color_buffer_float')){extType={internalFormat:gl.RGBA32F,type:gl.FLOAT};}
    else if(gl.getExtension('EXT_color_buffer_half_float')){extType={internalFormat:gl.RGBA16F,type:gl.HALF_FLOAT};}
    else{console.warn('[LiquidEther] no float render target support; effect disabled.');return false;}
    gl.getExtension('OES_texture_float_linear');

    quadBuf=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,0, 1,-1,0, -1,1,0, 1,1,0]),gl.STATIC_DRAW);

    mouseBuf=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,mouseBuf);
    // position.xyz, uv.xy — unit quad spanning -0.5..0.5
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([
      -0.5,-0.5,0, 0,0,
       0.5,-0.5,0, 1,0,
      -0.5, 0.5,0, 0,1,
       0.5, 0.5,0, 1,1
    ]),gl.STATIC_DRAW);

    progs={
      advection:link(face_vert,advection_frag,['px','boundarySpace','fboSize','velocity','dt','isBFECC']),
      externalForce:link(mouse_vert,externalForce_frag,['px','force','center','scale']),
      viscous:link(face_vert,viscous_frag,['boundarySpace','velocity','velocity_new','v','px','dt']),
      divergence:link(face_vert,divergence_frag,['boundarySpace','velocity','px','dt']),
      poisson:link(face_vert,poisson_frag,['boundarySpace','pressure','divergence','px']),
      pressure:link(face_vert,pressure_frag,['boundarySpace','pressure','velocity','px','dt']),
      color:link(face_vert,color_frag,['boundarySpace','velocity','palette','bgColor'])
    };
    for(const k in progs)if(!progs[k]){console.warn('[LiquidEther] shader link failed:',k);return false;}

    paletteTex=gl.createTexture();
    return true;
  }

  function makePalette(colors){
    const arr=Array.isArray(colors)&&colors.length?(colors.length===1?[colors[0],colors[0]]:colors):['#ffffff','#ffffff'];
    const w=arr.length,data=new Uint8Array(w*4);
    for(let i=0;i<w;i++){
      let h=String(arr[i]||'#fff').replace('#','');
      if(h.length===3)h=h.split('').map(x=>x+x).join('');
      const n=parseInt(h,16);
      data[i*4+0]=(n>>16)&255;data[i*4+1]=(n>>8)&255;data[i*4+2]=n&255;data[i*4+3]=255;
    }
    gl.bindTexture(gl.TEXTURE_2D,paletteTex);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,1,0,gl.RGBA,gl.UNSIGNED_BYTE,data);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  }

  function ensureFBOs(resolution){
    const w=Math.max(1,Math.round(resolution*width)),h=Math.max(1,Math.round(resolution*height));
    if(fbos&&fboWidth===w&&fboHeight===h)return;
    fboWidth=w;fboHeight=h;
    fbos={vel_0:createFBO(w,h),vel_1:createFBO(w,h),vel_viscous0:createFBO(w,h),vel_viscous1:createFBO(w,h),div:createFBO(w,h),pressure_0:createFBO(w,h),pressure_1:createFBO(w,h)};
  }

  const resizeCanvas=(w,h)=>{width=Math.max(1,w|0);height=Math.max(1,h|0);if(!canvas)return;canvas.width=width;canvas.height=height;};

  // Deterministic drifting force point — pure function of playback time, so behaviour
  // is reproducible regardless of when/how often render() gets called.
  function autoForce(time,speed,intensity){
    const wx=0.31*speed, wy=0.23*speed;
    const x=Math.sin(wx*time)*0.6, y=Math.cos(wy*time+1.7)*0.6;
    const dx=Math.cos(wx*time)*wx*0.6*0.016*intensity;
    const dy=-Math.sin(wy*time+1.7)*wy*0.6*0.016*intensity;
    return{x,y,dx,dy};
  }

  function step(settings){
    const px=[1/fboWidth,1/fboHeight];
    const boundarySpace=px; // isBounce always off in this port
    const force=autoForce(settings.time,settings.autoSpeed,settings.autoIntensity);

    // Advection
    let p=progs.advection;
    gl.useProgram(p.program);bindQuad(p.attribs);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,fbos.vel_0.tex);gl.uniform1i(p.u.velocity,0);
    gl.uniform2fv(p.u.px,px);gl.uniform2fv(p.u.boundarySpace,boundarySpace);gl.uniform2f(p.u.fboSize,fboWidth,fboHeight);
    gl.uniform1f(p.u.dt,settings.dt);gl.uniform1i(p.u.isBFECC,settings.BFECC?1:0);
    drawToFBO(fbos.vel_1.fbo,fboWidth,fboHeight);

    // External force (additive, onto vel_1)
    p=progs.externalForce;
    gl.useProgram(p.program);bindMouseQuad(p.attribs);
    const cursorSizeX=settings.cursorSize*px[0], cursorSizeY=settings.cursorSize*px[1];
    const centerX=Math.min(Math.max(force.x,-1+cursorSizeX+px[0]*2),1-cursorSizeX-px[0]*2);
    const centerY=Math.min(Math.max(force.y,-1+cursorSizeY+px[1]*2),1-cursorSizeY-px[1]*2);
    gl.uniform2fv(p.u.px,px);
    gl.uniform2f(p.u.force,(force.dx/2)*settings.mouseForce,(force.dy/2)*settings.mouseForce);
    gl.uniform2f(p.u.center,centerX,centerY);
    gl.uniform2f(p.u.scale,settings.cursorSize,settings.cursorSize);
    gl.bindFramebuffer(gl.FRAMEBUFFER,fbos.vel_1.fbo);gl.viewport(0,0,fboWidth,fboHeight);
    gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    gl.disable(gl.BLEND);

    let velSrc=fbos.vel_1;

    if(settings.isViscous){
      p=progs.viscous;gl.useProgram(p.program);bindQuad(p.attribs);
      let inFbo=fbos.vel_viscous0,outFbo=fbos.vel_viscous1;
      for(let i=0;i<settings.iterationsViscous;i++){
        inFbo=(i%2===0)?fbos.vel_viscous0:fbos.vel_viscous1;
        outFbo=(i%2===0)?fbos.vel_viscous1:fbos.vel_viscous0;
        gl.uniform2fv(p.u.boundarySpace,boundarySpace);
        gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,velSrc.tex);gl.uniform1i(p.u.velocity,0);
        gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,inFbo.tex);gl.uniform1i(p.u.velocity_new,1);
        gl.uniform1f(p.u.v,settings.viscous);gl.uniform2fv(p.u.px,px);gl.uniform1f(p.u.dt,settings.dt);
        drawToFBO(outFbo.fbo,fboWidth,fboHeight);
      }
      velSrc=outFbo;
    }

    // Divergence
    p=progs.divergence;gl.useProgram(p.program);bindQuad(p.attribs);
    gl.uniform2fv(p.u.boundarySpace,boundarySpace);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,velSrc.tex);gl.uniform1i(p.u.velocity,0);
    gl.uniform2fv(p.u.px,px);gl.uniform1f(p.u.dt,settings.dt);
    drawToFBO(fbos.div.fbo,fboWidth,fboHeight);

    // Poisson (pressure solve)
    p=progs.poisson;gl.useProgram(p.program);bindQuad(p.attribs);
    let pIn=fbos.pressure_0,pOut=fbos.pressure_1;
    for(let i=0;i<settings.iterationsPoisson;i++){
      pIn=(i%2===0)?fbos.pressure_0:fbos.pressure_1;
      pOut=(i%2===0)?fbos.pressure_1:fbos.pressure_0;
      gl.uniform2fv(p.u.boundarySpace,boundarySpace);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,pIn.tex);gl.uniform1i(p.u.pressure,0);
      gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,fbos.div.tex);gl.uniform1i(p.u.divergence,1);
      gl.uniform2fv(p.u.px,px);
      drawToFBO(pOut.fbo,fboWidth,fboHeight);
    }

    // Pressure gradient subtraction -> vel_0
    p=progs.pressure;gl.useProgram(p.program);bindQuad(p.attribs);
    gl.uniform2fv(p.u.boundarySpace,boundarySpace);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,pOut.tex);gl.uniform1i(p.u.pressure,0);
    gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,velSrc.tex);gl.uniform1i(p.u.velocity,1);
    gl.uniform2fv(p.u.px,px);gl.uniform1f(p.u.dt,settings.dt);
    drawToFBO(fbos.vel_0.fbo,fboWidth,fboHeight);
  }

  const renderLiquidEther=(time,settings)=>{
    if(!initGL())return null;
    ensureFBOs(settings.resolution);
    const key=(settings.colors||defaults.colors).join(',');
    if(key!==paletteKey){makePalette(settings.colors||defaults.colors);paletteKey=key;}

    step({...settings,time});

    // Final colour pass, straight to canvas
    const p=progs.color;
    gl.useProgram(p.program);bindQuad(p.attribs);
    gl.uniform2fv(p.u.boundarySpace,[0,0]);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,fbos.vel_0.tex);gl.uniform1i(p.u.velocity,0);
    gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,paletteTex);gl.uniform1i(p.u.palette,1);
    gl.uniform4f(p.u.bgColor,0,0,0,0);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    gl.viewport(0,0,canvas.width,canvas.height);
    gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    gl.disable(gl.BLEND);
    return canvas;
  };

  function addButton(){const buttons=document.getElementById('visualFxBackgroundButtons')||document.querySelector('.kefe-fx-button')?.parentElement;if(!buttons||buttons.querySelector('[data-fx="liquidether"]'))return;const b=document.createElement('button');b.type='button';b.dataset.fx='liquidether';b.className='kefe-fx-button';b.textContent='Liquid Ether';b.addEventListener('click',()=>{window.state.style.visualFx='liquidether';document.querySelectorAll('.kefe-fx-button').forEach(x=>x.classList.toggle('active-effect',x.dataset.fx==='liquidether'));const l=document.getElementById('visualFxLabel');if(l)l.textContent='Liquid Ether — WebGL fluid simulation';window.redrawCurrentPreviewFrame?.();});buttons.appendChild(b);}

  function boot(){
    if(!window.state||typeof window.render!=='function')return;
    addButton();
    const previous=window.render;
    if(previous.__kefeLiquidEther)return;
    const wrapped=function(ctx,w,h,state,media){
      previous(ctx,w,h,state,media);
      if(state?.style?.visualFx!=='liquidether')return;
      resizeCanvas(w,h);
      const s={
        ...defaults,
        mouseForce:Number(state.style.liquidEtherMouseForce)||defaults.mouseForce,
        cursorSize:Number(state.style.liquidEtherCursorSize)||defaults.cursorSize,
        isViscous:!!state.style.liquidEtherIsViscous,
        viscous:Number(state.style.liquidEtherViscous)||defaults.viscous,
        iterationsViscous:Number(state.style.liquidEtherIterationsViscous)||defaults.iterationsViscous,
        iterationsPoisson:Number(state.style.liquidEtherIterationsPoisson)||defaults.iterationsPoisson,
        dt:Number(state.style.liquidEtherDt)||defaults.dt,
        BFECC:state.style.liquidEtherBFECC!==false,
        resolution:Number(state.style.liquidEtherResolution)||defaults.resolution,
        colors:state.style.liquidEtherColors||defaults.colors,
        autoSpeed:Number(state.style.liquidEtherAutoSpeed)||defaults.autoSpeed,
        autoIntensity:Number(state.style.liquidEtherAutoIntensity)||defaults.autoIntensity,
        intensity:Number(state.style.liquidEtherIntensity)||defaults.intensity
      };
      const c=renderLiquidEther(Number(state.playback?.currentTime)||0,s);
      if(!c)return;
      ctx.save();ctx.globalAlpha=Math.max(0,Math.min(1,s.intensity));ctx.drawImage(c,0,0,w,h);ctx.restore();
    };
    wrapped.__kefeLiquidEther=true;
    window.render=wrapped;
    const observer=new MutationObserver(addButton);observer.observe(document.body,{childList:true,subtree:true});
    window.KefeLiquidEtherFX={defaults,render:renderLiquidEther,canvas:()=>canvas};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
