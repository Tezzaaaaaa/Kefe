/*
 * KEFE Apple Lyrics Engine
 * Vanilla ES Module — audio.currentTime is the single source of playback truth.
 *
 * Usage:
 *   const engine = new AppleLyricsEngine({
 *     root: document.querySelector('#apple-lyrics'),
 *     audio: document.querySelector('#player')
 *   });
 *
 *   engine.loadTrack({
 *     title: 'Song',
 *     artist: 'Artist',
 *     coverUrl: '/covers/song.jpg',
 *     ttmlLyrics: '<ttml>...</ttml>'
 *   });
 *
 *   // On teardown:
 *   engine.destroy();
 */

const DEFAULT_VERTEX = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = (a_position + 1.0) * 0.5;
  v_uv.y = 1.0 - v_uv.y;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const DEFAULT_FRAGMENT = `
precision mediump float;

uniform sampler2D u_texture;
uniform float u_time;
varying vec2 v_uv;

vec2 twist(vec2 uv, vec2 center, float radius, float angle) {
  vec2 d = uv - center;
  float dist = length(d);

  if (dist < radius) {
    float percent = (radius - dist) / radius;
    float theta = percent * percent * angle;
    float s = sin(theta);
    float c = cos(theta);
    d = vec2(
      d.x * c - d.y * s,
      d.x * s + d.y * c
    );
  }

  return center + d;
}

void main() {
  vec2 center = vec2(
    0.5 + 0.15 * sin(u_time * 0.4),
    0.5 + 0.15 * cos(u_time * 0.3)
  );

  vec2 uv = twist(
    v_uv,
    center,
    0.7,
    2.0 * sin(u_time * 0.5)
  );

  vec4 color = texture2D(u_texture, uv);
  gl_FragColor = vec4(color.rgb * 1.2, 1.0);
}
`;

const FALLBACK_COVER = `
data:image/svg+xml;charset=utf-8,
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<defs>
  <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop stop-color="#e11d48"/>
    <stop offset=".5" stop-color="#7c3aed"/>
    <stop offset="1" stop-color="#2563eb"/>
  </linearGradient>
</defs>
<rect width="200" height="200" fill="url(#g)"/>
<circle cx="100" cy="100" r="45" fill="white"/>
</svg>
`.replace(/\n/g, '');

const clamp = (value, min = 0, max = 1) =>
  Math.max(min, Math.min(max, value));

const smooth = value => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function parseTime(value) {
  if (value == null) return 0;
  if (typeof value === 'number') return value;

  const raw = String(value).trim();
  if (/^\d+(\.\d+)?$/.test(raw)) return Number(raw);

  const parts = raw.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

function firstAttribute(element, names) {
  for (const name of names) {
    const value = element.getAttribute(name);
    if (value != null) return value;
  }
  return null;
}

/**
 * Accepts common TTML timing forms:
 * <p begin="1.2s" end="3.2s">Hello <span begin="1.2s" end="1.7s">Hello</span></p>
 * and also supports data-start/data-end and numeric seconds.
 */
function parseTtml(ttml) {
  if (Array.isArray(ttml)) {
    return normaliseLines(ttml);
  }

  if (!ttml || typeof ttml !== 'string') return [];

  const xml = new DOMParser().parseFromString(ttml, 'application/xml');
  if (xml.querySelector('parsererror')) {
    throw new Error('Invalid TTML/XML lyrics.');
  }

  const paragraphs = [...xml.querySelectorAll('p')];

  return normaliseLines(
    paragraphs.map((p, index) => {
      const startRaw = firstAttribute(p, ['begin', 'start', 'data-start']);
      const endRaw = firstAttribute(p, ['end', 'data-end']);

      const spans = [...p.querySelectorAll('span')];
      const words = spans
        .map(span => ({
          text: span.textContent || '',
          start: parseTime(firstAttribute(span, ['begin', 'start', 'data-start'])),
          end: parseTime(firstAttribute(span, ['end', 'data-end']))
        }))
        .filter(word => word.text.trim());

      const fallbackStart = words.length ? Math.min(...words.map(w => w.start)) : 0;
      const fallbackEnd = words.length ? Math.max(...words.map(w => w.end)) : fallbackStart + 2;

      return {
        id: p.getAttribute('xml:id') || p.id || `line-${index}`,
        start: startRaw == null ? fallbackStart : parseTime(startRaw),
        end: endRaw == null ? fallbackEnd : parseTime(endRaw),
        words,
        text: p.textContent?.trim() || ''
      };
    })
  );
}

function normaliseLines(lines) {
  const clean = (lines || [])
    .map((line, index) => {
      const words = Array.isArray(line.words)
        ? line.words.map(word => ({
            text: String(word.text ?? ''),
            start: Number(word.start ?? word.begin ?? 0),
            end: Number(word.end ?? word.finish ?? 0)
          })).filter(word => word.text)
        : [];

      const start = Number(line.start ?? line.begin ?? (words[0]?.start ?? 0));
      const end = Number(
        line.end ??
        line.finish ??
        (words.at(-1)?.end ?? start + 2)
      );

      return {
        id: line.id ?? `line-${index}`,
        start: Number.isFinite(start) ? start : 0,
        end: Number.isFinite(end) ? end : start + 2,
        text: String(line.text ?? words.map(w => w.text).join('')).trim(),
        words
      };
    })
    .sort((a, b) => a.start - b.start);

  return clean.map((line, index) => {
    const next = clean[index + 1];
    if (!line.words.length) {
      line.words = estimateWords(line, next);
    }
    if (!(line.end > line.start)) {
      line.end = next?.start > line.start ? next.start : line.start + 2;
    }
    return line;
  });
}

function estimateWords(line, nextLine) {
  const text = line.text.trim();
  if (!text) return [];

  const tokens = text.match(/\S+\s*/g) || [];
  const duration = Math.max(
    0.05,
    (nextLine?.start ?? line.end ?? line.start + 2) - line.start
  );

  const weights = tokens.map(token => {
    const letters = [...token.trim()].filter(char => /[\p{L}\p{N}]/u.test(char)).length || 1;
    const punctuation = /[,.!?;:]$/.test(token.trim()) ? 0.2 : 0;
    return Math.max(0.75, Math.pow(letters, 0.72)) + punctuation;
  });

  const total = weights.reduce((sum, weight) => sum + weight, 0) || tokens.length;
  let cursor = 0;

  return tokens.map((textToken, index) => {
    const start = line.start + duration * (cursor / total);
    cursor += weights[index];
    const end = line.start + duration * (cursor / total);
    return {
      text: textToken,
      start,
      end: Math.max(start + 0.05, end)
    };
  });
}

class Spring {
  constructor(stiffness = 120, damping = 16) {
    this.stiffness = stiffness;
    this.damping = damping;
    this.current = 0;
    this.target = 0;
    this.velocity = 0;
  }

  reset(value = 0) {
    this.current = value;
    this.target = value;
    this.velocity = 0;
  }

  update(dt) {
    const force = -this.stiffness * (this.current - this.target);
    const dampingForce = -this.damping * this.velocity;

    this.velocity += (force + dampingForce) * dt;
    this.current += this.velocity * dt;

    return this.current;
  }
}

export class AppleLyricsEngine {
  constructor({
    root,
    audio,
    stiffness = 120,
    damping = 16,
    vertexShader = DEFAULT_VERTEX,
    fragmentShader = DEFAULT_FRAGMENT
  }) {
    if (!root) throw new Error('AppleLyricsEngine: root is required.');
    if (!audio) throw new Error('AppleLyricsEngine: audio is required.');

    this.root = root;
    this.audio = audio;
    this.vertexShaderSource = vertexShader;
    this.fragmentShaderSource = fragmentShader;

    this.lines = [];
    this.lineElements = [];
    this.track = null;
    this.destroyed = false;
    this.raf = 0;
    this.lastFrame = performance.now();

    this.spring = new Spring(stiffness, damping);

    this.root.innerHTML = `
      <canvas class="kefe-apple__webgl"></canvas>

      <header class="kefe-apple__header">
        <img class="kefe-apple__album-art" alt="">
        <div class="kefe-apple__track-info">
          <div class="kefe-apple__title"></div>
          <div class="kefe-apple__artist"></div>
        </div>
      </header>

      <div class="kefe-apple__lyrics-viewport">
        <div class="kefe-apple__lyrics-stage"></div>
      </div>
    `;

    this.webglCanvas = this.root.querySelector('.kefe-apple__webgl');
    this.stage = this.root.querySelector('.kefe-apple__lyrics-stage');
    this.albumImage = this.root.querySelector('.kefe-apple__album-art');
    this.titleElement = this.root.querySelector('.kefe-apple__title');
    this.artistElement = this.root.querySelector('.kefe-apple__artist');

    this.gl = this.webglCanvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false
    });

    if (!this.gl) {
      throw new Error('AppleLyricsEngine: WebGL is not available.');
    }

    this.#initWebGL();
    this.#bindEvents();

    this.#frame = this.#frame.bind(this);
    this.raf = requestAnimationFrame(this.#frame);
  }

  #initWebGL() {
    const gl = this.gl;

    this.vertexShader = this.#createShader(
      gl.VERTEX_SHADER,
      this.vertexShaderSource
    );

    this.fragmentShader = this.#createShader(
      gl.FRAGMENT_SHADER,
      this.fragmentShaderSource
    );

    this.program = gl.createProgram();
    gl.attachShader(this.program, this.vertexShader);
    gl.attachShader(this.program, this.fragmentShader);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(this.program);
      this.#destroyWebGL();
      throw new Error(`AppleLyricsEngine: WebGL program failed: ${log}`);
    }

    gl.useProgram(this.program);

    this.positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1, -1, 1, -1, -1, 1,
        -1, 1, 1, -1, 1, 1
      ]),
      gl.STATIC_DRAW
    );

    this.positionLocation = gl.getAttribLocation(
      this.program,
      'a_position'
    );

    gl.enableVertexAttribArray(this.positionLocation);
    gl.vertexAttribPointer(
      this.positionLocation,
      2,
      gl.FLOAT,
      false,
      0,
      0
    );

    this.timeLocation = gl.getUniformLocation(this.program, 'u_time');
    this.textureLocation = gl.getUniformLocation(this.program, 'u_texture');

    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // 1x1 fallback until a track cover loads.
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([20, 20, 24, 255])
    );
  }

  #createShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`AppleLyricsEngine: shader compile failed: ${log}`);
    }

    return shader;
  }

  #bindEvents() {
    this.onAudioTimeUpdate = () => this.#syncUI();
    this.onAudioLoadedMetadata = () => this.#syncDuration();
    this.onAudioDurationChange = () => this.#syncDuration();
    this.onAudioSeeked = () => this.#syncUI();

    this.audio.addEventListener('timeupdate', this.onAudioTimeUpdate);
    this.audio.addEventListener('loadedmetadata', this.onAudioLoadedMetadata);
    this.audio.addEventListener('durationchange', this.onAudioDurationChange);
    this.audio.addEventListener('seeked', this.onAudioSeeked);
  }

  #unbindEvents() {
    this.audio.removeEventListener('timeupdate', this.onAudioTimeUpdate);
    this.audio.removeEventListener('loadedmetadata', this.onAudioLoadedMetadata);
    this.audio.removeEventListener('durationchange', this.onAudioDurationChange);
    this.audio.removeEventListener('seeked', this.onAudioSeeked);
  }

  /**
   * Reusable track loader.
   */
  async loadTrack(trackData = {}) {
    if (this.destroyed) throw new Error('AppleLyricsEngine has been destroyed.');

    const {
      title = '',
      artist = '',
      coverUrl = '',
      ttmlLyrics = ''
    } = trackData;

    this.track = { title, artist, coverUrl, ttmlLyrics };

    // Stop inheriting state from the previous track.
    this.audio.pause();
    this.#clearLyrics();
    this.spring.reset(0);

    this.titleElement.textContent = title;
    this.artistElement.textContent = artist;

    const cover = coverUrl || FALLBACK_COVER;
    this.albumImage.src = cover;
    this.albumImage.alt = title ? `${title} album artwork` : 'Album artwork';

    await this.#updateWebGLTexture(cover);

    if (this.destroyed) return;

    const parsed = parseTtml(ttmlLyrics);
    this.lines = normaliseLines(parsed);

    this.#buildLyricsDOM();
    this.#syncDuration();
    this.#syncUI();
  }

  async #updateWebGLTexture(url) {
    const image = new Image();
    image.crossOrigin = 'anonymous';

    const loaded = new Promise(resolve => {
      image.onload = () => resolve(true);
      image.onerror = () => resolve(false);
    });

    image.src = url;

    if (image.decode) {
      try {
        await image.decode();
      } catch {
        await loaded;
      }
    } else {
      await loaded;
    }

    if (this.destroyed || !this.gl || !this.texture || !image.complete) return;

    const gl = this.gl;

    gl.bindTexture(gl.TEXTURE_2D, this.texture);

    try {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        image
      );
    } catch {
      // Keep the previous texture if CORS prevents reading the image.
    } finally {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    }
  }

  #clearLyrics() {
    this.stage.replaceChildren();
    this.lineElements = [];
  }

  #buildLyricsDOM() {
    const fragment = document.createDocumentFragment();

    this.lineElements = this.lines.map((lineData, index) => {
      const lineElement = document.createElement('button');

      lineElement.type = 'button';
      lineElement.className = 'kefe-apple__lyric-line future';
      lineElement.dataset.index = String(index);
      lineElement.dataset.start = String(lineData.start);
      lineElement.setAttribute('aria-label', `Seek to ${formatTime(lineData.start)}`);

      const words = lineData.words.map(wordData => {
        const wordElement = document.createElement('span');
        wordElement.className = 'kefe-apple__word';
        wordElement.textContent = wordData.text;
        lineElement.appendChild(wordElement);

        return {
          element: wordElement,
          ...wordData
        };
      });

      const onClick = () => {
        this.audio.currentTime = lineData.start;
        this.#syncUI();
      };

      lineElement.addEventListener('click', onClick);

      fragment.appendChild(lineElement);

      return {
        element: lineElement,
        words,
        line: lineData,
        destroy: () => lineElement.removeEventListener('click', onClick)
      };
    });

    this.stage.appendChild(fragment);
    this.spring.reset(this.#initialSpringTarget());
  }

  #initialSpringTarget() {
    const first = this.lineElements[0]?.element;
    if (!first) return 0;

    return window.innerHeight * 0.35 - first.offsetTop;
  }

  #activeLineIndex(currentTime) {
    let active = -1;

    for (let i = 0; i < this.lines.length; i += 1) {
      if (currentTime >= this.lines[i].start) {
        active = i;
      } else {
        break;
      }
    }

    return active;
  }

  #syncUI() {
    if (this.destroyed) return;

    const currentTime = Number.isFinite(this.audio.currentTime)
      ? this.audio.currentTime
      : 0;

    const activeIndex = this.#activeLineIndex(currentTime);

    this.lineElements.forEach((line, index) => {
      const data = line.line;

      line.element.classList.toggle(
        'active',
        index === activeIndex
      );
      line.element.classList.toggle(
        'past',
        activeIndex >= 0 && index < activeIndex
      );
      line.element.classList.toggle(
        'future',
        activeIndex < 0 || index > activeIndex
      );

      line.words.forEach(word => {
        if (currentTime < word.start) {
          word.element.style.setProperty('--progress', '0%');
          word.element.classList.remove('active-sweep');
        } else if (currentTime >= word.end) {
          word.element.style.setProperty('--progress', '100%');
          word.element.classList.remove('active-sweep');
        } else {
          const progress =
            ((currentTime - word.start) /
              Math.max(0.001, word.end - word.start)) * 100;

          word.element.style.setProperty(
            '--progress',
            `${clamp(progress, 0, 100)}%`
          );
          word.element.classList.add('active-sweep');
        }
      });
    });

    if (activeIndex >= 0) {
      const activeElement = this.lineElements[activeIndex]?.element;

      if (activeElement) {
        this.spring.target =
          window.innerHeight * 0.35 - activeElement.offsetTop;
      }
    } else if (this.lineElements.length) {
      this.spring.target = this.#initialSpringTarget();
    }
  }

  #syncDuration() {
    const duration = this.audio.duration;

    if (Number.isFinite(duration) && duration > 0) {
      this.root.style.setProperty('--kefe-audio-duration', `${duration}s`);
    }
  }

  #resizeWebGL() {
    const gl = this.gl;
    const canvas = this.webglCanvas;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const height = Math.max(1, Math.round(canvas.clientHeight * dpr));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
  }

  #renderWebGL(timeSeconds) {
    const gl = this.gl;

    this.#resizeWebGL();

    gl.useProgram(this.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(this.textureLocation, 0);
    gl.uniform1f(this.timeLocation, timeSeconds);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  #frame(now) {
    if (this.destroyed) return;

    const dt = Math.min(
      Math.max((now - this.lastFrame) / 1000, 0),
      0.032
    );

    this.lastFrame = now;

    // Audio is authoritative. No interval and no manually incremented timer.
    const audioTime = Number.isFinite(this.audio.currentTime)
      ? this.audio.currentTime
      : 0;

    this.#renderWebGL(now * 0.001);
    this.#syncUI();

    const y = this.spring.update(dt);
    this.stage.style.transform = `translate3d(0, ${y}px, 0)`;

    this.raf = requestAnimationFrame(this.#frame);
  }

  #destroyWebGL() {
    if (!this.gl) return;

    const gl = this.gl;

    if (this.texture) gl.deleteTexture(this.texture);
    if (this.positionBuffer) gl.deleteBuffer(this.positionBuffer);

    if (this.program) gl.deleteProgram(this.program);

    if (this.vertexShader) gl.deleteShader(this.vertexShader);
    if (this.fragmentShader) gl.deleteShader(this.fragmentShader);

    this.texture = null;
    this.positionBuffer = null;
    this.program = null;
    this.vertexShader = null;
    this.fragmentShader = null;
  }

  destroy() {
    if (this.destroyed) return;

    this.destroyed = true;

    cancelAnimationFrame(this.raf);
    this.#unbindEvents();

    for (const line of this.lineElements) {
      line.destroy?.();
    }

    this.lineElements = [];
    this.lines = [];

    this.#destroyWebGL();
    this.root.replaceChildren();

    this.track = null;
  }
}

export { parseTtml, normaliseLines };
