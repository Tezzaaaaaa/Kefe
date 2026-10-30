/* KEFE Silk Road — volumetric paint engine (supplied "Volumetric Engine" shader) as a standalone visualiser. */
(function () {
  'use strict';
  if (!window.kefeShaderVis) { console.error('[KEFE Silk Road] shader-vis.js must load first.'); return; }
  const FS = `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
  uniform vec2 R; uniform float T;
  uniform float VOLUME, WARP, HUE, VISC, TILT, ROT, SCALE, FOV, SHEEN, FOG, AMBIENT, GRAIN;
  uniform float LIGHT_ANGLE, MODE;
  uniform int HOLO_TYPE;
  
  float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),
               mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
  float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.0+vec2(1.7,9.2);a*=.5;}return v;}
  vec3 hsl2rgb(float h, float s, float l){
    vec3 rgb = clamp(abs(mod(h*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0);
    return l + s * (rgb - 0.5) * (1.0 - abs(2.0*l - 1.0));
  }

  vec2 applyBehavior(vec2 p, float t, int type) {
    if (type == 2 || type == 3) {
      vec2 p_vortex = p, p_tidal = p, p_turbulent = p, p_flow = p;
      if (MODE < 1.0) {
        p_vortex = vec2(p.x, p.y) + vec2(sin(p.y*1.5 + t*0.5), cos(p.x*1.5 - t*0.5)) * (1.0 - MODE) * 0.8;
        p_tidal = p + vec2(MODE * 1.0, sin(p.x * 2.0 + t * 0.3) * MODE * 0.8);
        return mix(p_vortex, p_tidal, MODE);
      } else if (MODE < 2.0) {
        p_tidal = p + vec2(0.5, sin(p.x * 2.0 + t * 0.3));
        p_turbulent = p + vec2(sin(p.y * 2.5 + t*0.6) * (MODE - 1.0) * 1.2, cos(p.x * 2.5 - t*0.6) * (MODE - 1.0) * 1.2);
        return mix(p_tidal, p_turbulent, MODE - 1.0);
      } else {
        p_turbulent = p + vec2(sin(p.y * 2.5 + t*0.6) * (3.0 - MODE) * 1.2, cos(p.x * 2.5 - t*0.6) * (3.0 - MODE) * 1.2);
        p_flow = p + vec2((MODE - 2.0) * 1.5, cos(p.y * 1.5 + t * 0.15) * (MODE - 2.0) * 0.8);
        return mix(p_turbulent, p_flow, MODE - 2.0);
      }
    } else {
      vec2 p_vortex = p, p_tidal = p, p_turbulent = p, p_flow = p;
      if (MODE < 1.0) {
        p_vortex = vec2(p.x, p.y) + vec2(sin(p.y*2.0 + t), cos(p.x*2.0 - t)) * (1.0 - MODE) * 1.5;
        p_tidal = p + vec2(MODE * 2.0, sin(p.x * 3.0 + t * 0.5) * MODE * 1.5);
        return mix(p_vortex, p_tidal, MODE);
      } else if (MODE < 2.0) {
        p_tidal = p + vec2(1.0, sin(p.x * 3.0 + t * 0.5));
        p_turbulent = p + vec2(sin(p.y * 4.0 + t) * (MODE - 1.0) * 2.0, cos(p.x * 4.0 - t) * (MODE - 1.0) * 2.0);
        return mix(p_tidal, p_turbulent, MODE - 1.0);
      } else {
        p_turbulent = p + vec2(sin(p.y * 4.0 + t) * (3.0 - MODE) * 2.0, cos(p.x * 4.0 - t) * (3.0 - MODE) * 2.0);
        p_flow = p + vec2((MODE - 2.0) * 3.0, cos(p.y * 2.0 + t * 0.2) * (MODE - 2.0) * 1.5);
        return mix(p_turbulent, p_flow, MODE - 2.0);
      }
    }
  }

  float getHeight(vec2 p, float t, int type){
    vec2 p_flow = applyBehavior(p, t, type);
    float s = (type == 2 || type == 3) ? SCALE * 0.6 : SCALE;
    vec2 q = vec2(fbm(p_flow * 0.8 * s + t * 0.1), fbm(p_flow * 0.8 * s - t * 0.08 + 5.2));
    vec2 r = vec2(fbm(p_flow * s + WARP * q + t * 0.15), fbm(p_flow * s + WARP * q + vec2(8.3, 2.8) - t * 0.12));
    float h = fbm(p_flow * s + WARP * r);
    h = smoothstep(0.5 - VISC * 0.2, 0.5 + VISC * 0.2, h);
    return h;
  }

  void main(){
    vec2 uv = gl_FragCoord.xy / R;
    vec2 p = (uv - 0.5) * vec2(R.x/R.y, 1.0) * FOV;
    
    float theta = ROT * 3.14159 / 180.0;
    float phi = (TILT - 1.0) * 1.5;
    vec3 camDir = vec3(sin(theta)*cos(phi), sin(phi), cos(theta)*cos(phi));
    vec3 up = vec3(0.0, 1.0, 0.0);
    vec3 right = normalize(cross(up, camDir));
    vec3 camUp = cross(camDir, right);
    vec2 p3d = p.x * right.xy + p.y * camUp.xy;
    float t = T;

    float h = getHeight(p3d, t, HOLO_TYPE);
    float e = 0.02;
    float hx = getHeight(p3d + vec2(e, 0.0), t, HOLO_TYPE) - h;
    float hy = getHeight(p3d + vec2(0.0, e), t, HOLO_TYPE) - h;
    vec3 N = normalize(vec3(-hx/e * VOLUME, -hy/e * VOLUME + camDir.y, camDir.z + 0.5));

    float l_rad = LIGHT_ANGLE * 3.14159 / 180.0;
    vec3 L = normalize(vec3(cos(l_rad), sin(l_rad), 0.8));
    vec3 V = normalize(camDir);
    vec3 H = normalize(L + V);
    float diff = max(dot(N, L), 0.0);
    float spec = pow(max(dot(N, H), 0.0), 32.0) * SHEEN; 
    float ao = smoothstep(0.0, 0.3, h) * 0.5 + 0.5;
    float viewAngle = dot(N, V);

    vec3 col;

    if (HOLO_TYPE == 6) {
      vec3 deepWater = vec3(0.0, 0.1, 0.25);
      vec3 brightWater = vec3(0.1, 0.7, 0.9);
      vec3 pureIce = vec3(0.9, 1.0, 1.0);
      float edge = pow(clamp(1.0 - abs(h - 0.5) * 4.0, 0.0, 1.0), 2.0);
      col = mix(deepWater, brightWater, smoothstep(0.2, 0.8, h));
      col = mix(col, pureIce, pow(spec, 1.2) * 1.8);
      col = mix(col, vec3(0.0, 0.5, 0.8), edge * 0.5);
      col *= (AMBIENT + (1.2 - AMBIENT) * diff) * ao;
    } else if (HOLO_TYPE == 3) {
      float metallic = smoothstep(0.3, 0.7, h);
      vec3 silverBase = vec3(0.85, 0.87, 0.9);
      vec3 darkSilver = vec3(0.2, 0.22, 0.25);
      col = mix(darkSilver, silverBase, metallic);
      col *= (AMBIENT + (1.2 - AMBIENT) * diff) * ao;
      col += vec3(1.0, 1.0, 1.0) * pow(spec, 3.0) * 2.5;
    } else if (HOLO_TYPE == 2) {
      float shift = h * 2.0 + viewAngle * 0.5 + HUE;
      vec3 base = hsl2rgb(fract(shift), 0.4, 0.75);
      vec3 accent = hsl2rgb(fract(shift + 0.15), 0.5, 0.85);
      col = mix(base, accent, smoothstep(0.1, 0.8, h));
      col *= (AMBIENT + (1.2 - AMBIENT) * diff) * ao;
      col += vec3(1.0) * pow(spec, 2.0) * 0.5;
    } else if (HOLO_TYPE == 5) {
      vec3 darkBlood = vec3(0.15, 0.0, 0.0);
      vec3 midBlood = vec3(0.6, 0.02, 0.02);
      vec3 brightBlood = vec3(1.0, 0.1, 0.1);
      col = mix(darkBlood, midBlood, smoothstep(0.1, 0.5, h));
      col = mix(col, brightBlood, smoothstep(0.5, 0.9, h) * pow(diff, 2.0));
      col *= (AMBIENT + (1.2 - AMBIENT) * diff) * ao;
      col += vec3(1.0, 0.8, 0.8) * spec;
    } else if (HOLO_TYPE == 1) {
      float prism = fract(viewAngle * 2.5 + h * 1.5 + HUE);
      vec3 rainbow = hsl2rgb(prism, 1.0, 0.65);
      col = vec3(0.02, 0.02, 0.05);
      col += rainbow * pow(spec, 2.0) * 2.5;
      col += vec3(0.9, 0.95, 1.0) * pow(diff, 3.0) * 0.4;
      col *= (AMBIENT * 0.5 + (1.0 - AMBIENT) * diff);
    } else if (HOLO_TYPE == 4) {
      vec3 cDark = vec3(0.15, 0.05, 0.0);
      vec3 cMid = vec3(0.85, 0.45, 0.0);
      vec3 cLight = vec3(1.0, 0.9, 0.4);
      col = mix(cDark, cMid, smoothstep(0.1, 0.5, h));
      col = mix(col, cLight, smoothstep(0.4, 0.9, h));
      col *= (AMBIENT + (1.2 - AMBIENT) * diff) * ao;
      col += vec3(1.0) * spec * 0.5;
    } else {
      vec3 cDark  = hsl2rgb(HUE, 0.8, 0.25);
      vec3 cMid   = hsl2rgb(HUE, 0.9, 0.55);
      vec3 cLight = hsl2rgb(HUE, 1.0, 0.75);
      float phase1 = smoothstep(0.0, 5.0, t);
      float phase2 = smoothstep(5.0, 15.0, t);
      col = cDark;
      col = mix(col, cMid,   smoothstep(0.1, 0.5, h) * phase1);
      col = mix(col, cLight, smoothstep(0.4, 0.9, h) * phase2);
      col *= (AMBIENT + (1.2 - AMBIENT) * diff) * ao; 
      col += vec3(1.0) * spec;
    }

    float depth = smoothstep(-1.5, 1.5, p.y);
    col *= mix(1.0 - FOG * 0.3, 1.0, depth);
    float gr = hash(gl_FragCoord.xy + t) - 0.5;
    col += gr * GRAIN;
    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
  `;
  const P = {
    chromatica: { hue: 180, volume: 2.20, warp: 5.2, speed: 0.003, visc: 2.95, tilt: -0.95, rot: 80, scale: 0.45, fov: 0.85, sheen: 2.00, fog: 1.35, ambient: 0.05, grain: 0.0, light: 61, mode: 0.9, holo: 3 },
    carrie: { hue: 360, volume: 2.90, warp: 5.4, speed: 0.010, visc: 2.90, tilt: 1.35, rot: 124, scale: 0.20, fov: 1.85, sheen: 2.00, fog: 0.50, ambient: 0.85, grain: 0.02, light: 102, mode: 3, holo: 5 },
    katara: { hue: 190, volume: 2.50, warp: 4.8, speed: 0.010, visc: 2.20, tilt: 0.50, rot: 120, scale: 0.60, fov: 1.30, sheen: 2.00, fog: 0.50, ambient: 0.80, grain: 0.00, light: 180, mode: 1.5, holo: 6 },
    iridizon: { hue: 180, volume: 2.70, warp: 4.8, speed: 0.003, visc: 2.27, tilt: 1.03, rot: 154, scale: 0.85, fov: 0.65, sheen: 1.85, fog: 0.60, ambient: 0.95, grain: 0.02, light: 72, mode: 1, holo: 2 },
    lumina: { hue: 180, volume: 0.5, warp: 4.7, speed: 0.015, visc: 3.0, tilt: 0.89, rot: 251, scale: 0.2, fov: 0.7, sheen: 1.85, fog: 0.0, ambient: 0.8, grain: 0.14, light: 160, mode: 1, holo: 1 },
    manuka: { hue: 30, volume: 2.30, warp: 6.0, speed: 0.005, visc: 3.00, tilt: 1.75, rot: 98, scale: 0.15, fov: 2.00, sheen: 1.80, fog: 0.05, ambient: 1.00, grain: 0.00, light: 21, mode: 0, holo: 4 },
  };
  const NAMES = { chromatica: 'Chromatica', carrie: 'Carrie', katara: 'Katara', iridizon: 'Iridizon', lumina: 'Lumina', manuka: 'Manuka' };
  const f2 = v => v.toFixed(2), deg = v => Math.round(v) + '°';
  window.kefeShaderVis.register({
    id: 'silk-road', name: 'Silk Road', icon: '≋', canvasId: 'kefeSilkRoadCanvas', opacity: 0.85, maxSide: 1920,
    fs: FS,
    uniforms: ['R', 'T', 'VOLUME', 'WARP', 'HUE', 'VISC', 'TILT', 'ROT', 'SCALE', 'FOV', 'SHEEN', 'FOG', 'AMBIENT', 'GRAIN', 'LIGHT_ANGLE', 'MODE', 'HOLO_TYPE'],
    defaults: { ...P.chromatica, react: 1 },
    presets: Object.keys(P).map(id => ({ id, label: NAMES[id], values: { ...P[id] } })),
    draw({ gl, loc, cfg, dt, audio, width, height, reducedMotion, advance }) {
      const bass = audio[0] * .5 + audio[1] * .5, r = cfg.react;
      const t = advance(dt * (cfg.speed * 10) * (reducedMotion ? .5 : 1) * (1 + r * .8 * bass));
      gl.uniform2f(loc.R, width, height); gl.uniform1f(loc.T, t);
      gl.uniform1f(loc.VOLUME, cfg.volume * (1 + r * .12 * audio[0]));
      gl.uniform1f(loc.WARP, cfg.warp); gl.uniform1f(loc.HUE, cfg.hue / 360); gl.uniform1f(loc.VISC, cfg.visc);
      gl.uniform1f(loc.TILT, cfg.tilt); gl.uniform1f(loc.ROT, cfg.rot); gl.uniform1f(loc.SCALE, cfg.scale);
      gl.uniform1f(loc.FOV, cfg.fov); gl.uniform1f(loc.SHEEN, cfg.sheen * (1 + r * .25 * audio[3]));
      gl.uniform1f(loc.FOG, cfg.fog); gl.uniform1f(loc.AMBIENT, cfg.ambient); gl.uniform1f(loc.GRAIN, cfg.grain);
      gl.uniform1f(loc.LIGHT_ANGLE, cfg.light); gl.uniform1f(loc.MODE, cfg.mode); gl.uniform1i(loc.HOLO_TYPE, Math.round(cfg.holo));
    },
    buildView({ view, field }) {
      const group = (title, fields) => { const g = document.createElement('div'); g.className = 'kefe-visualiser-control-group'; const h = document.createElement('div'); h.className = 'kefe-label'; h.textContent = title; g.appendChild(h); fields.forEach(f => g.appendChild(f)); view.appendChild(g); };
      group('Audio', [field('Audio reactivity', 'react', 0, 2, .05, v => v.toFixed(2) + '×')]);
      group('Material', [field('Color shift', 'hue', 0, 360, 1, deg), field('Viscosity', 'visc', .5, 3.5, .05, f2), field('Volume', 'volume', .5, 3, .1, f2), field('Grain', 'grain', 0, .2, .01, f2)]);
      group('Physics', [field('Behaviour', 'mode', 0, 3, .1, v => v.toFixed(1)), field('Stir speed', 'speed', 0, .03, .001, v => v.toFixed(3)), field('Fold scale', 'scale', .1, 1.5, .05, f2), field('Mix intensity', 'warp', 1, 6, .1, v => v.toFixed(1))]);
      group('Camera and lighting', [field('Cam pitch', 'tilt', -1.5, 2, .05, f2), field('Cam yaw', 'rot', 0, 360, 1, deg), field('Light angle', 'light', 0, 360, 1, deg), field('Wet sheen', 'sheen', 0, 2, .05, f2), field('Zoom (FOV)', 'fov', .3, 2.5, .05, f2), field('Depth fog', 'fog', 0, 1.5, .05, f2), field('Ambient light', 'ambient', .05, 1, .05, f2)]);
    },
  });
})();
