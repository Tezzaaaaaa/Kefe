/* KEFE — TuffPuff fluid visualiser.
   Self-contained WebGL2 fluid simulation. Renders into a hidden WebGL
   canvas, then exposes draw(ctx, w, h, time, frame, appState) so the
   dispatcher in visualiser-beat.js can blit the result into Kefe's
   preview canvas.

   Deterministic for export: fixed 60 Hz timestep, seeded RNG, full
   reset when time goes backward. Same time → same frame.

   Ported from TuffPuff.html (fork of Pavel Dobryakov, MIT).
*/
(function(){
  'use strict';
  if (window.kefeTuffPuff) return;

  var SIM_RES = 192;
  var DYE_RES = 1024;
  var SUNRAYS_WEIGHT = 1.0;
  var CURL = 30;
  var DENSITY_DISSIPATION = 1.0;
  var VELOCITY_DISSIPATION = 0.1;
  var PRESSURE_ITERATIONS = 20;
  var SPLAT_FORCE = 1000;
  var SPLAT_RADIUS_SLIDER = 0.25;
  var START_HUE = 0.5;
  var END_HUE = 1.0;

  /* Fixed simulation clock. Preview and export both advance the sim in
     whole steps of this size, so the state at time T is always the same
     regardless of how the renderer was driven. */
  var FIXED_DT = 1 / 60;
  /* Seed for the RNG. Same seed + same step count = same splats. */
  var SIM_SEED = 0x9e3779b9;

  var canvas = null, gl = null;
  var W = 0, H = 0;
  var dye = null, velocity = null, divergence = null, curl = null, pressure = null;
  var sunraysMaskFBO = null, sunraysFBO = null;
  var P = {}, blit = null, ready = false;

  var opts = {
    speed: 1.0,
    intensity: 0.15,
    curl: 1.0,
    force: 1.0,
    viscosity: 1.0,
    burst: 1.0
  };

  /* ---- Seeded RNG (mulberry32). Deterministic across runs. ---- */
  var rngState = SIM_SEED;
  function seedRng(s){ rngState = (s >>> 0) || 1; }
  function rng(){
    rngState = (rngState + 0x6D2B79F5) >>> 0;
    var t = rngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  var BASE_VS = 'precision highp float;\nattribute vec2 aPosition;\nvarying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;\nuniform vec2 texelSize;\nvoid main(){\n  vUv = aPosition * 0.5 + 0.5;\n  vL = vUv - vec2(texelSize.x, 0.0);\n  vR = vUv + vec2(texelSize.x, 0.0);\n  vT = vUv + vec2(0.0, texelSize.y);\n  vB = vUv - vec2(0.0, texelSize.y);\n  gl_Position = vec4(aPosition, 0.0, 1.0);\n}';

  var DISPLAY_FS = 'precision highp float; precision highp sampler2D;\nvarying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;\nuniform sampler2D uTexture;\nuniform sampler2D uSunrays;\nuniform float uSunraysWeight;\nuniform vec2 texelSize;\nvoid main(){\n  vec3 c = texture2D(uTexture, vUv).rgb;\n  vec3 lc = texture2D(uTexture, vL).rgb;\n  vec3 rc = texture2D(uTexture, vR).rgb;\n  vec3 tc = texture2D(uTexture, vT).rgb;\n  vec3 bc = texture2D(uTexture, vB).rgb;\n  float dx = length(rc) - length(lc);\n  float dy = length(tc) - length(bc);\n  vec3 n = normalize(vec3(dx, dy, length(texelSize)));\n  vec3 l = vec3(0.0, 0.0, 1.0);\n  float diffuse = clamp(dot(n, l) + 0.7, 0.7, 1.0);\n  c *= diffuse;\n  vec3 rays = texture2D(uSunrays, vUv).rgb;\n  c += rays * uSunraysWeight;\n  gl_FragColor = vec4(c, 1.0);\n}';

  var CLEAR_FS = 'precision mediump float; precision mediump sampler2D;\nvarying highp vec2 vUv; uniform sampler2D uTexture; uniform float value;\nvoid main(){ gl_FragColor = value * texture2D(uTexture, vUv); }';

  var SPLAT_FS = 'precision highp float; precision highp sampler2D;\nvarying vec2 vUv; uniform sampler2D uTarget; uniform float aspectRatio;\nuniform vec3 color; uniform vec2 point; uniform float radius;\nvoid main(){\n  vec2 p = vUv - point.xy;\n  p.x *= aspectRatio;\n  vec3 splat = exp(-dot(p, p) / radius) * color;\n  vec3 base = texture2D(uTarget, vUv).xyz;\n  gl_FragColor = vec4(base + splat, 1.0);\n}';

  var ADVECTION_FS = 'precision highp float; precision highp sampler2D;\nvarying vec2 vUv; uniform sampler2D uVelocity; uniform sampler2D uSource;\nuniform vec2 texelSize; uniform float dt; uniform float dissipation;\nvoid main(){\n  vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;\n  vec4 result = texture2D(uSource, coord);\n  float decay = 1.0 + dissipation * dt;\n  gl_FragColor = result / decay;\n}';

  var DIVERGENCE_FS = 'precision mediump float; precision mediump sampler2D;\nvarying highp vec2 vUv; varying highp vec2 vL; varying highp vec2 vR;\nvarying highp vec2 vT; varying highp vec2 vB;\nuniform sampler2D uVelocity;\nvoid main(){\n  float L = texture2D(uVelocity, vL).x;\n  float R = texture2D(uVelocity, vR).x;\n  float T = texture2D(uVelocity, vT).y;\n  float B = texture2D(uVelocity, vB).y;\n  vec2 C = texture2D(uVelocity, vUv).xy;\n  if (vL.x < 0.0) L = -C.x;\n  if (vR.x > 1.0) R = -C.x;\n  if (vT.y > 1.0) T = -C.y;\n  if (vB.y < 0.0) B = -C.y;\n  float div = 0.5 * (R - L + T - B);\n  gl_FragColor = vec4(div, 0.0, 0.0, 1.0);\n}';

  var CURL_FS = 'precision mediump float; precision mediump sampler2D;\nvarying highp vec2 vUv; varying highp vec2 vL; varying highp vec2 vR;\nvarying highp vec2 vT; varying highp vec2 vB;\nuniform sampler2D uVelocity;\nvoid main(){\n  float L = texture2D(uVelocity, vL).y;\n  float R = texture2D(uVelocity, vR).y;\n  float T = texture2D(uVelocity, vT).x;\n  float B = texture2D(uVelocity, vB).x;\n  float vorticity = R - L - T + B;\n  gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);\n}';

  var VORTICITY_FS = 'precision highp float; precision highp sampler2D;\nvarying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;\nuniform sampler2D uVelocity; uniform sampler2D uCurl;\nuniform float curl; uniform float dt;\nvoid main(){\n  float L = texture2D(uCurl, vL).x;\n  float R = texture2D(uCurl, vR).x;\n  float T = texture2D(uCurl, vT).x;\n  float B = texture2D(uCurl, vB).x;\n  float C = texture2D(uCurl, vUv).x;\n  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));\n  force /= length(force) + 0.0001;\n  force *= curl * C;\n  force.y *= -1.0;\n  vec2 velocity = texture2D(uVelocity, vUv).xy;\n  velocity += force * dt;\n  velocity = min(max(velocity, -1000.0), 1000.0);\n  gl_FragColor = vec4(velocity, 0.0, 1.0);\n}';

  var PRESSURE_FS = 'precision mediump float; precision mediump sampler2D;\nvarying highp vec2 vUv; varying highp vec2 vL; varying highp vec2 vR;\nvarying highp vec2 vT; varying highp vec2 vB;\nuniform sampler2D uPressure; uniform sampler2D uDivergence;\nvoid main(){\n  float L = texture2D(uPressure, vL).x;\n  float R = texture2D(uPressure, vR).x;\n  float T = texture2D(uPressure, vT).x;\n  float B = texture2D(uPressure, vB).x;\n  float divergence = texture2D(uDivergence, vUv).x;\n  float pressure = (L + R + B + T - divergence) * 0.25;\n  gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);\n}';

  var GRADIENT_SUBTRACT_FS = 'precision mediump float; precision mediump sampler2D;\nvarying highp vec2 vUv; varying highp vec2 vL; varying highp vec2 vR;\nvarying highp vec2 vT; varying highp vec2 vB;\nuniform sampler2D uPressure; uniform sampler2D uVelocity;\nvoid main(){\n  float L = texture2D(uPressure, vL).x;\n  float R = texture2D(uPressure, vR).x;\n  float T = texture2D(uPressure, vT).x;\n  float B = texture2D(uPressure, vB).x;\n  vec2 velocity = texture2D(uVelocity, vUv).xy;\n  velocity.xy -= vec2(R - L, T - B);\n  gl_FragColor = vec4(velocity, 0.0, 1.0);\n}';

  var SUNRAYS_MASK_FS = 'precision highp float;\nprecision highp sampler2D;\nvarying vec2 vUv;\nuniform sampler2D uTexture;\nvoid main(){\n  vec4 c = texture2D(uTexture, vUv);\n  float br = max(c.r, max(c.g, c.b));\n  c.a = 1.0 - min(max(br * 20.0, 0.0), 0.8);\n  gl_FragColor = c;\n}';

  var SUNRAYS_FS = 'precision highp float;\nprecision highp sampler2D;\nvarying vec2 vUv;\nuniform sampler2D uTexture;\nuniform vec2 texelSize;\nuniform vec2 uSunPos;\nvoid main(){\n  float weight = 1.0;\n  vec2 pos = vUv - uSunPos;\n  vec2 dir = normalize(pos + 0.0001);\n  vec2 uv = vUv - dir * texelSize * 2.0;\n  vec3 accum = vec3(0.0);\n  float w = 0.0;\n  for (int i = 0; i < 14; i++) {\n    accum += texture2D(uTexture, uv).rgb * weight;\n    uv -= dir * texelSize * 2.0;\n    w += weight;\n    weight *= 0.97;\n  }\n  gl_FragColor = vec4(accum / w, 1.0);\n}';

  function HSVtoRGB(h, s, v) {
    var r, g, b;
    var i = Math.floor(h * 6);
    var f = h * 6 - i;
    var p = v * (1 - s);
    var q = v * (1 - f * s);
    var t = v * (1 - (1 - f) * s);
    switch (i % 6) {
      case 0: r = v; g = t; b = p; break;
      case 1: r = q; g = v; b = p; break;
      case 2: r = p; g = v; b = t; break;
      case 3: r = p; g = q; b = v; break;
      case 4: r = t; g = p; b = v; break;
      case 5: r = v; g = p; b = q; break;
    }
    return { r: r, g: g, b: b };
  }

  function generateColor() {
    var hue = rng() * (END_HUE - START_HUE) + START_HUE;
    var c = HSVtoRGB(hue, 1.0, 1.0);
    c.r *= opts.intensity;
    c.g *= opts.intensity;
    c.b *= opts.intensity;
    return c;
  }

  function compileShader(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('[tuffpuff shader]', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }
  function makeProgram(fsSrc) {
    var p = gl.createProgram();
    gl.attachShader(p, compileShader(gl.VERTEX_SHADER, BASE_VS));
    gl.attachShader(p, compileShader(gl.FRAGMENT_SHADER, fsSrc));
    gl.bindAttribLocation(p, 0, 'aPosition');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error('[tuffpuff program]', gl.getProgramInfoLog(p));
      return null;
    }
    var u = {};
    var n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) {
      var info = gl.getActiveUniform(p, i);
      if (info) u[info.name] = gl.getUniformLocation(p, info.name);
    }
    return { p: p, u: u };
  }
  function createFBO(w, h, internal, format, type, filter) {
    gl.activeTexture(gl.TEXTURE0);
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
    var fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return {
      texture: tex, fbo: fbo, width: w, height: h,
      texelSizeX: 1 / w, texelSizeY: 1 / h,
      attach: function(id) { gl.activeTexture(gl.TEXTURE0 + id); gl.bindTexture(gl.TEXTURE_2D, tex); return id; }
    };
  }
  function createDoubleFBO(w, h, internal, format, type, filter) {
    var a = createFBO(w, h, internal, format, type, filter);
    var b = createFBO(w, h, internal, format, type, filter);
    return {
      width: w, height: h,
      texelSizeX: 1 / w, texelSizeY: 1 / h,
      get read() { return a; }, set read(v) { a = v; },
      get write() { return b; }, set write(v) { b = v; },
      swap: function() { var t = a; a = b; b = t; }
    };
  }

  function clearAllFBOs() {
    if (!gl) return;
    var targets = [dye.read, dye.write, velocity.read, velocity.write, divergence, curl, pressure.read, pressure.write, sunraysMaskFBO, sunraysFBO];
    for (var i = 0; i < targets.length; i++) {
      var t = targets[i];
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      gl.viewport(0, 0, t.width, t.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  function initGL(w, h) {
    canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    W = w; H = h;

    gl = canvas.getContext('webgl2', {
      alpha: true, premultipliedAlpha: false,
      depth: false, stencil: false, antialias: false,
      preserveDrawingBuffer: true, powerPreference: 'high-performance'
    });
    if (!gl) { console.warn('[tuffpuff] WebGL2 not supported'); return false; }
    if (!gl.getExtension('EXT_color_buffer_float')) {
      console.warn('[tuffpuff] Float textures not supported'); return false;
    }

    var simW = SIM_RES;
    var simH = Math.max(2, Math.round(SIM_RES * H / W));
    var dyeW = DYE_RES;
    var dyeH = Math.max(2, Math.round(DYE_RES * H / W));
    var srW = Math.max(2, Math.floor(W / 2));
    var srH = Math.max(2, Math.floor(H / 2));
    var half = gl.HALF_FLOAT;
    var lin = gl.LINEAR;
    var near = gl.NEAREST;

    dye = createDoubleFBO(dyeW, dyeH, gl.RGBA16F, gl.RGBA, half, lin);
    velocity = createDoubleFBO(simW, simH, gl.RG16F, gl.RG, half, lin);
    divergence = createFBO(simW, simH, gl.R16F, gl.RED, half, near);
    curl = createFBO(simW, simH, gl.R16F, gl.RED, half, near);
    pressure = createDoubleFBO(simW, simH, gl.R16F, gl.RED, half, near);
    sunraysMaskFBO = createFBO(srW, srH, gl.RGBA16F, gl.RGBA, half, lin);
    sunraysFBO = createFBO(srW, srH, gl.RGBA16F, gl.RGBA, half, lin);

    P.clear = makeProgram(CLEAR_FS);
    P.display = makeProgram(DISPLAY_FS);
    P.splat = makeProgram(SPLAT_FS);
    P.advection = makeProgram(ADVECTION_FS);
    P.divergence = makeProgram(DIVERGENCE_FS);
    P.curl = makeProgram(CURL_FS);
    P.vorticity = makeProgram(VORTICITY_FS);
    P.pressure = makeProgram(PRESSURE_FS);
    P.gradSub = makeProgram(GRADIENT_SUBTRACT_FS);
    P.sunraysMask = makeProgram(SUNRAYS_MASK_FS);
    P.sunrays = makeProgram(SUNRAYS_FS);

    if (!P.splat || !P.advection || !P.display || !P.sunrays || !P.sunraysMask) {
      console.warn('[tuffpuff] shader compile failed');
      return false;
    }

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    blit = function(target, clear) {
      if (target == null) { gl.viewport(0, 0, W, H); gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
      else { gl.viewport(0, 0, target.width, target.height); gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo); }
      if (clear !== false) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    ready = true;
    return true;
  }

  function useProgram(pr) {
    if (!pr) return;
    gl.useProgram(pr.p);
    if (pr.u.texelSize) gl.uniform2f(pr.u.texelSize, 1 / velocity.width, 1 / velocity.height);
  }
  function correctRadius(radius) {
    var aspectRatio = W / H;
    if (aspectRatio > 1) radius *= aspectRatio;
    return radius;
  }
  function splat(x, y, dx, dy, color, radiusMult) {
    if (!P.splat) return;
    var rm = radiusMult || 1;
    gl.disable(gl.BLEND);
    useProgram(P.splat);
    if (P.splat.u.aspectRatio) gl.uniform1f(P.splat.u.aspectRatio, W / H);
    var radius = correctRadius(SPLAT_RADIUS_SLIDER / 100.0) * rm;
    gl.uniform1i(P.splat.u.uTarget, velocity.read.attach(0));
    gl.uniform3f(P.splat.u.color, dx, dy, 0);
    gl.uniform2f(P.splat.u.point, x, y);
    gl.uniform1f(P.splat.u.radius, radius);
    blit(velocity.write, false); velocity.swap();
    gl.uniform1i(P.splat.u.uTarget, dye.read.attach(0));
    gl.uniform3f(P.splat.u.color, color.r, color.g, color.b);
    gl.uniform2f(P.splat.u.point, x, y);
    gl.uniform1f(P.splat.u.radius, radius);
    blit(dye.write, false); dye.swap();
  }
  function stepFluid(dt) {
    if (!gl) return;
    gl.disable(gl.BLEND);
    useProgram(P.curl);
    gl.uniform1i(P.curl.u.uVelocity, velocity.read.attach(0));
    blit(curl);

    useProgram(P.vorticity);
    gl.uniform1i(P.vorticity.u.uVelocity, velocity.read.attach(0));
    gl.uniform1i(P.vorticity.u.uCurl, curl.attach(1));
    gl.uniform1f(P.vorticity.u.curl, CURL * opts.curl);
    gl.uniform1f(P.vorticity.u.dt, dt);
    blit(velocity.write); velocity.swap();

    useProgram(P.divergence);
    gl.uniform1i(P.divergence.u.uVelocity, velocity.read.attach(0));
    blit(divergence);

    useProgram(P.clear);
    gl.uniform1i(P.clear.u.uTexture, pressure.read.attach(0));
    gl.uniform1f(P.clear.u.value, 0.8);
    blit(pressure.write); pressure.swap();

    useProgram(P.pressure);
    gl.uniform1i(P.pressure.u.uDivergence, divergence.attach(0));
    for (var i = 0; i < PRESSURE_ITERATIONS; i++) {
      gl.uniform1i(P.pressure.u.uPressure, pressure.read.attach(1));
      blit(pressure.write); pressure.swap();
    }

    useProgram(P.gradSub);
    gl.uniform1i(P.gradSub.u.uPressure, pressure.read.attach(0));
    gl.uniform1i(P.gradSub.u.uVelocity, velocity.read.attach(1));
    blit(velocity.write); velocity.swap();

    useProgram(P.advection);
    gl.uniform2f(P.advection.u.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(P.advection.u.uVelocity, velocity.read.attach(0));
    gl.uniform1i(P.advection.u.uSource, velocity.read.attach(0));
    gl.uniform1f(P.advection.u.dt, dt);
    gl.uniform1f(P.advection.u.dissipation, VELOCITY_DISSIPATION / opts.viscosity);
    blit(velocity.write); velocity.swap();

    gl.uniform1i(P.advection.u.uVelocity, velocity.read.attach(0));
    gl.uniform1i(P.advection.u.uSource, dye.read.attach(1));
    gl.uniform1f(P.advection.u.dt, dt);
    gl.uniform1f(P.advection.u.dissipation, DENSITY_DISSIPATION / opts.viscosity);
    blit(dye.write); dye.swap();
  }
  function renderSunrays() {
    if (!gl) return;
    useProgram(P.sunraysMask);
    gl.uniform1i(P.sunraysMask.u.uTexture, dye.read.attach(0));
    blit(sunraysMaskFBO, false);
    useProgram(P.sunrays);
    gl.uniform1i(P.sunrays.u.uTexture, sunraysMaskFBO.attach(0));
    gl.uniform2f(P.sunrays.u.texelSize, 1 / sunraysFBO.width, 1 / sunraysFBO.height);
    gl.uniform2f(P.sunrays.u.uSunPos, 0.5, 0.5);
    blit(sunraysFBO, false);
  }
  function displayFluid() {
    if (!gl) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    useProgram(P.display);
    if (P.display.u.texelSize) gl.uniform2f(P.display.u.texelSize, 1 / W, 1 / H);
    gl.uniform1i(P.display.u.uTexture, dye.read.attach(0));
    gl.uniform1i(P.display.u.uSunrays, sunraysFBO.attach(1));
    gl.uniform1f(P.display.u.uSunraysWeight, SUNRAYS_WEIGHT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  var simStep = 0;
  var lastBassStep = -1000, lastTrebleStep = -1000, lastDriftStep = -1000;

  function resetSimState(){
    simStep = 0;
    lastBassStep = -1000;
    lastTrebleStep = -1000;
    lastDriftStep = -1000;
    seedRng(SIM_SEED);
    clearAllFBOs();
  }

  function emit(time, frame) {
    var stepNow = simStep;
    var stepSec = stepNow * FIXED_DT;

    if (stepNow - lastDriftStep >= Math.round(0.05 / FIXED_DT)) {
      lastDriftStep = stepNow;
      var pathSpeed = 0.85 * opts.speed;
      var ax = 0.34, ay = 0.30;
      var sx = 0.5 + Math.sin(stepSec * pathSpeed) * ax;
      var sy = 0.5 + Math.cos(stepSec * pathSpeed * 0.73) * ay;
      var vx =  Math.cos(stepSec * pathSpeed) * ax * pathSpeed;
      var vy = -Math.sin(stepSec * pathSpeed * 0.73) * ay * pathSpeed * 0.73;
      var col = generateColor();
      var force = (SPLAT_FORCE * (0.3 + frame.energy * 0.7) * 0.35) * opts.force;
      splat(sx, sy, vx * force, vy * force, col, 1.0);
    }
    if (frame.bass > 0.60 && stepNow - lastBassStep >= Math.round(0.55 / FIXED_DT)) {
      lastBassStep = stepNow;
      var col2 = generateColor();
      var px = -0.15 + rng() * 1.3;
      var py = -0.15 + rng() * 1.3;
      var ox = px - 0.5;
      var oy = py - 0.5;
      var od = Math.hypot(ox, oy) + 0.001;
      var swirlX = -oy / od;
      var swirlY =  ox / od;
      var radialMix = 0.25;
      var dx = swirlX * (1 - radialMix) + (ox / od) * radialMix;
      var dy = swirlY * (1 - radialMix) + (oy / od) * radialMix;
      var force2 = SPLAT_FORCE * (0.5 + frame.energy * 0.8) * opts.force;
      splat(px, py, dx * force2, dy * force2, col2, 1.2);
    }
    if (frame.treble > 0.40 * (2 - opts.burst) && stepNow - lastTrebleStep >= Math.round(0.55 / FIXED_DT)) {
      lastTrebleStep = stepNow;
      var n = 1 + Math.floor(rng() * 2 * opts.burst);
      for (var i = 0; i < n; i++) {
        var px2 = -0.1 + rng() * 1.2;
        var py2 = -0.1 + rng() * 1.2;
        var ang = rng() * Math.PI * 2;
        var col3 = generateColor();
        var force3 = SPLAT_FORCE * (0.2 + rng() * 0.35) * opts.force;
        splat(px2, py2, Math.cos(ang) * force3, Math.sin(ang) * force3, col3, 0.5);
      }
    }
  }

  function readOpts(appState) {
    var st = (appState && appState.style) || {};
    opts.speed     = (st.tpSpeed     !== undefined) ? Number(st.tpSpeed)     : 1.0;
    opts.intensity = (st.tpIntensity !== undefined) ? Number(st.tpIntensity) : 0.15;
    opts.curl      = (st.tpCurl      !== undefined) ? Number(st.tpCurl)      : 1.0;
    opts.force     = (st.tpForce     !== undefined) ? Number(st.tpForce)     : 1.0;
    opts.viscosity = (st.tpViscosity !== undefined) ? Number(st.tpViscosity) : 1.0;
    opts.burst     = (st.tpBurst     !== undefined) ? Number(st.tpBurst)     : 1.0;
  }

  var lastRenderTime = -1;

  function draw(ctx, w, h, time, frame, appState) {
    if (!ready || W !== w || H !== h) {
      if (!initGL(w, h)) return;
      resetSimState();
      lastRenderTime = -1;
    }
    if (!frame) return;

    if (lastRenderTime < 0 || time < lastRenderTime - 1e-6) {
      resetSimState();
      lastRenderTime = time;
    }

    readOpts(appState);

    var targetStep = Math.floor(time / FIXED_DT);
    var steps = targetStep - simStep;
    var maxStepsPerCall = 240;
    if (steps > maxStepsPerCall) {
      resetSimState();
      lastRenderTime = time;
      steps = 0;
    }
    for (var i = 0; i < steps; i++) {
      simStep++;
      emit(time, frame);
      stepFluid(FIXED_DT * opts.speed);
    }
    lastRenderTime = time;

    renderSunrays();
    displayFluid();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(canvas, 0, 0, w, h);
    ctx.restore();
  }

  function refresh() {
    ready = false;
    lastRenderTime = -1;
  }

  window.kefeTuffPuff = {
    version: 2,
    draw: draw,
    refresh: refresh
  };
})();
