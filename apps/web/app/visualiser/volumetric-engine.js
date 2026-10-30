/* KEFE Volumetric Engine — adapted from the supplied standalone WebGL engine.
   Owns one visualiser tab, one preview canvas and one isolated parameter set. */
(function () {
  'use strict';

  const PRESETS = {
    chromatica: { hue:180, volume:2.20, warp:5.2, speed:.003, visc:2.95, tilt:-.95, rot:80, scale:.45, fov:.85, sheen:2, fog:1.35, ambient:.05, grain:0, light:61, mode:.9, holo:3 },
    carrie:     { hue:360, volume:2.90, warp:5.4, speed:.010, visc:2.90, tilt:1.35, rot:124, scale:.20, fov:1.85, sheen:2, fog:.50, ambient:.85, grain:.02, light:102, mode:3, holo:5 },
    katara:     { hue:190, volume:2.50, warp:4.8, speed:.010, visc:2.20, tilt:.50, rot:120, scale:.60, fov:1.30, sheen:2, fog:.50, ambient:.80, grain:0, light:180, mode:1.5, holo:6 },
    iridizon:   { hue:180, volume:2.70, warp:4.8, speed:.003, visc:2.27, tilt:1.03, rot:154, scale:.85, fov:.65, sheen:1.85, fog:.60, ambient:.95, grain:.02, light:72, mode:1, holo:2 },
    lumina:     { hue:180, volume:.50, warp:4.7, speed:.015, visc:3, tilt:.89, rot:251, scale:.20, fov:.70, sheen:1.85, fog:0, ambient:.80, grain:.14, light:160, mode:1, holo:1 },
    manuka:     { hue:30, volume:2.30, warp:6, speed:.005, visc:3, tilt:1.75, rot:98, scale:.15, fov:2, sheen:1.8, fog:.05, ambient:1, grain:0, light:21, mode:0, holo:4 }
  };
  const DEFINITIONS = [
    ['hue','Color shift',0,360,1,'°'], ['visc','Viscosity',.5,3.5,.05],
    ['volume','Volume',.5,3,.1], ['grain','Grain',0,.2,.01],
    ['mode','Behavior',0,3,.1], ['speed','Stir speed',0,.03,.001],
    ['scale','Fold scale',.1,1.5,.05], ['warp','Mix intensity',1,6,.1],
    ['tilt','Camera pitch',-1.5,2,.05], ['rot','Camera yaw',0,360,1,'°'],
    ['light','Light angle',0,360,1,'°'], ['sheen','Wet sheen',0,2,.05],
    ['fov','FOV / zoom',.3,2.5,.05], ['fog','Depth fog',0,1.5,.05],
    ['ambient','Ambient light',.05,1,.05]
  ];
  const GROUPS = [
    ['Material',['hue','visc','volume','grain']],
    ['Physics',['mode','speed','scale','warp']],
    ['Camera & lighting',['tilt','rot','light','sheen','fov','fog','ambient']]
  ];
  let state = { ...PRESETS.chromatica }, stage, canvas, gl, program, uniforms = {};
  let active = false, enabled = false, raf = 0, elapsed = 0, last = 0, failed = false;
  const $ = id => document.getElementById(id);
  const VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  const FS = String.raw`precision highp float;
uniform vec2 R; uniform float T,VOLUME,WARP,HUE,VISC,TILT,ROT,SCALE,FOV,SHEEN,FOG,AMBIENT,GRAIN,LIGHT_ANGLE,MODE;
uniform int HOLO_TYPE;
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.+vec2(1.7,9.2);a*=.5;}return v;}
vec3 hsl2rgb(float h,float s,float l){vec3 rgb=clamp(abs(mod(h*6.+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.);return l+s*(rgb-.5)*(1.-abs(2.*l-1.));}
vec2 behavior(vec2 p,float t){vec2 a=p,b=p,c=p,d=p;if(MODE<1.){a=p+vec2(sin(p.y*2.+t),cos(p.x*2.-t))*(1.-MODE)*1.5;b=p+vec2(MODE*2.,sin(p.x*3.+t*.5)*MODE*1.5);return mix(a,b,MODE);}if(MODE<2.){b=p+vec2(1.,sin(p.x*3.+t*.5));c=p+vec2(sin(p.y*4.+t)*(MODE-1.)*2.,cos(p.x*4.-t)*(MODE-1.)*2.);return mix(b,c,MODE-1.);}c=p+vec2(sin(p.y*4.+t)*(3.-MODE)*2.,cos(p.x*4.-t)*(3.-MODE)*2.);d=p+vec2((MODE-2.)*3.,cos(p.y*2.+t*.2)*(MODE-2.)*1.5);return mix(c,d,MODE-2.);}
float heightAt(vec2 p,float t){vec2 q=behavior(p,t);float s=(HOLO_TYPE==2||HOLO_TYPE==3)?SCALE*.6:SCALE;vec2 a=vec2(fbm(q*.8*s+t*.1),fbm(q*.8*s-t*.08+5.2));vec2 b=vec2(fbm(q*s+WARP*a+t*.15),fbm(q*s+WARP*a+vec2(8.3,2.8)-t*.12));float h=fbm(q*s+WARP*b);return smoothstep(.5-VISC*.2,.5+VISC*.2,h);}
void main(){vec2 uv=gl_FragCoord.xy/R;vec2 p=(uv-.5)*vec2(R.x/R.y,1.)*FOV;float th=ROT*.0174532925,ph=(TILT-1.)*1.5;vec3 cam=vec3(sin(th)*cos(ph),sin(ph),cos(th)*cos(ph));vec3 up=vec3(0.,1.,0.);vec3 right=normalize(cross(up,cam));vec3 camUp=cross(cam,right);vec2 q=p.x*right.xy+p.y*camUp.xy;float h=heightAt(q,T),e=.02;float hx=heightAt(q+vec2(e,0.),T)-h,hy=heightAt(q+vec2(0.,e),T)-h;vec3 N=normalize(vec3(-hx/e*VOLUME,-hy/e*VOLUME+cam.y,cam.z+.5));float lr=LIGHT_ANGLE*.0174532925;vec3 L=normalize(vec3(cos(lr),sin(lr),.8)),V=normalize(cam),H=normalize(L+V);float diff=max(dot(N,L),0.),spec=pow(max(dot(N,H),0.),32.)*SHEEN,ao=smoothstep(0.,.3,h)*.5+.5,viewAngle=dot(N,V);vec3 col;
if(HOLO_TYPE==6){vec3 deep=vec3(0.,.1,.25),bright=vec3(.1,.7,.9),ice=vec3(.9,1.,1.);float edge=pow(clamp(1.-abs(h-.5)*4.,0.,1.),2.);col=mix(deep,bright,smoothstep(.2,.8,h));col=mix(col,ice,pow(spec,1.2)*1.8);col=mix(col,vec3(0.,.5,.8),edge*.5);col*=(AMBIENT+(1.2-AMBIENT)*diff)*ao;}
else if(HOLO_TYPE==3){float m=smoothstep(.3,.7,h);col=mix(vec3(.2,.22,.25),vec3(.85,.87,.9),m);col*=(AMBIENT+(1.2-AMBIENT)*diff)*ao;col+=vec3(1.)*pow(spec,3.)*2.5;}
else if(HOLO_TYPE==2){float shift=h*2.+viewAngle*.5+HUE;col=mix(hsl2rgb(fract(shift),.4,.75),hsl2rgb(fract(shift+.15),.5,.85),smoothstep(.1,.8,h));col*=(AMBIENT+(1.2-AMBIENT)*diff)*ao;col+=vec3(1.)*pow(spec,2.)*.5;}
else if(HOLO_TYPE==5){col=mix(vec3(.15,0.,0.),vec3(.6,.02,.02),smoothstep(.1,.5,h));col=mix(col,vec3(1.,.1,.1),smoothstep(.5,.9,h)*pow(diff,2.));col*=(AMBIENT+(1.2-AMBIENT)*diff)*ao;col+=vec3(1.,.8,.8)*spec;}
else if(HOLO_TYPE==1){float prism=fract(viewAngle*2.5+h*1.5+HUE);col=vec3(.02,.02,.05)+hsl2rgb(prism,1.,.65)*pow(spec,2.)*2.5+vec3(.9,.95,1.)*pow(diff,3.)*.4;col*=(AMBIENT*.5+(1.-AMBIENT)*diff);}
else if(HOLO_TYPE==4){col=mix(vec3(.15,.05,0.),vec3(.85,.45,0.),smoothstep(.1,.5,h));col=mix(col,vec3(1.,.9,.4),smoothstep(.4,.9,h));col*=(AMBIENT+(1.2-AMBIENT)*diff)*ao;col+=vec3(1.)*spec*.5;}
else{vec3 a=hsl2rgb(HUE,.8,.25),b=hsl2rgb(HUE,.9,.55),c=hsl2rgb(HUE,1.,.75);float p1=smoothstep(0.,5.,T),p2=smoothstep(5.,15.,T);col=mix(a,b,smoothstep(.1,.5,h)*p1);col=mix(col,c,smoothstep(.4,.9,h)*p2);col*=(AMBIENT+(1.2-AMBIENT)*diff)*ao;col+=vec3(1.)*spec;}
float depth=smoothstep(-1.5,1.5,p.y);col*=mix(1.-FOG*.3,1.,depth);col+=(hash(gl_FragCoord.xy+T)-.5)*GRAIN;gl_FragColor=vec4(clamp(col,0.,1.),1.);}`;

  function compile(type, source) {
    const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
    return shader;
  }
  function initGL() {
    gl = canvas.getContext('webgl', { antialias: true, alpha: false, powerPreference: 'high-performance' });
    if (!gl) throw Error('WebGL is unavailable');
    program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    const attr = gl.getAttribLocation(program, 'a');
    gl.enableVertexAttribArray(attr); gl.vertexAttribPointer(attr, 2, gl.FLOAT, false, 0, 0);
    ['R','T','VOLUME','WARP','HUE','VISC','TILT','ROT','SCALE','FOV','SHEEN','FOG','AMBIENT','GRAIN','LIGHT_ANGLE','MODE','HOLO_TYPE']
      .forEach(key => uniforms[key] = gl.getUniformLocation(program, key));
  }
  function resize() {
    if (!stage || !canvas || !gl) return;
    const rect = stage.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.min(3840, Math.round(rect.width * dpr)));
    const h = Math.max(1, Math.min(2160, Math.round(rect.height * dpr)));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0,0,w,h); }
  }
  function render(now) {
    raf = requestAnimationFrame(render);
    if (!gl || !active || !enabled || document.hidden) return;
    const dt = Math.min(.05, Math.max(0, (now - (last || now)) / 1000)); last = now;
    elapsed += dt * state.speed * 10;
    resize(); gl.useProgram(program);
    gl.uniform2f(uniforms.R, canvas.width, canvas.height);
    gl.uniform1f(uniforms.T, elapsed);
    gl.uniform1f(uniforms.VOLUME, state.volume); gl.uniform1f(uniforms.WARP, state.warp);
    gl.uniform1f(uniforms.HUE, state.hue / 360); gl.uniform1f(uniforms.VISC, state.visc);
    gl.uniform1f(uniforms.TILT, state.tilt); gl.uniform1f(uniforms.ROT, state.rot);
    gl.uniform1f(uniforms.SCALE, state.scale); gl.uniform1f(uniforms.FOV, state.fov);
    gl.uniform1f(uniforms.SHEEN, state.sheen); gl.uniform1f(uniforms.FOG, state.fog);
    gl.uniform1f(uniforms.AMBIENT, state.ambient); gl.uniform1f(uniforms.GRAIN, state.grain);
    gl.uniform1f(uniforms.LIGHT_ANGLE, state.light); gl.uniform1f(uniforms.MODE, state.mode);
    gl.uniform1i(uniforms.HOLO_TYPE, state.holo);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  function format(key, value) {
    if (['hue','rot','light'].includes(key)) return Math.round(value) + '°';
    if (key === 'speed') return value.toFixed(3);
    if (['warp','mode'].includes(key)) return value.toFixed(1);
    return value.toFixed(2);
  }
  function setValue(key, value) {
    const def = DEFINITIONS.find(item => item[0] === key);
    const rounded = Math.max(def[2], Math.min(def[3], Math.round(value / def[4]) * def[4]));
    state[key] = Number(rounded.toFixed(4));
    const input = $('kefeVolumetric-' + key), output = $('kefeVolumetric-' + key + '-value');
    if (input) input.value = state[key];
    if (output) output.textContent = format(key, state[key]);
    document.querySelectorAll('[data-volumetric-preset]').forEach(button => { button.classList.remove('primary'); button.setAttribute('aria-pressed','false'); });
  }
  function applyPreset(id) {
    if (!PRESETS[id]) return;
    state = { ...PRESETS[id] };
    DEFINITIONS.forEach(([key]) => {
      const input = $('kefeVolumetric-' + key), output = $('kefeVolumetric-' + key + '-value');
      if (input) input.value = state[key];
      if (output) output.textContent = format(key, state[key]);
    });
    document.querySelectorAll('[data-volumetric-preset]').forEach(button => {
      const selected = button.dataset.volumetricPreset === id;
      button.classList.toggle('primary', selected); button.setAttribute('aria-pressed', String(selected));
    });
    elapsed = 0;
  }
  function makeControl([key,label,min,max,step]) {
    const row = document.createElement('label'); row.className = 'kefe-visualiser-field';
    const head = document.createElement('span'), title = document.createElement('b');
    const output = document.createElement('output'), input = document.createElement('input');
    title.textContent = label; output.id = 'kefeVolumetric-' + key + '-value';
    output.textContent = format(key, state[key]); input.type = 'range'; input.id = 'kefeVolumetric-' + key;
    input.min = min; input.max = max; input.step = step; input.value = state[key];
    input.addEventListener('input', () => { setValue(key, Number(input.value)); });
    head.append(title, output); row.append(head, input); return row;
  }
  function buildUI() {
    const panel = document.querySelector('[data-panel-view="visualiser"]');
    const form = panel && panel.querySelector('.kefe-visualiser-form');
    const tabs = panel && panel.querySelector('.kefe-vis-tabs');
    if (!form || !tabs) return;
    const view = document.createElement('section'); view.className = 'kefe-vis-view kefe-volumetric-view';
    view.id = 'kefeVisVolumetricView'; view.hidden = true;
    const presetGroup = document.createElement('div'); presetGroup.className = 'kefe-visualiser-control-group';
    presetGroup.appendChild(Object.assign(document.createElement('div'), { className:'kefe-label', textContent:'Presets' }));
    const presetList = document.createElement('div'); presetList.className = 'kefe-volumetric-presets';
    Object.keys(PRESETS).forEach(id => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'kefe-btn';
      button.textContent = id[0].toUpperCase() + id.slice(1); button.dataset.volumetricPreset = id;
      button.setAttribute('aria-pressed', String(id === 'chromatica')); if (id === 'chromatica') button.classList.add('primary');
      button.addEventListener('click', () => applyPreset(id)); presetList.appendChild(button);
    });
    presetGroup.appendChild(presetList); view.appendChild(presetGroup);
    GROUPS.forEach(([name, keys]) => {
      const group = document.createElement('section'); group.className = 'kefe-visualiser-control-group';
      group.appendChild(Object.assign(document.createElement('div'), { className:'kefe-label', textContent:name }));
      keys.forEach(key => group.appendChild(makeControl(DEFINITIONS.find(item => item[0] === key))));
      view.appendChild(group);
    });
    const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'kefe-btn';
    reset.textContent = 'Reset parameters'; reset.addEventListener('click', () => applyPreset('chromatica'));
    view.appendChild(reset); form.appendChild(view);

    const tab = document.createElement('button'); tab.type = 'button'; tab.className = 'kefe-btn kefe-visualiser-tab';
    tab.textContent = 'Volumetric Engine'; tab.dataset.visualiser = 'volumetric'; tab.dataset.icon = '◈';
    tab.setAttribute('role','tab'); tab.setAttribute('aria-controls',view.id); tab.setAttribute('aria-selected','false');
    tab.setAttribute('aria-label','Volumetric Engine visualiser'); tab.title = 'Volumetric Engine visualiser';
    const power = document.createElement('button'); power.type = 'button'; power.className = 'kefe-btn kefe-switch kefe-vis-option-power';
    power.setAttribute('role','switch'); power.setAttribute('aria-checked','false'); power.setAttribute('aria-label','Volumetric Engine visualiser');
    const stateLabel = document.createElement('span'); stateLabel.className = 'kefe-switch-state'; stateLabel.textContent = 'Off';
    const track = document.createElement('span'); track.className = 'kefe-switch-track'; track.setAttribute('aria-hidden','true');
    track.appendChild(Object.assign(document.createElement('span'), { className:'kefe-switch-thumb' }));
    power.append(stateLabel,track);
    const option = document.createElement('div'); option.className = 'kefe-vis-option'; option.append(tab,power); tabs.appendChild(option);
    function hide() {
      active = false; view.hidden = true; tab.classList.remove('primary'); tab.setAttribute('aria-selected','false');
      canvas.style.visibility = 'hidden'; window.kefeVolumetricActive = false;
    }
    tabs.addEventListener('click',event => { const other=event.target.closest('[role="tab"]'); if(other && other!==tab) hide(); });
    tab.addEventListener('click',() => {
      active = true; view.hidden = false;
      tabs.querySelectorAll('[role="tab"]').forEach(other => {
        const selected = other === tab; other.classList.toggle('primary',selected);
        other.setAttribute('aria-selected',String(selected));
      });
      form.querySelectorAll('.kefe-vis-view').forEach(other => { if (other !== view) other.hidden = true; });
      ['kefeGradientPresetSet','kefeFlutedPresetSet'].forEach(id => { const node = $(id); if (node) node.hidden = true; });
      const presetRow = $('kefeVisualiserPresetRow'); if (presetRow) presetRow.hidden = true;
      window.kefeVolumetricActive = true; canvas.style.visibility = enabled ? 'visible' : 'hidden'; resize();
    });
    power.addEventListener('click',event => {
      event.stopPropagation(); enabled = !enabled; stateLabel.textContent = enabled ? 'On' : 'Off';
      power.classList.toggle('is-on',enabled); power.setAttribute('aria-checked',String(enabled));
      canvas.style.visibility = active && enabled ? 'visible' : 'hidden';
      window.kefeVolumetricEnabled = enabled;
    });
    window.kefeVolumetricActive = false; window.kefeVolumetricEnabled = false;
  }
  function init() {
    stage = document.querySelector('.kefe-stage');
    if (!stage || !document.querySelector('.kefe-vis-tabs')) return;
    canvas = document.createElement('canvas'); canvas.id = 'kefeVolumetricCanvas';
    canvas.setAttribute('aria-label','Volumetric Engine preview');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;z-index:2;visibility:hidden;';
    stage.insertBefore(canvas,$('kefeCanvas') || null);
    try {
      initGL(); buildUI();
      window.kefeVolumetricExport = { canvas };
      window.addEventListener('resize',resize); window.addEventListener('kefe-stage-resize',resize);
      document.addEventListener('visibilitychange',() => { if (!document.hidden && active && enabled) last = 0; });
      resize(); raf = requestAnimationFrame(render);
    } catch (error) {
      failed = true; canvas.remove(); console.error('[KEFE Volumetric Engine]',error);
      const form = document.querySelector('[data-panel-view="visualiser"] .kefe-visualiser-form');
      if (form) {
        const notice = document.createElement('p'); notice.className = 'kefe-meta';
        notice.setAttribute('role','status'); notice.textContent = 'Volumetric Engine could not initialise. WebGL may be unavailable.';
        form.appendChild(notice);
      }
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();