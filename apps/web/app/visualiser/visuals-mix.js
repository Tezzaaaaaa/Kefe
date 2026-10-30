/* KEFE Visuals Mix — the supplied Ethereal flow shader (7 flow modes, 4 finishes) as a standalone visualiser. */
(function () {
  'use strict';
  if (!window.kefeShaderVis) { console.error('[KEFE Visuals Mix] shader-vis.js must load first.'); return; }
  const FS = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
    uniform vec2 R;
    uniform float T, H, M, F;
    uniform vec3 au;

    #define A (R.x / R.y)

    // Color conversion
    vec3 hsl(float h, float s, float l){
      vec3 k = mod(vec3(0., 8., 4.) + h * 12., 12.);
      float a = s * min(l, 1. - l);
      return l - a * max(vec3(-1.), min(min(k - 3., 9. - k), vec3(1.)));
    }

    vec3 applyTint(vec3 col, float hueShift) {
      if (hueShift < 0.001) return col;
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      if (l < 0.001) return col;
      vec3 tinted = hsl(hueShift, 0.7, clamp(l, 0.1, 0.9));
      return mix(col, tinted, 0.35);
    }

    float hash(vec2 p){
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float noise(vec2 p){
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3. - 2. * f);
      return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x),
                 mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y);
    }

    float fbm(vec2 p){
      float v = 0., a = .5;
      for(int i = 0; i < 5; i++){
        v += a * noise(p);
        p = p * 2.03 + vec2(1.7, 9.2);
        a *= .5;
      }
      return v;
    }

    float sdS(vec2 p, vec2 a, vec2 b, out float hh){
      vec2 pa = p - a, ba = b - a;
      hh = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.);
      return length(pa - ba * hh);
    }

    vec2 bz(vec2 pos, vec2 A_pt, vec2 B_pt, vec2 C_pt){
      vec2 a = B_pt - A_pt, b = A_pt - 2. * B_pt + C_pt, c = a * 2., d = A_pt - pos;
      float kk = 1. / dot(b, b);
      float kx = kk * dot(a, b);
      float ky = kk * (2. * dot(a, a) + dot(d, b)) / 3.;
      float kz = kk * dot(d, a);
      float p = ky - kx * kx;
      float p3 = p * p * p;
      float q = kx * (2. * kx * kx - 3. * ky) + kz;
      float hq = q * q + 4. * p3;
      float res, tt;
      if(hq >= 0.){
        hq = sqrt(hq);
        vec2 x = (vec2(hq, -hq) - q) / 2.;
        vec2 uv = sign(x) * pow(abs(x), vec2(1. / 3.));
        tt = clamp(uv.x + uv.y - kx, 0., 1.);
        vec2 qq = d + (c + b * tt) * tt;
        res = dot(qq, qq);
      } else {
        float z = sqrt(-p);
        float v = acos(q / (p * z * 2.)) / 3.;
        float m = cos(v);
        float nn = sin(v) * 1.732050808;
        vec3 t3 = clamp(vec3(m + m, -nn - m, nn - m) * z - kx, 0., 1.);
        vec2 qx = d + (c + b * t3.x) * t3.x;
        vec2 qy = d + (c + b * t3.y) * t3.y;
        float dx = dot(qx, qx), dy = dot(qy, qy);
        if(dx < dy){ res = dx; tt = t3.x; } else { res = dy; tt = t3.y; }
      }
      return vec2(sqrt(res), tt);
    }

    vec3 ln(vec2 p, vec2 A_pt, vec2 B_pt, vec2 C_pt, float w, vec3 col, float hot, float k){
      float s = T * .17 + k * 1.7;
      A_pt += .011 * vec2(sin(s), cos(s * 1.2));
      B_pt += .016 * vec2(cos(s * .9 + 1.), sin(s * .8));
      C_pt += .008 * vec2(sin(s * 1.1 + 2.), cos(s));
      vec2 q = bz(p, A_pt, B_pt, C_pt);
      float ht = .5 + .4 * sin(T * .12 + k * 2.3);
      float hz = exp(-pow((q.y - ht) / .16, 2.));
      float ww = w * (1. + 2.2 * hz * hot);
      float core = exp(-q.x * q.x / (ww * ww));
      float glow = exp(-q.x / (ww * 7.)) * .14;
      float tp = smoothstep(0., .07, q.y) * smoothstep(1., .9, q.y);
      vec3 c = mix(col, vec3(1., .93, .8), hz * hot);
      return c * (core * (.7 + .6 * hz * hot) + glow) * mix(1., tp, step(.5, hot));
    }

    float bl(vec2 p, vec2 c, vec2 rd, float an){
      vec2 q = p - c;
      float ca = cos(an), sa = sin(an);
      q = vec2(ca * q.x + sa * q.y, -sa * q.x + ca * q.y);
      q /= rd;
      return exp(-dot(q, q) * 1.8);
    }

    vec3 scene(vec2 uv) {
      vec3 c0 = hsl(H, .78, .52), c1 = hsl(H + .11, .72, .50);
      vec3 c2 = hsl(H - .11, .76, .56), c3 = hsl(H + .5, .62, .44), c4 = hsl(H + .3, .75, .62);
      vec3 col = vec3(0.);

      // Mode 0: Green Dust
      if (M < 0.5) {
        vec2 u = (gl_FragCoord.xy - .5 * R) / (min(R.y, R.x / 0.5625) * 1.12);
        vec2 c_pt = vec2(-.105 + .006 * sin(T * .11), .006 * cos(T * .09));
        vec2 d = u - c_pt;
        float a = atan(d.y, d.x);
        float rad = length(d);
        a += .05 * sin(T * .1 + rad * 5.);
        float cs = cos(a);
        float Rin = mix(.17, .115, smoothstep(-.3, 1., cs));
        float Rout = .34 + .05 * cs + .012 * sin(a * 2. + T * .14) + au.x * .015;
        float tt = (rad - Rin) / (Rout - Rin);
        float L = clamp(exp(-pow((a + .15) / 1.15, 2.)), .3, 1.);
        float m = smoothstep(-1.45, -.8, a) * smoothstep(2.75, 2.05, a);
        float prof = smoothstep(-.05, .2, tt) * exp(-max(tt - .92, 0.) * 9.);
        float ringD = prof * m * (.88 + .3 * noise(u * 5. + T * .04));

        float hh;
        vec2 la = vec2(-.30, -.30) + .004 * vec2(sin(T * .13), cos(T * .1)), lb = vec2(-.05, .045);
        float dl = sdS(u, la, lb, hh);
        float rl = mix(.17, .07, pow(hh, .7));
        float ed = dl - rl;
        float lobe = exp(-max(ed, 0.) * 20.) * (.9 + .2 * noise(u * 6. - T * .03));
        vec2 nv = u - (la + (lb - la) * hh);
        float side = dot(nv, vec2(.8, .6)) / max(length(nv), 1e-4);
        float lit = smoothstep(-.3, .9, side) * (.4 + .6 * smoothstep(-.9, 0., ed / rl));
        vec2 pb = u - vec2(.16, -.40);
        float blob = exp(-dot(pb, pb) / .006) * .55;
        float dens = clamp(ringD + lobe * .95 + blob, 0., 1.2);

        vec3 dark = vec3(0., .30, .04), mid = vec3(.1, .58, .07), lime = vec3(.64, .93, .04);
        vec3 pale = vec3(.82, .97, .88), cy = vec3(.72, .92, .97);
        vec3 cr = mix(dark, mid, smoothstep(0., .35, tt));
        cr = mix(cr, lime, smoothstep(.3, .62, tt) * L);
        cr = mix(cr, pale, smoothstep(.78, 1., tt) * L);
        cr = mix(cr, cy, smoothstep(.95, 1.2, tt) * L * .8);
        cr *= .45 + .75 * L;
        vec3 cl = mix(vec3(.02, .36, .06), vec3(.72, .95, .5), lit);
        col = mix(cr, cl, clamp(lobe / (ringD + lobe + 1e-3), 0., 1.));
        col = mix(col, vec3(.05, .33, .06), clamp(blob / (dens + 1e-3), 0., 1.));

        float cell = max(1., R.y / 720.);
        vec2 fc = gl_FragCoord.xy / cell;
        vec2 g_pt = floor(fc);
        vec2 f_pt = fract(fc) - .5;
        float r1 = hash(g_pt), r2 = hash(g_pt + 17.3), r3 = hash(g_pt + 3.1);
        float on = step(r1, dens);
        float tw = .65 + .35 * sin(T * (.25 + .5 * r2) + r2 * 40.);
        float dt = smoothstep(.62, .3, length(f_pt));
        col = mix(col, vec3(.92, 1., .95), step(.94, r3) * .65 * tw * smoothstep(.3, .9, L));
        vec3 o = col * (.55 + .7 * r3) * tw * on * dt + col * dens * .07;

        float am = smoothstep(.8, 1.5, a) * smoothstep(3.05, 2.3, a);
        float ls = 0.;
        for(int i = 0; i < 5; i++){
          float r_val = i==0?.21 : i==1?.24 : i==2?.28 : i==3?.405 : .432;
          float e = (rad - r_val - .004 * sin(a * 3. + T * .12)) / .0022;
          ls += exp(-e * e) * (i < 3 ? .55 : .4);
        }
        o += vec3(0., .5, .14) * ls * am * .6;
        o += vec3(0., .028, .01) * (1. - clamp(length(u) * .8, 0., 1.));
        o += (hash(gl_FragCoord.xy + T) - .5) / 255.;
        col = applyTint(o, H);
      }
      // Mode 1: Dark Glass
      else if (M < 1.5) {
        vec2 u = (gl_FragCoord.xy - .5 * R) / (min(R.y, R.x / 0.5625) * 1.12);
        vec3 or_c = vec3(1., .38, .08), rd_c = vec3(.8, .12, .04), o = vec3(0.);
        o += ln(u, vec2(.281, .496), vec2(-.234, .547), vec2(-.191, .0625), .0024, or_c, 1., 0.);
        o += ln(u, vec2(-.191, -.039), vec2(-.219, -.328), vec2(.008, -.3125), .0022, rd_c * 1.2, 1., 1.);
        o += ln(u, vec2(-.172, -.039), vec2(-.047, -.203), vec2(-.055, -.273), .0016, vec3(1., .9, .75), 0., 2.);
        o += ln(u, vec2(-.164, 0.), vec2(-.117, -.0625), vec2(-.0156, -.281), .0018, or_c * .9, 1., 3.);
        o += ln(u, vec2(.199, -.078), vec2(.227, -.281), vec2(.281, -.359), .0022, or_c, 1., 4.);
        o += ln(u, vec2(.207, -.023), vec2(.258, .0625), vec2(.281, .117), .0018, vec3(.12, .3, 1.), 0., 5.) * 1.3;
        o += ln(u, vec2(-.141, .055), vec2(.031, .242), vec2(.281, .422), .0012, vec3(.5, .45, .45), 0., 6.) * .35;
        o += ln(u, vec2(.027, -.328), vec2(.086, -.4375), vec2(.1875, -.496), .0015, or_c * .8, 0., 7.) * .6;
        o += ln(u, vec2(.06, -.343), vec2(.1, -.36), vec2(.15, -.375), .0018, vec3(1., .75, .35), 0., 8.) * 1.2;

        vec2 ps = u - vec2(.086, -.352);
        o += vec3(.9, .55, .18) * exp(-(ps.x * ps.x / .0050 + ps.y * ps.y / .00018)) * .42 * (1. + au.x * .8);
        o += vec3(.35, .18, .06) * exp(-(ps.x * ps.x / .012 + ps.y * ps.y / .0012)) * .35;

        float s = T * .1;
        float b1 = bl(u, vec2(-.121 + .01 * sin(s), .266 + .008 * cos(s * 1.2)), vec2(.03, .08), -.22);
        float b2 = bl(u, vec2(.10 + .008 * cos(s * .9), .078 + .01 * sin(s)), vec2(.036, .11), .22);
        float b3 = bl(u, vec2(.19 + .006 * sin(s * 1.1), .078 + .008 * cos(s * .8)), vec2(.045, .06), 0.);
        float tr = .85 + .5 * au.z;
        o += vec3(.1, .22, .95) * b1 * .85 * tr + mix(vec3(.04, .55, .75), vec3(.08, .3, 1.), smoothstep(-.05, .05, u.x - .1)) * b2 * .8 * tr + vec3(.04, .14, .9) * b3 * .8 * tr;
        o += (hash(gl_FragCoord.xy + T) - .5) / 255.;
        col = applyTint(o, H);
      }
      // Mode 2: Blue Satin
      else if (M < 2.5) {
        vec2 u = (gl_FragCoord.xy - .5 * R) / (min(R.y, R.x / 0.75) * 1.12);
        vec2 q = u * 1.4;
        float T_half = T * .5;
        for(int i = 0; i < 3; i++){
          float fi = float(i);
          q += .35 * vec2(noise(q * 1.1 + vec2(T_half * .3 + fi * 5., fi * 3.)) - .5,
                         noise(q * 1.1 + vec2(fi * 7., T_half * .25 + fi * 2.)) - .5) * 2.;
        }
        float w = q.y * 1.9 + q.x * .55 + .6 * sin(q.x * 1.3 + T_half * .4);
        float a = sin(w * 3.14159 + T_half * .2);
        float soft = pow(smoothstep(-.35, .95, a), 1.7);
        float cr = abs(sin(w * 1.5708 + 1.1));
        float mk = smoothstep(.4, .7, noise(q * .5 + 3.));
        float line = mix(1., smoothstep(0., .03, cr), mk);
        float halo = line * exp(-cr * 20.) * .8 * mk;
        float big = noise(q * .7 + T_half * .1);
        vec3 B_c = vec3(.06, .55, 1.);
        vec3 o = B_c * soft * (.55 + .75 * big) * line * (1. + au.y * .6) + vec3(.2, .7, 1.) * halo * (.4 + .6 * soft);
        o += vec3(.25, .55, .9) * pow(soft, 5.) * .3 * (1. + au.x * .8);
        o += (hash(gl_FragCoord.xy + T) - .5) / 255.;
        col = applyTint(o, H);
      }
      // Mode 3: Mesh
      else if (M < 3.5) {
        vec2 g = (uv - .5) * vec2(A, 1.);
        float t = T * .14;
        float a = 1.1 * exp(-dot(g, g) * 2.2) * sin(t * .9 + .6);
        g = mat2(cos(a), -sin(a), sin(a), cos(a)) * g;
        for(int i = 1; i < 4; i++){
          float fi = float(i);
          g.x += .17 / fi * sin(fi * 2.3 * g.y + t * (1. + .3 * fi) + fi);
          g.y += .17 / fi * cos(fi * 2.1 * g.x + t * (1. + .25 * fi) + fi * 2.);
        }
        vec3 acc = vec3(0.); float ws = 0.;
        for(int i = 0; i < 5; i++){
          float fi = float(i);
          vec2 c = vec2(A * .5 * sin(t * (.6 + .11 * fi) + fi * 1.9), .5 * cos(t * (.5 + .09 * fi) + fi * 2.7));
          vec2 d = g - c;
          float w = 1. / pow(dot(d, d) + .004, 1.6);
          vec3 pc = fi < .5 ? hsl(H + .62, .55, .10) : (fi < 1.5 ? c0 : (fi < 2.5 ? c2 : (fi < 3.5 ? c4 : c1)));
          acc += pc * w; ws += w;
        }
        col = acc / ws;
        col *= (1.0 + au.x * 0.8);
      }
      // Mode 4: Aurora
      else if (M < 4.5) {
        col = mix(hsl(H + .55, .55, .10), hsl(H + .6, .6, .015), uv.y);
        float x = uv.x * A, t = T * .6;
        for(int i = 0; i < 4; i++){
          float fi = float(i);
          float y0 = .5 + .12 * sin(x * 1.6 + t * .35 + fi * 1.7) + .08 * sin(x * 3.1 - t * .5 + fi * 2.9) + .14 * (fbm(vec2(x * .8 + fi * 5., t * .12)) - .5);
          float d = uv.y - y0;
          float fall = d > 0. ? exp(-d * 7.) : exp(-d * d * 220.);
          float rays = .5 + .5 * noise(vec2(x * 16. + fi * 9., t * .4 + fi));
          vec3 ac = fi < .5 ? c0 : (fi < 1.5 ? c4 : (fi < 2.5 ? c1 : c2));
          col += ac * fall * rays * (.62 + au.y * 0.8);
        }
        vec2 sp = floor(uv * R / 2.);
        float s = step(.9985, hash(sp));
        col += s * (.4 + .6 * sin(T * 2. + hash(sp + 3.) * 30.)) * .7 * (1. - uv.y * .5);
      }
      // Mode 5: Warp
      else if (M < 5.5) {
        vec2 p = (uv - .5) * vec2(A, 1.) * 2.2;
        float t = T * .1;
        vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
        vec2 r_v = vec2(fbm(p + 3. * q + vec2(1.7, 9.2) + t * 1.3), fbm(p + 3. * q + vec2(8.3, 2.8) - t));
        float f = fbm(p + 3. * r_v);
        col = mix(hsl(H + .5, .6, .08), c0, clamp(f * f * 3.5, 0., 1.));
        col = mix(col, c1, clamp(length(q), 0., 1.) * .8);
        col = mix(col, c4, clamp(r_v.x * r_v.x, 0., 1.) * .7);
        col *= 2. * (f * f * f + .6 * f * f + .5 * f);
        col *= (1.0 + au.z * 0.7);
      }
      // Mode 6: Panels
      else {
        vec2 p = (uv - .5) * vec2(A, 1.);
        float t = T * .2;
        vec3 bg = mix(hsl(H + .62, .55, .05), hsl(H + .5, .6, .14), uv.y);
        for(int i = 0; i < 7; i++){
          float fi = float(i);
          float a = (fi - 3.) * .2 + .35 * sin(t * .5 + fi * .9) + t * .12;
          vec2 q = mat2(cos(a), -sin(a), sin(a), cos(a)) * p;
          float off = (fi - 3.) * .2 + .12 * sin(t + fi * 1.7);
          float w = .085 + .03 * sin(t * .7 + fi * 2.3);
          float dx = abs(q.x - off);
          float m = smoothstep(w, w * .35, dx);
          vec3 pc = mix(mix(c3, c0, fi / 6.), c4, smoothstep(-.5, .6, q.y));
          bg = mix(bg, pc, m * .55);
          bg += pc * m * .18;
          bg += mix(c4, vec3(1.), .5) * exp(-abs(dx - w) * 60.) * .22;
        }
        col = bg * (1.0 + au.x * 0.5);
      }

      return col;
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / R;
      vec3 col;

      // Finish Processing
      if (F > 2.5) { // PRISM
        vec2 d = (uv - .5) * .014;
        col = vec3(scene(uv + d).r, scene(uv).g, scene(uv - d).b);
        col += pow(max(col, 0.), vec3(2.2)) * .8;
        col = 1. - exp(-col * 1.35);
      } else {
        col = scene(uv);
      }

      if (F > 0.5 && F < 1.5) { // GRAIN
        float g = hash(gl_FragCoord.xy + fract(T) * 97.) - .5;
        float l = dot(col, vec3(.333));
        col = (col - .5) * 1.1 + .5;
        col += g * .24 * (.35 + l);
      }

      if (F > 1.5 && F < 2.5) { // HOLO
        float l = dot(col, vec3(.299, .587, .114));
        vec3 ir = .5 + .5 * cos(6.2832 * (l * 1.6 + uv.x * .35 + vec3(0., .33, .67) + T * .02));
        col = mix(col, col * .35 + ir * .8 * (.3 + l), .62);
      }

      gl_FragColor = vec4(clamp(col, 0., 1.), 1.);
    }
  `;
  const FLOWS = [['dust', 'Green Dust'], ['darkglass', 'Dark Glass'], ['satin', 'Blue Satin'], ['mesh', 'Mesh'], ['aurora', 'Aurora'], ['warp', 'Warp'], ['panels', 'Panels']];
  const FINISHES = [['clean', 'Clean'], ['grain', 'Grain'], ['holo', 'Holo'], ['prism', 'Prism']];
  const FLOW_MAP = { dust: 0, darkglass: 1, satin: 2, mesh: 3, aurora: 4, warp: 5, panels: 6 };
  const FIN_MAP = { clean: 0, grain: 1, holo: 2, prism: 3 };
  window.kefeShaderVis.register({
    id: 'visuals-mix', name: 'Visuals Mix', icon: '❖', canvasId: 'kefeVisualsMixCanvas', opacity: 0.85, maxSide: 1920,
    fs: FS,
    uniforms: ['R', 'T', 'H', 'M', 'F', 'au'],
    defaults: { hue: 180, speed: 1, flow: 'dust', finish: 'clean', react: 1 },
    presets: FLOWS.map(([id, label]) => ({ id, label, values: { flow: id } })),
    draw({ gl, loc, cfg, dt, audio, width, height, reducedMotion, advance }) {
      const t = advance(dt * cfg.speed * (reducedMotion ? .5 : 1)), r = cfg.react;
      gl.uniform2f(loc.R, width, height); gl.uniform1f(loc.T, t + 7);
      gl.uniform1f(loc.H, cfg.hue / 360); gl.uniform1f(loc.M, FLOW_MAP[cfg.flow] ?? 0); gl.uniform1f(loc.F, FIN_MAP[cfg.finish] ?? 0);
      gl.uniform3f(loc.au, Math.min(1.2, audio[0] * r), Math.min(1.2, (audio[1] * .6 + audio[2] * .4) * r), Math.min(1.2, (audio[2] * .5 + audio[3] * .5) * 2 * r));
    },
    buildView({ view, field, choice }) {
      const group = (title, nodes) => { const g = document.createElement('div'); g.className = 'kefe-visualiser-control-group'; const h = document.createElement('div'); h.className = 'kefe-label'; h.textContent = title; g.appendChild(h); nodes.forEach(n => g.appendChild(n)); view.appendChild(g); return g; };
      const finish = document.createElement('div'); finish.className = 'kefe-seg kefe-shader-vis-finish'; choice(finish, FINISHES, 'finish');
      group('Colour and motion', [field('Spectrum tint', 'hue', 0, 360, 1, v => Math.round(v) + '°'), field('Speed', 'speed', 0, 3, .1, v => v.toFixed(1) + '×'), field('Audio reactivity', 'react', 0, 2, .05, v => v.toFixed(2) + '×')]);
      group('Finish', [finish]);
    },
  });
})();
