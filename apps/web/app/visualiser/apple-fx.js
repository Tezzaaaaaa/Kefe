/* KEFE Apple FX — the supplied Apple-event artwork as audio-reactive visualisers.
   Registered on the shared shader-vis framework (tab, power switch, panel, FPS gate and export
   layer come from there). This file owns the artwork textures and a 64-band spectrum texture, so
   streak columns can react to their own frequency instead of one global level.

   Treatments (cfg.mode):
     0 Streak — vertical light-trail type: each column is driven by its own frequency band, a light
                pulse travels down the streaks, columns sway on bass, filaments colour-pop on treble.
     1 Trail  — long-exposure logo trail: bass pushes stacked scaled copies outward (the trail
                lengthens), contours ripple with mids, a light sweep orbits the mark.
     2 Glass  — 3D glass renders: bass zoom, refraction drift, chromatic split on treble, a glint
                band across the highlights, sparkle on treble, micro-detail pop. FLAP > 0 adds a
                wing-spread on bass (butterfly). */
(function () {
  'use strict';
  if (!window.kefeShaderVis) { console.error('[KEFE Apple FX] shader-vis.js must load first.'); return; }

  const BASE = './app/assets/apple-fx/';
  const IMAGES = {
    logo: 'logo-trail.jpg',
    type: 'streak-type.jpg',
    dolphin: 'glass-dolphin.jpg',
    bottles: 'glass-bottles.jpg',
    fur: 'chrome-fur.jpg',
    butterfly: 'butterfly.jpg',
    wing: 'wing-macro.jpg',
  };

  const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 R, PIV;
uniform sampler2D IMG, SPEC;
uniform float T, IA, MODE, FIT, ZOOM, LOADED, REACT, GLOW, CHROMA, DRIFT, FLAP, BASS, LOW, MID, HIGH, BEAT;

float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<3;i++){v+=a*noise(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
float spec(float x){return texture2D(SPEC,vec2(clamp(x,0.,1.),.5)).r;}
float luma(vec3 c){return dot(c,vec3(.299,.587,.114));}
vec3 tex(vec2 p){
  float inside=step(0.,p.x)*step(p.x,1.)*step(0.,p.y)*step(p.y,1.);
  return texture2D(IMG,clamp(p,0.,1.)).rgb*mix(1.,inside,FIT);
}
float chromaOf(vec3 c){return max(c.r,max(c.g,c.b))-min(c.r,min(c.g,c.b));}

void main(){
  vec2 uv=gl_FragCoord.xy/R;
  float ca=R.x/R.y;
  float H=mix(max(1.,ca/IA),min(1.,ca/IA),FIT);
  vec2 q=(uv-.5)*vec2(ca,1.)/ZOOM;
  vec2 base=q/vec2(H*IA,H)+.5;
  float r=REACT;
  vec3 c=vec3(0.);

  if(MODE<.5){
    /* ---- Streak ---- */
    vec2 p=base;
    float colId=floor(p.x*160.);
    float sway=sin(p.y*5.5-T*1.7+p.x*4.)*(.002+.005*(BASS+BEAT*.6)*r);
    p.x+=sway+sin(T*.23)*.004*DRIFT;
    float s=spec(base.x);
    float ch=.0011*CHROMA*(1.+HIGH*r*2.2);
    vec3 c0=vec3(tex(p-vec2(ch,0.)).r,tex(p).g,tex(p+vec2(ch,0.)).b);
    vec3 g=vec3(0.);
    for(int i=1;i<=4;i++){float o=float(i)*.012;g+=tex(p+vec2(0.,o))+tex(p-vec2(0.,o));}
    g/=8.;
    float travel=sin(p.y*9.4248-T*2.4+hash(vec2(colId,3.))*6.2832)*.5+.5;
    float room=1.-smoothstep(.5,.95,luma(c0));
    float gain=1.+r*(s*.55+BASS*.1+BEAT*.15)*(.35+travel*.65)*(.2+room*.8);
    c=c0*gain+g*GLOW*(.08+s*r*.3)*(.3+room);
    c+=c*chromaOf(c)*r*(HIGH*.9+BEAT*.4)*room;
    vec3 over=max(c-.8,0.);c=min(c,vec3(.8))+.2*(1.-exp(-over*4.));
  }else if(MODE<1.5){
    /* ---- Trail ---- */
    vec2 d=base-PIV;
    vec2 da=vec2(d.x*IA,d.y);
    float ang=atan(da.y,da.x);
    float wob=sin(ang*7.+T*1.4)*.004*(.4+MID*1.6*r)*DRIFT+sin(ang*3.-T*.9)*.003*(.3+LOW*1.2*r);
    float sc=1.-(BASS*.04+BEAT*.035)*r;
    vec3 acc=vec3(0.);
    for(int i=0;i<6;i++){
      float k=float(i)/5.;
      float s2=(1.+k*(.03+.09*(BASS+LOW)*r))*sc+wob*(1.-k*.5);
      acc=max(acc,tex(PIV+d*s2)*(1.-k*.5));
    }
    vec3 halo=vec3(0.);
    for(int j=0;j<8;j++){
      float a=float(j)*.7854;
      vec2 o=vec2(cos(a)/IA,sin(a))*.016*(1.+BASS*r*1.5);
      halo+=tex(PIV+d*sc+o);
    }
    halo/=8.;
    float sweep=pow(max(cos(ang-T*.55),0.),10.);
    float sweep2=pow(max(cos(ang+T*.8+2.),0.),14.);
    c=acc+halo*GLOW*(.6+BASS*r*1.2);
    c+=acc*(sweep*(.35+MID*r*1.3)+sweep2*HIGH*r*1.4)*GLOW;
    c+=c*chromaOf(c)*r*(HIGH*1.5+BEAT);
    vec3 over=max(c-.85,0.);c=min(c,vec3(.85))+.15*(1.-exp(-over*4.));
  }else{
    /* ---- Glass ---- */
    vec2 ctr=vec2(.5);
    vec2 p=base;
    float zm=1.+(BASS*.05+BEAT*.03)*r;
    p=ctr+(p-ctr)/zm;
    float fl=FLAP*((BASS*.9+LOW*.5+BEAT*.6)*r+.08*sin(T*2.6));
    p.x=ctr.x+(p.x-ctr.x)/(1.+fl*.07);
    p.y-=fl*.03*pow(abs(p.x-.5)*2.,1.5);
    p+=vec2(sin(T*.21),cos(T*.17))*.010*DRIFT;
    vec2 w=vec2(fbm(p*3.+T*.10),fbm(p*3.+vec2(7.3,2.1)-T*.08))-.5;
    p+=w*(.004+MID*r*.014);
    vec2 ch=w*CHROMA*(.004+HIGH*r*.008)+vec2(.0012)*CHROMA;
    vec3 c0=vec3(tex(p-ch).r,tex(p).g,tex(p+ch).b);
    vec2 px=vec2(1.5/(R.y*H*IA),1.5/(R.y*H));
    vec3 bl=(tex(p+vec2(px.x,0.))+tex(p-vec2(px.x,0.))+tex(p+vec2(0.,px.y))+tex(p-vec2(0.,px.y)))*.25;
    c0+=(c0-bl)*HIGH*r*1.6;
    float hi=smoothstep(.5,1.,luma(c0));hi*=hi;
    float diag=base.x*.8+base.y*.6;
    float f=fract(diag*.8-T*.06);
    float band=exp(-pow((f-.5)*5.,2.));
    c=c0+vec3(.75,.9,1.)*band*hi*GLOW*(.3+BASS*r*1.3+BEAT*.6);
    vec2 cell=floor(base*vec2(ca,1.)*110.);
    c+=vec3(1.)*step(.982,hash(cell+floor(T*9.)))*hi*HIGH*r*2.;
    c*=1.+BEAT*.10*r*GLOW;
  }
  c*=LOADED;
  gl_FragColor=vec4(clamp(c,0.,1.),1.);
}`;

  const P = {
    logo:      { image: 'logo',      mode: '1', fit: '1', pivx: .49, pivy: .50, zoom: 1.8,  glow: 1.0, chroma: 1.0, drift: 1.0, flap: 0 },
    type:      { image: 'type',      mode: '0', fit: '0', pivx: .5,  pivy: .5,  zoom: 1.0,  glow: 1.0, chroma: 1.0, drift: 1.0, flap: 0 },
    dolphin:   { image: 'dolphin',   mode: '2', fit: '0', pivx: .5,  pivy: .5,  zoom: 1.04, glow: 1.0, chroma: 1.0, drift: 1.0, flap: 0 },
    bottles:   { image: 'bottles',   mode: '2', fit: '0', pivx: .5,  pivy: .5,  zoom: 1.04, glow: 1.0, chroma: 1.0, drift: 1.0, flap: 0 },
    fur:       { image: 'fur',       mode: '2', fit: '0', pivx: .5,  pivy: .5,  zoom: 1.04, glow: .8,  chroma: 1.2, drift: 1.2, flap: 0 },
    butterfly: { image: 'butterfly', mode: '2', fit: '0', pivx: .5,  pivy: .5,  zoom: 1.04, glow: .8,  chroma: .8,  drift: .8,  flap: 1.0 },
    wing:      { image: 'wing',      mode: '2', fit: '0', pivx: .5,  pivy: .5,  zoom: 1.04, glow: .9,  chroma: 1.0, drift: 1.4, flap: 0 },
  };
  const NAMES = { logo: 'Apple Logo', type: 'Light Type', dolphin: 'Glass Dolphin', bottles: 'Glass Bottles', fur: 'Chrome Fur', butterfly: 'Butterfly', wing: 'Wing Macro' };

  /* ---- audio: 64 log-spaced bands, per-track normalised, plus bass/low/mid/high and a beat pulse ---- */
  const N = 64;
  const specBytes = new Uint8Array(N), specSm = new Float32Array(N), raw = new Float32Array(N);
  let bins = null, specPeak = .15, bassAvg = 0, beat = 0, beatCool = 0;
  const level = { bass: 0, low: 0, mid: 0, high: 0 };
  const mean = (a, b) => { let s = 0; for (let i = a; i < b; i++) s += specSm[i]; return s / (b - a); };
  function analyse(dt) {
    const an = window.kefeAudioGraph?.analyser?.();
    let frameMax = 0;
    if (an) {
      if (!bins || bins.length !== an.frequencyBinCount) bins = new Uint8Array(an.frequencyBinCount);
      an.getByteFrequencyData(bins);
      const hz = (an.context?.sampleRate || 48000) / (an.fftSize || 2048);
      for (let i = 0; i < N; i++) {
        const lo = 40 * Math.pow(14000 / 40, i / N), hi = 40 * Math.pow(14000 / 40, (i + 1) / N);
        const a = Math.max(1, Math.floor(lo / hz)), b = Math.min(bins.length - 1, Math.max(a, Math.ceil(hi / hz)));
        let m = 0; for (let k = a; k <= b; k++) if (bins[k] > m) m = bins[k];
        raw[i] = (m / 255) * (1 + 1.8 * i / N);
        if (raw[i] > frameMax) frameMax = raw[i];
      }
    } else raw.fill(0);
    specPeak = Math.max(frameMax, specPeak * Math.exp(-dt / 25), .1);
    for (let i = 0; i < N; i++) {
      const target = Math.pow(Math.min(1, raw[i] / specPeak), 1.4);
      const k = 1 - Math.exp(-dt / (target > specSm[i] ? .05 : .28));
      specSm[i] += (target - specSm[i]) * k;
      specBytes[i] = Math.round(specSm[i] * 255);
    }
    level.bass = mean(0, 10); level.low = mean(10, 25); level.mid = mean(25, 45); level.high = mean(45, 64);
    beatCool -= dt; beat *= Math.exp(-dt / .16);
    if (level.bass > bassAvg * 1.3 + .06 && beatCool <= 0) { beat = 1; beatCool = .18; }
    bassAvg += (level.bass - bassAvg) * (1 - Math.exp(-dt / .6));
  }

  /* ---- textures (recreated if the GL context changes) ---- */
  const S = { gl: null, img: null, spec: null, bound: '', aspect: 1.5 };
  const cache = new Map();
  function ensureGL(gl) {
    if (S.gl === gl) return;
    const mk = () => {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      return t;
    };
    gl.activeTexture(gl.TEXTURE0); S.img = mk();
    gl.activeTexture(gl.TEXTURE1); S.spec = mk();
    S.gl = gl; S.bound = '';
  }
  function bindImage(gl, key) {
    if (S.bound === key) return true;
    const file = IMAGES[key] || IMAGES.logo, el = cache.get(key);
    if (el && el.complete && el.naturalWidth) {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, S.img);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, el);
      S.bound = key; S.aspect = el.naturalWidth / el.naturalHeight;
      return true;
    }
    if (!cache.has(key)) { const im = new Image(); im.decoding = 'async'; im.src = BASE + file; cache.set(key, im); }
    return false;
  }

  const f2 = v => v.toFixed(2), x2 = v => v.toFixed(2) + '×';
  window.kefeShaderVis.register({
    id: 'apple-fx', name: 'Apple FX', icon: '◐', canvasId: 'kefeAppleFxCanvas', opacity: 1, maxSide: 1920,
    fs: FS,
    uniforms: ['R', 'PIV', 'IMG', 'SPEC', 'T', 'IA', 'MODE', 'FIT', 'ZOOM', 'LOADED', 'REACT', 'GLOW', 'CHROMA', 'DRIFT', 'FLAP', 'BASS', 'LOW', 'MID', 'HIGH', 'BEAT'],
    defaults: { ...P.logo, speed: 1, react: 1 },
    presets: Object.keys(P).map(id => ({ id, label: NAMES[id], values: { ...P[id] } })),
    draw({ gl, loc, cfg, dt, width, height, reducedMotion, advance }) {
      ensureGL(gl);
      analyse(dt);
      const t = advance(dt * cfg.speed * (reducedMotion ? .5 : 1));
      const ready = bindImage(gl, cfg.image);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, S.img);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, S.spec);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, N, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, specBytes);
      gl.uniform1i(loc.IMG, 0); gl.uniform1i(loc.SPEC, 1);
      gl.uniform2f(loc.R, width, height); gl.uniform2f(loc.PIV, cfg.pivx, 1 - cfg.pivy);
      gl.uniform1f(loc.T, t); gl.uniform1f(loc.IA, S.aspect);
      gl.uniform1f(loc.MODE, Number(cfg.mode)); gl.uniform1f(loc.FIT, Number(cfg.fit));
      gl.uniform1f(loc.ZOOM, cfg.zoom); gl.uniform1f(loc.LOADED, ready ? 1 : 0);
      gl.uniform1f(loc.REACT, cfg.react); gl.uniform1f(loc.GLOW, cfg.glow); gl.uniform1f(loc.CHROMA, cfg.chroma);
      gl.uniform1f(loc.DRIFT, cfg.drift); gl.uniform1f(loc.FLAP, cfg.flap);
      gl.uniform1f(loc.BASS, level.bass); gl.uniform1f(loc.LOW, level.low); gl.uniform1f(loc.MID, level.mid); gl.uniform1f(loc.HIGH, level.high);
      gl.uniform1f(loc.BEAT, beat);
    },
    buildView({ view, field, choice }) {
      const group = (title, nodes) => { const g = document.createElement('div'); g.className = 'kefe-visualiser-control-group'; const h = document.createElement('div'); h.className = 'kefe-label'; h.textContent = title; g.appendChild(h); nodes.forEach(n => g.appendChild(n)); view.appendChild(g); };
      const seg = (items, key) => { const d = document.createElement('div'); d.className = 'kefe-seg'; choice(d, items, key); return d; };
      group('Audio', [field('Audio reactivity', 'react', 0, 2, .05, x2), field('Motion speed', 'speed', 0, 2, .05, x2)]);
      group('Treatment', [seg([['0', 'Streak'], ['1', 'Trail'], ['2', 'Glass']], 'mode')]);
      group('Frame', [seg([['0', 'Fill'], ['1', 'Fit']], 'fit'), field('Zoom', 'zoom', .6, 2.4, .01, f2)]);
      group('Look', [field('Glow and gloss', 'glow', 0, 2, .05, f2), field('Chromatic split', 'chroma', 0, 2, .05, f2), field('Drift', 'drift', 0, 2, .05, f2)]);
    },
  });
})();
