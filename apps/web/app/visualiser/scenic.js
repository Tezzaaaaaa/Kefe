/* KEFE Scenic backgrounds — Tidal Prism and Night Tunnel.
   Two procedural WebGL backgrounds, each its own visualiser tab. Both are original
   renderings (no source imagery) so they can sit under any lyric effect.
   Uses KEFE's shared audio graph for an optional, gentle beat pulse (default low). */
(function () {
  'use strict';

  const VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  const HEAD = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH', 'precision highp float;', '#else', 'precision mediump float;', '#endif',
    'uniform vec2 uRes;', 'uniform float uT,uPulse,uA,uB,uC,uD;',
    'uniform vec3 uK0,uK1,uK2,uK3;',
    'float hash(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}',
    'float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}',
    'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=vnoise(p)*a;p=p*2.03+vec2(7.1,3.7);a*=.5;}return v;}'
  ].join('\n');

  /* ---------- Tidal Prism: a spectrum beam over a dark, rippling sea ---------- */
  const TIDE_FS = HEAD + '\n' + [
    /* uA wave scale, uB beam angle (deg), uC beam width, uD haze; uK0..3 = cosine palette a,b,c,d */
    'vec3 pal(float t){return uK0+uK1*cos(6.28318*(uK2*t+uK3));}',
    'float HZ(){return .62;}',
    'vec3 sky(vec2 uv,float asp){',
    ' float H=HZ();vec2 q=vec2((uv.x-.5)*asp,uv.y-H);',
    ' float th=radians(uB);vec2 perp=vec2(cos(th),-sin(th));',
    ' float s=dot(q-vec2(.02*asp,.0),perp)/max(.05,uC*.24);',
    ' float drift=sin(uT*.05)*.1;',
    ' float cloud=fbm(vec2(q.x*1.6+uT*.015,q.y*2.4)+vec2(0.,uT*.01));',
    ' float beam=smoothstep(1.1,.0,abs(s))*(.8+.45*cloud);',
    ' beam*=smoothstep(.0,.16,q.y);',
    ' vec3 spec=pal(clamp(s*.5+.5,0.,1.)*.88+.04+drift);',
    ' vec3 base=mix(vec3(.02,.05,.07),vec3(.17,.23,.28),smoothstep(0.,.5,q.y)*(.55+.45*cloud));',
    ' vec3 col=base+spec*beam*1.05;',
    ' float haze=exp(-q.y*9.)*uD;col=mix(col,vec3(.02,.04,.06),haze*.85);',
    ' return col;}',
    'float swell(vec2 w,float t){',
    ' float v=sin(w.x*1.1+w.y*.8+t*.7)*.55+sin(w.x*2.3-w.y*1.5+t*1.05)*.3+sin(w.x*4.7+w.y*2.9-t*1.4)*.16;',
    ' return v+vnoise(w*2.6+vec2(t*.22,-t*.17))*.5+vnoise(w*6.1-vec2(t*.3,t*.2))*.2;}',
    'void main(){',
    ' float asp=uRes.x/uRes.y;vec2 uv=gl_FragCoord.xy/uRes;float H=HZ();vec3 col;',
    ' if(uv.y>=H){col=sky(uv,asp);}',
    ' else{',
    '  float d=H-uv.y;float z=1./(d*3.2+.045);vec2 w=vec2((uv.x-.5)*asp*z*1.25,z*1.9)*uA;',
    '  float e=.07;float h0=swell(w,uT);float hx=swell(w+vec2(e,0.),uT)-swell(w-vec2(e,0.),uT);float hy=swell(w+vec2(0.,e),uT)-swell(w-vec2(0.,e),uT);',
    '  vec2 n=vec2(hx,hy)/(2.*e);',
    '  vec2 ruv=vec2(uv.x+n.x*.035*(.4+d*3.),H+d*.78+n.y*.05);',
    '  vec3 refl=sky(ruv,asp);',
    '  float lit=clamp(.18+n.y*.55+h0*.12,0.,1.);float glint=pow(lit,2.6);',
    '  float fres=mix(1.,.28,smoothstep(0.,.55,d));',
    '  vec3 deep=mix(vec3(.01,.03,.07),vec3(.03,.06,.12),smoothstep(.0,.6,d));',
    '  col=deep+refl*(glint*1.9+.06)*fres*(1.+uPulse*.5);',
    '  col+=vec3(.5,.7,.9)*pow(clamp(n.y*.5,0.,1.),5.)*.12*fres;',
    '  col=mix(col,vec3(.03,.06,.09),exp(-d*55.)*.7);',
    ' }',
    ' float lum=dot(col,vec3(.3,.59,.11));',
    ' col=pow(max(col,0.),vec3(.92));',
    ' float g=hash(gl_FragCoord.xy+fract(uT)*91.)-.5;col+=g*.022*(1.-lum*.6);',
    ' vec2 vv=uv-.5;col*=1.-dot(vv,vv)*.5;',
    ' gl_FragColor=vec4(clamp(col,0.,1.),1.);}'
  ].join('\n');

  /* ---------- Night Tunnel: a curved tunnel of lamps and road ---------- */
  const TUNNEL_FS = HEAD + '\n' + [
    /* uA curve (-1..1), uB lamp glow, uC wall streaks, uD road lines; uK0 wall, uK1 road, uK2 lamp core, uK3 lamp halo */
    'void main(){',
    ' vec2 p=(gl_FragCoord.xy-.5*uRes)/uRes.y;float asp=uRes.x/uRes.y;',
    ' vec2 vp=vec2(.13*uA+.02*sin(uT*.17),-.07+.02*cos(uT*.13));',
    ' vec2 q=p-vp;float r=length(q);float ang=atan(q.y,q.x);',
    ' float z=.1/max(r,.004);float zz=z+uT;',
    ' float mouth=smoothstep(.0,.26,r);',
    ' float up=smoothstep(-.35,.6,q.y/max(r,.02));',
    ' vec3 wall=uK0*(.22+.9*up)*(.25+.95*smoothstep(.04,.95,r));',
    ' float streak=vnoise(vec2(ang*4.5,zz*.7))*.6+vnoise(vec2(ang*11.,zz*1.9))*.4;',
    ' wall*=1.-uC*.55+uC*.9*streak;',
    ' wall*=.8+.2*smoothstep(.45,.5,abs(fract(zz*.5)-.5));',
    ' vec3 col=wall*mouth;',
    ' float roadW=smoothstep(.02,.26,-q.y/(abs(q.x)*1.15+.06));',
    ' if(q.y<0.){',
    '  float zr=.07/max(-q.y,.002);float lx=q.x*zr*3.2;float zt=zr*3.2+uT*3.2;',
    '  vec3 road=uK1*(.35+.9*smoothstep(0.,.5,-q.y))*mouth;',
    '  float edge=smoothstep(.1,.0,abs(abs(lx)-1.6));float dash=step(.5,fract(zt*1.5));float mid=smoothstep(.045,.0,abs(lx))*dash;',
    '  float lines=(edge*.9+mid*.8)*uD*smoothstep(.0,.06,-q.y);',
    '  road+=vec3(.55,.8,1.)*lines*.55*mouth+uK3*.18*exp(-abs(q.x)*2.6)*smoothstep(0.,.3,-q.y)*mouth;',
    '  col=mix(col*(1.-.8*roadW),road,roadW);}',
    ' float lampMask=0.;vec3 glow=vec3(0.);',
    ' for(int row=0;row<2;row++){',
    '  float fr=float(row);float a0=mix(2.4,.72,fr);float R=mix(1.,.8,fr);',
    '  for(int i=0;i<14;i++){',
    '   float zi=float(i)*.95+.9-mod(uT*3.2,.95);',
    '   vec2 lp=vec2(cos(a0),sin(a0))*R/zi*.42;float dd=length(q-lp);',
    '   float sz=(.5/zi)*.075+.002;float core=exp(-dd*dd/(sz*sz));float halo=exp(-dd/(sz*4.5))*.28;',
    '   float fade=smoothstep(0.,.6,zi-.75)*smoothstep(0.,.05,r);',
    '   lampMask+=core*fade;glow+=uK3*halo*fade*(1.+uPulse*.8);}}',
    ' col+=glow*uB*.55+uK2*lampMask*(1.2+uPulse*.9)*uB;',
    ' float haze=exp(-r*5.)*.12;col+=uK3*haze*uB*mouth*0.;',
    ' col=pow(max(col,0.),vec3(.95));',
    ' float g=hash(gl_FragCoord.xy+fract(uT)*77.)-.5;col+=g*.028;',
    ' vec2 vv=gl_FragCoord.xy/uRes-.5;col*=1.-dot(vv,vv)*.45;',
    ' gl_FragColor=vec4(clamp(col,0.,1.),1.);}'
  ].join('\n');

  const SCENES = [
    {
      key: 'tidal-prism', label: 'Tidal Prism', icon: '≋', accent: '#7fb4ff', fs: TIDE_FS,
      title: 'Tidal Prism',
      presets: [
        { name: 'Prism', k: [[.5, .5, .5], [.5, .5, .5], [1, 1, 1], [0, .33, .67]], v: { angle: 32, width: 1, haze: .55 } },
        { name: 'Dusk', k: [[.55, .3, .42], [.5, .38, .35], [1, .85, .65], [0, .12, .3]], v: { angle: 40, width: 1.15, haze: .5 } },
        { name: 'Aurora', k: [[.35, .55, .55], [.4, .45, .4], [.9, .9, 1], [.1, .33, .6]], v: { angle: 22, width: .9, haze: .6 } }
      ],
      sliders: [
        { key: 'speed', label: 'Tide speed', min: .2, max: 2.5, step: .05, def: 1, fmt: v => v.toFixed(2) + '×' },
        { key: 'scale', label: 'Wave scale', min: .5, max: 2, step: .05, def: 1, fmt: v => v.toFixed(2) + '×', u: 'uA' },
        { key: 'angle', label: 'Beam angle', min: -10, max: 70, step: 1, def: 32, fmt: v => Math.round(v) + '°', u: 'uB' },
        { key: 'width', label: 'Beam width', min: .4, max: 1.8, step: .05, def: 1, fmt: v => v.toFixed(2) + '×', u: 'uC' },
        { key: 'haze', label: 'Horizon haze', min: 0, max: 1, step: .05, def: .55, fmt: v => v.toFixed(2), u: 'uD' },
        { key: 'pulse', label: 'Beat shimmer', min: 0, max: 1.5, step: .05, def: .3, fmt: v => v.toFixed(2) + '×' }
      ]
    },
    {
      key: 'night-tunnel', label: 'Night Tunnel', icon: '◖', accent: '#ff5a4d', fs: TUNNEL_FS,
      title: 'Night Tunnel',
      presets: [
        { name: 'Crimson', k: [[.95, .05, .04], [.03, .06, .26], [1, .85, .92], [1, .24, .16]], v: {} },
        { name: 'Ultraviolet', k: [[.5, .08, .95], [.02, .05, .3], [.85, .95, 1], [.9, .2, 1]], v: { curve: -.8 } },
        { name: 'Sodium', k: [[.95, .42, .04], [.04, .05, .12], [1, .96, .8], [1, .55, .1]], v: { curve: .3 } }
      ],
      sliders: [
        { key: 'speed', label: 'Drive speed', min: .2, max: 3, step: .05, def: 1, fmt: v => v.toFixed(2) + '×' },
        { key: 'curve', label: 'Tunnel curve', min: -1, max: 1, step: .05, def: 1, fmt: v => v.toFixed(2), u: 'uA' },
        { key: 'lamps', label: 'Lamp glow', min: 0, max: 2, step: .05, def: 1, fmt: v => v.toFixed(2) + '×', u: 'uB' },
        { key: 'streaks', label: 'Wall streaks', min: 0, max: 1, step: .05, def: .55, fmt: v => v.toFixed(2), u: 'uC' },
        { key: 'lanes', label: 'Road lines', min: 0, max: 1.5, step: .05, def: 1, fmt: v => v.toFixed(2) + '×', u: 'uD' },
        { key: 'pulse', label: 'Beat pulse', min: 0, max: 1.5, step: .05, def: .3, fmt: v => v.toFixed(2) + '×' }
      ]
    }
  ];

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const reducedMotion = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let audioBins = null, bass = 0, peak = .1;

  function audioBass(dt) {
    let target = .45 + .3 * Math.sin(performance.now() / 1000 * 1.9);
    try {
      const analyser = window.kefeAudioGraph?.analyser?.();
      if (analyser) {
        if (!audioBins || audioBins.length !== analyser.frequencyBinCount) audioBins = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(audioBins);
        const hz = (analyser.context?.sampleRate || 48000) / (analyser.fftSize || 2048);
        const a = Math.max(1, Math.floor(30 / hz)), b = Math.min(audioBins.length - 1, Math.ceil(150 / hz));
        let s = 0; for (let i = a; i <= b; i++) s += audioBins[i];
        const raw = s / (Math.max(1, b - a + 1) * 255);
        peak = Math.max(raw, peak * Math.exp(-dt / 30), .06);
        target = Math.pow(clamp(raw / peak), 1.4);
      }
    } catch (_) {}
    bass += (target - bass) * (1 - Math.exp(-dt / (target > bass ? .08 : .3)));
    return bass;
  }

  function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }

  const instances = [];
  const stateApi = () => {
    const live = instances.find(i => i.shown());
    return { enabled: !!live, canvas: live ? live.canvas : null, scene: live ? live.scene.key : null };
  };

  function makeScene(scene, stage, tabs, form, tabsList) {
    const store = 'kefe.scenic.' + scene.key + '.v1';
    const cfg = {}; scene.sliders.forEach(s => cfg[s.key] = s.def); cfg.preset = 0;
    try { Object.assign(cfg, JSON.parse(localStorage.getItem(store) || 'null') || {}); } catch (_) {}
    const persist = () => { try { localStorage.setItem(store, JSON.stringify(cfg)); } catch (_) {} };

    const canvas = el('canvas'); canvas.id = 'kefeScenic' + scene.key.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase()) + 'Canvas';
    canvas.setAttribute('aria-label', scene.label + ' background');
    Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'none', zIndex: '2', pointerEvents: 'none', borderRadius: '0' });
    stage.insertBefore(canvas, document.getElementById('kefeCanvas') || null);

    const opts = { antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' };
    let gl = canvas.getContext('webgl', opts), program = null, loc = {}, raf = 0, last = 0, t = 0, enabled = false, active = false;
    const inst = { scene, canvas, shown: () => enabled && active };

    function compile(type, src) {
      const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { console.error('[KEFE ' + scene.label + ' shader]', gl.getShaderInfoLog(sh)); gl.deleteShader(sh); return null; }
      return sh;
    }
    function build() {
      const vs = compile(gl.VERTEX_SHADER, VS), fs = compile(gl.FRAGMENT_SHADER, scene.fs); if (!vs || !fs) return false;
      const next = gl.createProgram(); gl.attachShader(next, vs); gl.attachShader(next, fs); gl.linkProgram(next);
      gl.deleteShader(vs); gl.deleteShader(fs);
      if (!gl.getProgramParameter(next, gl.LINK_STATUS)) { console.error('[KEFE ' + scene.label + ' program]', gl.getProgramInfoLog(next)); gl.deleteProgram(next); return false; }
      if (program) gl.deleteProgram(program); program = next; gl.useProgram(program);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const at = gl.getAttribLocation(program, 'a'); gl.enableVertexAttribArray(at); gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
      ['uRes', 'uT', 'uPulse', 'uA', 'uB', 'uC', 'uD', 'uK0', 'uK1', 'uK2', 'uK3'].forEach(k => loc[k] = gl.getUniformLocation(program, k));
      return true;
    }
    if (!gl || !build()) { canvas.remove(); console.error('[KEFE ' + scene.label + '] WebGL initialisation failed.'); return null; }

    function resize() {
      const r = stage.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(2, Math.round((r.width || 2) * d)), h = Math.max(2, Math.round((r.height || 2) * d));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl && gl.viewport(0, 0, canvas.width, canvas.height);
    }
    function draw(dt) {
      const b = audioBass(dt), mo = reducedMotion ? .5 : 1;
      t += dt * cfg.speed * mo * (1 + cfg.pulse * .25 * (b - .4));
      const pr = scene.presets[cfg.preset] || scene.presets[0];
      gl.useProgram(program);
      gl.uniform2f(loc.uRes, canvas.width, canvas.height);
      gl.uniform1f(loc.uT, t);
      gl.uniform1f(loc.uPulse, cfg.pulse * clamp(b - .25, 0, 1) * 1.4);
      scene.sliders.forEach(s => { if (s.u) gl.uniform1f(loc[s.u], cfg[s.key]); });
      ['uK0', 'uK1', 'uK2', 'uK3'].forEach((k, i) => gl.uniform3f(loc[k], ...pr.k[i]));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function frame(now) {
      raf = 0; if (!inst.shown() || !gl || !program || document.hidden) return;
      const dt = clamp((now - (last || now)) / 1000, 0, .1); last = now;
      draw(dt); raf = requestAnimationFrame(frame);
    }
    function start() { if (!inst.shown() || !gl || raf || document.hidden) return; last = performance.now(); raf = requestAnimationFrame(frame); }
    function sync() {
      canvas.style.display = inst.shown() ? 'block' : 'none';
      power.classList.toggle('is-on', enabled); power.setAttribute('aria-checked', String(enabled)); powerState.textContent = enabled ? 'On' : 'Off';
      if (inst.shown()) { resize(); start(); } else { if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; }
      window.dispatchEvent(new CustomEvent('kefe-scenic-change', { detail: stateApi() }));
    }

    /* ---- controls ---- */
    const view = el('section', 'kefe-vis-view kefe-slow-light-view kefe-scenic-view'); view.id = 'kefeVis' + scene.label.replace(/\s+/g, '') + 'View'; view.hidden = true;
    const power = el('button', 'kefe-btn kefe-switch kefe-slow-light-power'); power.type = 'button'; power.setAttribute('role', 'switch'); power.setAttribute('aria-checked', 'false'); power.setAttribute('aria-label', scene.label + ' background');
    const powerState = el('span', 'kefe-switch-state', 'Off'), powerTrack = el('span', 'kefe-switch-track'); powerTrack.setAttribute('aria-hidden', 'true'); powerTrack.appendChild(el('span', 'kefe-switch-thumb'));
    power.append(powerState, powerTrack);
    power.addEventListener('click', e => { e.stopPropagation(); enabled = !enabled; sync(); });

    const presetRow = document.querySelector('.kefe-visualiser-preset-row');
    const presetSet = el('div', 'kefe-visualiser-preset-set'); presetSet.id = 'kefeScenic' + scene.key + 'PresetSet'; presetSet.hidden = true;
    const presetBtns = el('div', 'kefe-slow-light-scenes');
    const sliderEls = {};
    function field(s) {
      const wrap = el('label', 'kefe-visualiser-field'), head = el('span'), name = el('b', null, s.label), out = el('output'), input = el('input');
      input.type = 'range'; input.min = s.min; input.max = s.max; input.step = s.step; input.value = cfg[s.key]; out.textContent = s.fmt(Number(cfg[s.key]));
      head.append(name, out); wrap.append(head, input);
      input.addEventListener('input', () => { cfg[s.key] = Number(input.value); out.textContent = s.fmt(cfg[s.key]); persist(); });
      sliderEls[s.key] = { input, out, s };
      return wrap;
    }
    function applyPreset(i, fromUser) {
      cfg.preset = i; const pr = scene.presets[i];
      if (fromUser) Object.entries(pr.v || {}).forEach(([k, v]) => { cfg[k] = v; const se = sliderEls[k]; if (se) { se.input.value = v; se.out.textContent = se.s.fmt(v); } });
      presetBtns.querySelectorAll('button').forEach((b, j) => { b.classList.toggle('primary', j === i); b.setAttribute('aria-pressed', String(j === i)); });
      persist();
    }
    scene.presets.forEach((p, i) => { const b = el('button', 'kefe-btn', p.name); b.type = 'button'; b.addEventListener('click', () => applyPreset(i, true)); presetBtns.appendChild(b); });
    presetSet.appendChild(presetBtns); if (presetRow) presetRow.appendChild(presetSet);

    const group = el('div', 'kefe-visualiser-control-group'); group.appendChild(el('div', 'kefe-label', 'Motion and look'));
    scene.sliders.forEach(s => group.appendChild(field(s)));
    const reset = el('button', 'kefe-btn', 'Reset'); reset.type = 'button';
    reset.addEventListener('click', () => { scene.sliders.forEach(s => { cfg[s.key] = s.def; const se = sliderEls[s.key]; se.input.value = s.def; se.out.textContent = s.fmt(s.def); }); applyPreset(0, false); });
    view.append(group, reset); form.appendChild(view);
    applyPreset(cfg.preset in scene.presets ? cfg.preset : 0, false);

    const tab = el('button', 'kefe-btn', scene.label); tab.type = 'button'; tab.setAttribute('role', 'tab'); tab.dataset.visualiser = scene.key; tab.dataset.icon = scene.icon;
    tab.setAttribute('aria-controls', view.id); tab.setAttribute('aria-label', scene.label + ' background'); tab.title = scene.label + ' background'; tab.setAttribute('aria-selected', 'false');
    const option = el('div', 'kefe-vis-option'); option.appendChild(tab); tabsList.appendChild(option);

    tabsList.addEventListener('click', e => {
      const clicked = e.target.closest('[role="tab"]');
      if (clicked && clicked !== tab) { active = false; view.hidden = true; presetSet.hidden = true; tab.classList.remove('primary'); tab.setAttribute('aria-selected', 'false'); sync(); }
    });
    tab.addEventListener('click', () => {
      const slot = document.getElementById('kefeVisualiserPowerSlot'); if (slot) slot.replaceChildren(power);
      form.querySelectorAll('.kefe-vis-view').forEach(v => v.hidden = v !== view);
      tabs.querySelectorAll('[role="tab"]').forEach(b => { const sel = b === tab; b.classList.toggle('primary', sel); b.setAttribute('aria-selected', String(sel)); });
      const pr = document.querySelector('.kefe-visualiser-preset-row'); if (pr) { pr.hidden = false; pr.querySelectorAll('.kefe-visualiser-preset-set').forEach(set => set.hidden = set !== presetSet); }
      const heading = document.getElementById('kefeVisualiserHeading'), description = document.getElementById('kefeVisualiserDescription');
      if (heading) heading.textContent = scene.title; if (description) description.textContent = '';
      const g = document.getElementById('kefeGradientCanvas'); if (g) g.style.display = 'none';
      active = true; sync();
    });

    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); if (raf) cancelAnimationFrame(raf); raf = 0; gl = null; });
    canvas.addEventListener('webglcontextrestored', () => { gl = canvas.getContext('webgl', opts); if (gl && build()) { resize(); if (inst.shown()) start(); } });
    window.addEventListener('resize', resize); window.addEventListener('kefe-stage-resize', resize);
    document.addEventListener('visibilitychange', () => { if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = 0; } else if (inst.shown()) start(); });
    inst.setEnabled = v => { enabled = !!v; sync(); };
    inst.setActive = v => { active = !!v; sync(); };
    inst.cfg = cfg; inst.renderOnce = () => { resize(); draw(0); };
    resize();
    return inst;
  }

  function init() {
    const tabs = document.querySelector('.kefe-vis-tabs'), form = document.querySelector('.kefe-visualiser-form'), stage = document.querySelector('.kefe-stage');
    if (!tabs || !form || !stage) { console.error('[KEFE Scenic] Required preview or controls are missing.'); return; }
    const tabsList = tabs.querySelector('[role="tablist"]') || tabs;
    SCENES.forEach(s => { const i = makeScene(s, stage, tabs, form, tabsList); if (i) instances.push(i); });
    window.kefeScenic = {
      getState: stateApi,
      canvas: () => stateApi().canvas,
      scene: key => instances.find(i => i.scene.key === key),
      setScene: (key, on = true) => { const i = instances.find(x => x.scene.key === key); if (i) { i.setActive(on); i.setEnabled(on); } }
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
