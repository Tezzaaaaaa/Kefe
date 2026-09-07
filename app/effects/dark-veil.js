/* KEFE Visualiser — Dark Veil intro background.
   Native WebGL conversion of the supplied Svelte Bits Dark Veil.
   No Svelte or OGL dependency. */
(() => {
  'use strict';

  const VERTEX = `
    attribute vec2 position;
    void main() {
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  const FRAGMENT = `
    precision highp float;

    uniform vec2 uResolution;
    uniform float uTime;
    uniform float uHueShift;
    uniform float uNoise;
    uniform float uScan;
    uniform float uScanFreq;
    uniform float uWarp;

    #define iTime uTime

    mat2 rot(float a) {
      float s = sin(a);
      float c = cos(a);
      return mat2(c, -s, s, c);
    }

    vec3 hsv2rgb(vec3 c) {
      vec3 rgb = clamp(
        abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0,
        0.0,
        1.0
      );
      rgb = rgb * rgb * (3.0 - 2.0 * rgb);
      return c.z * mix(vec3(1.0), rgb, c.y);
    }

    vec3 palette(float t) {
      vec3 a = vec3(0.08, 0.08, 0.10);
      vec3 b = vec3(0.42, 0.12, 0.20);
      vec3 c = vec3(0.18, 0.34, 0.62);
      vec3 d = vec3(0.85, 0.35, 0.15);
      return a + b * cos(6.28318 * (c * t + d));
    }

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);

      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));

      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    float fbm(vec2 p) {
      float value = 0.0;
      float amplitude = 0.5;

      for (int i = 0; i < 5; i++) {
        value += amplitude * noise(p);
        p = p * 2.0 + vec2(17.1, 9.2);
        amplitude *= 0.5;
      }

      return value;
    }

    vec3 darkVeil(vec2 uv) {
      vec2 p = uv * 2.0 - 1.0;
      p.x *= uResolution.x / max(uResolution.y, 1.0);

      float t = iTime * 0.18;

      p += 0.035 * vec2(
        sin(p.y * 4.0 + t),
        cos(p.x * 3.0 - t)
      );

      if (uWarp > 0.001) {
        float r = length(p);
        p *= 1.0 + uWarp * 0.16 * r * r;
        p = rot(sin(t * 0.7) * uWarp * 0.04) * p;
      }

      float cloudA = fbm(p * 1.15 + vec2(t * 0.20, -t * 0.11));
      float cloudB = fbm(p * 2.2 - vec2(t * 0.13, t * 0.17));

      float field = mix(cloudA, cloudB, 0.42);
      field = smoothstep(0.20, 0.82, field);

      vec3 colour = palette(field + t * 0.025);

      float centre = 1.0 - smoothstep(0.05, 1.45, length(p));
      colour += vec3(0.06, 0.025, 0.02) * centre;

      float hue = uHueShift * 0.0174532925;
      float s = sin(hue);
      float c = cos(hue);

      mat3 hueMatrix = mat3(
        0.299 + 0.701 * c + 0.168 * s,
        0.587 - 0.587 * c + 0.330 * s,
        0.114 - 0.114 * c - 0.497 * s,

        0.299 - 0.299 * c - 0.328 * s,
        0.587 + 0.413 * c + 0.035 * s,
        0.114 - 0.114 * c + 0.292 * s,

        0.299 - 0.300 * c + 1.250 * s,
        0.587 - 0.588 * c - 1.050 * s,
        0.114 + 0.886 * c - 0.203 * s
      );

      colour = hueMatrix * colour;

      if (uNoise > 0.001) {
        float grain = hash(gl_FragCoord.xy + iTime * 17.0) - 0.5;
        colour += grain * uNoise * 0.12;
      }

      if (uScan > 0.001) {
        float scan = sin(uv.y * uScanFreq * 6.28318);
        colour *= 1.0 - max(scan, 0.0) * uScan * 0.08;
      }

      float vignette = smoothstep(1.55, 0.35, length(p));
      colour *= 0.55 + 0.45 * vignette;

      return max(colour, 0.0);
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / uResolution;
      vec3 colour = darkVeil(uv);

      float alpha = clamp(max(colour.r, max(colour.g, colour.b)), 0.0, 1.0);
      alpha *= 0.82;

      gl_FragColor = vec4(colour, alpha);
    }
  `;

  const DEFAULTS = {
    hueShift: 0,
    noiseIntensity: 0,
    scanlineIntensity: 0,
    speed: 0.5,
    scanlineFrequency: 0,
    warpAmount: 0,
    resolutionScale: 1
  };

  let canvas = null;
  let gl = null;
  let program = null;
  let buffer = null;
  let raf = 0;
  let container = null;
  let settings = { ...DEFAULTS };
  let startTime = 0;
  let destroyed = false;

  const compileShader = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('KEFE Dark Veil shader error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  };

  const createProgram = () => {
    const vertex = compileShader(gl.VERTEX_SHADER, VERTEX);
    const fragment = compileShader(gl.FRAGMENT_SHADER, FRAGMENT);

    if (!vertex || !fragment) return null;

    const next = gl.createProgram();
    gl.attachShader(next, vertex);
    gl.attachShader(next, fragment);
    gl.linkProgram(next);

    gl.deleteShader(vertex);
    gl.deleteShader(fragment);

    if (!gl.getProgramParameter(next, gl.LINK_STATUS)) {
      console.error('KEFE Dark Veil program error:', gl.getProgramInfoLog(next));
      gl.deleteProgram(next);
      return null;
    }

    return next;
  };

  const resize = () => {
    if (!canvas || !gl || !container) return;

    const rect = container.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const scale = Math.max(0.5, Math.min(1.5, Number(settings.resolutionScale) || 1));
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * scale;

    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    gl.viewport(0, 0, canvas.width, canvas.height);

    const resolution = gl.getUniformLocation(program, 'uResolution');
    gl.useProgram(program);
    gl.uniform2f(resolution, canvas.width, canvas.height);
  };

  const render = () => {
    if (destroyed || !gl || !program || !canvas) return;

    const elapsed = (performance.now() - startTime) / 1000;
    const time = elapsed * settings.speed;

    gl.useProgram(program);

    gl.uniform1f(gl.getUniformLocation(program, 'uTime'), time);
    gl.uniform1f(gl.getUniformLocation(program, 'uHueShift'), settings.hueShift);
    gl.uniform1f(gl.getUniformLocation(program, 'uNoise'), settings.noiseIntensity);
    gl.uniform1f(gl.getUniformLocation(program, 'uScan'), settings.scanlineIntensity);
    gl.uniform1f(gl.getUniformLocation(program, 'uScanFreq'), settings.scanlineFrequency);
    gl.uniform1f(gl.getUniformLocation(program, 'uWarp'), settings.warpAmount);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    raf = requestAnimationFrame(render);
  };

  const mount = (target, options = {}) => {
    destroy();

    if (!target) return false;

    container = target;
    settings = { ...DEFAULTS, ...options };
    destroyed = false;

    canvas = document.createElement('canvas');
    canvas.className = 'kefe-dark-veil';
    canvas.setAttribute('aria-hidden', 'true');

    gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: true
    });

    if (!gl) {
      canvas.remove();
      canvas = null;
      container = null;
      gl = null;
      return false;
    }

    program = createProgram();

    if (!program) {
      canvas.remove();
      canvas = null;
      container = null;
      gl = null;
      return false;
    }

    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
         1,  1
      ]),
      gl.STATIC_DRAW
    );

    container.prepend(canvas);
    resize();

    startTime = performance.now();
    raf = requestAnimationFrame(render);

    window.addEventListener('resize', resize, { passive: true });

    return true;
  };

  const destroy = () => {
    destroyed = true;

    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }

    window.removeEventListener('resize', resize);

    if (gl) {
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
    }

    if (canvas) canvas.remove();

    canvas = null;
    gl = null;
    program = null;
    buffer = null;
    container = null;
  };

  window.KefeDarkVeil = {
    defaults: { ...DEFAULTS },
    mount,
    destroy
  };
})();
