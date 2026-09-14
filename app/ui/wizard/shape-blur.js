/* KEFE — faithful port of the ShapeBlur shader.
   Raw WebGL2, no Three.js. Border traces the wizard choice card edges. */
(function(){
  'use strict';
  if (window.__kefeShapeBlur) return;
  window.__kefeShapeBlur = true;

  var VERT = [
    '#version 300 es',
    'in vec2 position;',
    'void main(){ gl_Position = vec4(position, 0.0, 1.0); }'
  ].join('\n');

  var FRAG = [
    '#version 300 es',
    'precision highp float;',
    'uniform vec2 u_mouse;',
    'uniform vec2 u_resolution;',
    'uniform float u_pixelRatio;',
    'uniform vec2 u_shapeSize;',
    'uniform float u_roundness;',
    'uniform float u_borderSize;',
    'uniform float u_circleSize;',
    'uniform float u_circleEdge;',
    'uniform vec3 u_color;',
    'out vec4 fragColor;',
    '#ifndef PI',
    '#define PI 3.1415926535897932384626433832795',
    '#endif',
    'vec2 coord(in vec2 p){',
    '  p=p/u_resolution.xy;',
    '  if(u_resolution.x>u_resolution.y){p.x*=u_resolution.x/u_resolution.y;p.x+=(u_resolution.y-u_resolution.x)/u_resolution.y/2.;}',
    '  else{p.y*=u_resolution.y/u_resolution.x;p.y+=(u_resolution.x-u_resolution.y)/u_resolution.x/2.;}',
    '  p-=.5;p*=vec2(-1.,1.);return p;',
    '}',
    '#define st0 coord(gl_FragCoord.xy)',
    '#define mx coord(u_mouse*u_pixelRatio)',
    'float sdRoundRect(vec2 p,vec2 b,float r){vec2 d=abs(p-.5)*4.2-b+vec2(r);return min(max(d.x,d.y),0.)+length(max(d,0.))-r;}',
    'float sdCircle(in vec2 st,in vec2 c){return length(st-c)*2.;}',
    'float aastep(float threshold,float value){float afwidth=length(vec2(dFdx(value),dFdy(value)))*.70710678;return smoothstep(threshold-afwidth,threshold+afwidth,value);}',
    'float fill(in float x){return 1.-aastep(0.,x);}',
    'float fill(float x,float size,float edge){return 1.-smoothstep(size-edge,size+edge,x);}',
    'float strokeAA(float x,float size,float w,float edge){float afwidth=length(vec2(dFdx(x),dFdy(x)))*.70710678;float d=smoothstep(size-edge-afwidth,size+edge+afwidth,x+w*.5)-smoothstep(size-edge-afwidth,size+edge+afwidth,x-w*.5);return clamp(d,0.,1.);}',
    'void main(){',
    '  vec2 st=st0+.5;',
    '  vec2 posMouse=mx*vec2(1.,-1.)+.5;',
    '  float sdfCircle=fill(sdCircle(st,posMouse),u_circleSize,u_circleEdge);',
    '  float sdf=sdRoundRect(st,u_shapeSize,u_roundness);',
    '  sdf=strokeAA(sdf,0.,u_borderSize,sdfCircle)*4.;',
    '  // Only emit colour where the stroke is actually visible;',
    '  // everywhere else stays fully transparent.',
    '  if (sdf <= 0.001) discard;',
    '  fragColor=vec4(u_color,sdf);',
    '}'
  ].join('\n');

  var css = document.createElement('style');
  css.id = 'kefe-shape-blur-css';
  css.textContent = [
    '.kefe-shape-blur{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:3;border-radius:inherit;mix-blend-mode:normal}',
    '.wizard-choice{position:relative}'
  ].join('\n');
  document.head.appendChild(css);

  var mounted = new Map();

  function compile(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.warn('[KEFE shape-blur] compile:', gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function isNightTheme() {
    var t = document.documentElement.dataset.theme;
    if (t === 'night') return true;
    if (t === 'day') return false;
    return !window.matchMedia || window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function mountCard(card) {
    var canvas = document.createElement('canvas');
    canvas.className = 'kefe-shape-blur';
    canvas.setAttribute('aria-hidden', 'true');
    card.appendChild(canvas);

    var gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: true
    });
    if (!gl) { canvas.remove(); return null; }

    var vs = compile(gl, gl.VERTEX_SHADER, VERT);
    var fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) { canvas.remove(); return null; }

    var program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn('[KEFE shape-blur] link:', gl.getProgramInfoLog(program));
      canvas.remove();
      return null;
    }

    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );

    var posLoc = gl.getAttribLocation(program, 'position');
    var uMouse = gl.getUniformLocation(program, 'u_mouse');
    var uResolution = gl.getUniformLocation(program, 'u_resolution');
    var uPixelRatio = gl.getUniformLocation(program, 'u_pixelRatio');
    var uShapeSize = gl.getUniformLocation(program, 'u_shapeSize');
    var uRoundness = gl.getUniformLocation(program, 'u_roundness');
    var uBorderSize = gl.getUniformLocation(program, 'u_borderSize');
    var uCircleSize = gl.getUniformLocation(program, 'u_circleSize');
    var uCircleEdge = gl.getUniformLocation(program, 'u_circleEdge');
    var uColor = gl.getUniformLocation(program, 'u_color');

    var mouseX = -9999, mouseY = -9999;
    var dampedX = -9999, dampedY = -9999;
    var raf = 0, active = true, lastT = performance.now();
    var sizeX = 2.1, sizeY = 2.1;

    function applyColour() {
      gl.useProgram(program);
      if (isNightTheme()) gl.uniform3f(uColor, 1.0, 1.0, 1.0);
      else gl.uniform3f(uColor, 0.06, 0.06, 0.06);
    }
    applyColour();

    var themeObs = new MutationObserver(applyColour);
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    function resize() {
      if (!active) return;
      var rect = card.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      gl.viewport(0, 0, canvas.width, canvas.height);

      // After the shader's coord() normalisation, the shorter dimension
      // spans 0..1 and the longer spans 0..(longer/shorter). To make the
      // SDF border trace the card's actual edges we compute a non-uniform
      // shapeSize that reaches both.
      //   2.1 = 4.2 * 0.5  (the shader's internal scaling constant)
      var aspect = canvas.width / canvas.height;
      if (aspect >= 1) {
        sizeY = 2.1;
        sizeX = 2.1 * aspect;
      } else {
        sizeX = 2.1;
        sizeY = 2.1 / aspect;
      }
    }

    function onMove(e) {
      var rect = card.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
    }
    function onLeave() { mouseX = -9999; mouseY = -9999; }

    card.addEventListener('pointermove', onMove, { passive: true });
    card.addEventListener('pointerenter', onMove, { passive: true });
    card.addEventListener('pointerleave', onLeave, { passive: true });

    var ro = new ResizeObserver(resize);
    ro.observe(card);
    resize();

    function frame(now) {
      if (!active) return;
      var dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;

      var k = 1 - Math.exp(-8 * dt);
      if (mouseX > -1000) {
        if (dampedX < -1000) { dampedX = mouseX; dampedY = mouseY; }
        dampedX += (mouseX - dampedX) * k;
        dampedY += (mouseY - dampedY) * k;
      } else {
        dampedX = -9999;
        dampedY = -9999;
      }

      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

      gl.uniform2f(uMouse, dampedX, dampedY);
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform1f(uPixelRatio, dpr);
      var selected = card.classList.contains("selected");
      // When selected, drive the reveal position along a slow orbit so the
      // border visibly drifts — the user sees the card is active without
      // the card itself moving.
      if (selected) {
        var nowSec = now / 1000;
        var cssW = canvas.width / dpr;
        var cssH = canvas.height / dpr;
        var cx = cssW / 2, cy = cssH / 2;
        var rx = cssW * 0.42;
        var ry = cssH * 0.32;
        dampedX = cx + Math.sin(nowSec * 0.65) * rx;
        dampedY = cy + Math.cos(nowSec * 1.05) * ry;
      }
      gl.uniform2f(uShapeSize, sizeX, sizeY);
      gl.uniform1f(uRoundness, 0.25);
      // Selected border is much thicker and much brighter than the
      // hover reveal — this is the primary visual cue that a card is active.
      // Selected: keep the border thin so the CSS fill underneath is
      // visible. The reveal circle is huge so the WHOLE ring lights up.
      gl.uniform1f(uBorderSize, selected ? 0.30 : 0.18);
      gl.uniform1f(uCircleSize, selected ? 5.0 : 0.1);
      gl.uniform1f(uCircleEdge, selected ? 0.05 : 0.7);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      canvas.style.mixBlendMode = "normal";
      canvas.style.background = "transparent";
      // Ensure the shader sits cleanly over the CSS fill underneath
      canvas.style.mixBlendMode = "normal";
      canvas.style.background = "transparent";
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return function cleanup() {
      active = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      themeObs.disconnect();
      card.removeEventListener('pointermove', onMove);
      card.removeEventListener('pointerenter', onMove);
      card.removeEventListener('pointerleave', onLeave);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      try { gl.deleteBuffer(buffer); } catch(e) {}
      try { gl.deleteProgram(program); } catch(e) {}
      try { gl.deleteShader(vs); } catch(e) {}
      try { gl.deleteShader(fs); } catch(e) {}
      try {
        var lose = gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
      } catch(e) {}
    };
  }

  function reconcile() {
    for (var pair of Array.from(mounted.entries())) {
      if (!pair[0].isConnected) {
        try { pair[1](); } catch(e) {}
        mounted.delete(pair[0]);
      }
    }
    var cards = document.querySelectorAll('#wizardSection .wizard-choice');
    cards.forEach(function(card) {
      if (mounted.has(card)) return;
      var cleanup = mountCard(card);
      if (cleanup) mounted.set(card, cleanup);
    });
  }

  setInterval(reconcile, 400);
  reconcile();

  console.log('[KEFE] ShapeBlur port active — border traces card edges');
})();
