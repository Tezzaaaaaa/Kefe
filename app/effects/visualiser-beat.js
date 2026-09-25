/* KEFE — audio-reactive visualiser effects.
   Reads analysis data from analysis-engine.js (window event
   'kefe:audio-analysis-ready') and draws reactive visuals into the
   main canvas during both preview and export.

   Determinism contract: every renderer receives an absolute timestamp
   derived from the master timeline. No renderer is allowed to read
   live audio, wall clock or randomness during export. The dispatcher
   enforces this by:
     - never calling sampleLive() during an export frame
     - passing time to every visualiser
     - forwarding a hard reset signal on backwards time jumps

   Modes are selected via state.style.visualiserStyle:
     ra            — 3D sphere of glowing metal spikes
     tuffpuff      — WebGL2 fluid simulation
     ridgeline     — perspective waveform stack
     butterchurn   — Milkdrop presets via butterchurn
     matrixmusic   — Matrix Music Visualizer presets
     audioreactive — audio-reactive shader pack
     pulse         — soft radial glow (legacy fallback)
     spectrum      — three reactive bars (legacy fallback)
     waveform      — horizontal wave line (legacy fallback)
     radial        — slow-rotating glow (legacy fallback)
*/
(function(){
  'use strict';
  if (window.kefeVisualiser) return;

  var analysis = null;
  var maxima = { energy: 1, bass: 1, mids: 1, treble: 1, flux: 1 };

  /* Export lockout: while true, sampleLive() is never used. The export
     pipeline should call setExportMode(true) before the first frame and
     setExportMode(false) after the last one. Preview is unaffected. */
  var exporting = false;
  function setExportMode(on) {
    exporting = !!on;
    if (exporting) resetAllRenderers();
  }
  function isExporting() { return exporting; }

  /* Track the last timestamp we rendered at. Used to detect backward
     time jumps so every stateful visualiser can hard-reset. */
  var lastDispatchedTime = -1;
  function resetAllRenderers() {
    try { window.kefeRidgeline && window.kefeRidgeline.refresh && window.kefeRidgeline.refresh(); } catch (_) {}
    try { window.kefeTuffPuff && window.kefeTuffPuff.refresh && window.kefeTuffPuff.refresh(); } catch (_) {}
    try { window.kefeMatrixVisualiser && window.kefeMatrixVisualiser.reset && window.kefeMatrixVisualiser.reset(); } catch (_) {}
    try { window.kefeAudioReactiveShaders && window.kefeAudioReactiveShaders.reset && window.kefeAudioReactiveShaders.reset(); } catch (_) {}
    try { window.kefeButterchurn && window.kefeButterchurn.reset && window.kefeButterchurn.reset(); } catch (_) {}
    resetRa();
    lastDispatchedTime = -1;
  }

  function ingest(data) {
    if (!data || !Array.isArray(data.energy) || !data.energy.length) return;
    analysis = data;
    var maxE = 0, maxB = 0, maxM = 0, maxT = 0, maxF = 0;
    for (var i = 0; i < data.energy.length; i++) {
      var e = data.energy[i];
      if (e > maxE) maxE = e;
      var b = data.bands && data.bands[i];
      if (b) {
        if (b.bass > maxB) maxB = b.bass;
        if (b.mids > maxM) maxM = b.mids;
        if (b.treble > maxT) maxT = b.treble;
      }
      var f = data.flux && data.flux[i];
      if (f > maxF) maxF = f;
    }
    maxima.energy = maxE || 1;
    maxima.bass = maxB || 1;
    maxima.mids = maxM || 1;
    maxima.treble = maxT || 1;
    maxima.flux = maxF || 1;
  }

  window.addEventListener('kefe:audio-analysis-ready', function(e){ ingest(e.detail); });

  var live = { audio: null, context: null, source: null, analyser: null, freq: null, wave: null };

  function ensureLiveAudio(audio) {
    if (!audio) return null;
    var AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    try {
      if (!live.context) live.context = new AudioCtx();
      if (!live.source || live.audio !== audio) {
        if (live.source) { try { live.source.disconnect(); } catch (_) {} }
        live.source = live.context.createMediaElementSource(audio);
        live.analyser = live.context.createAnalyser();
        live.analyser.fftSize = 256;
        live.analyser.smoothingTimeConstant = 0.72;
        live.source.connect(live.analyser);
        live.analyser.connect(live.context.destination);
        live.freq = new Uint8Array(live.analyser.frequencyBinCount);
        live.wave = new Uint8Array(live.analyser.fftSize);
        live.audio = audio;
      }
      if (live.context.state === 'suspended') live.context.resume().catch(function(){});
      return live.analyser;
    } catch (e) {
      return null;
    }
  }

  function sampleLive(audio) {
    if (exporting) return null;
    var analyser = ensureLiveAudio(audio);
    if (!analyser || !live.freq || !live.wave) return null;
    analyser.getByteFrequencyData(live.freq);
    analyser.getByteTimeDomainData(live.wave);
    var n = live.freq.length;
    if (!n) return null;
    var bassEnd = Math.max(1, Math.floor(n * 0.18));
    var midEnd = Math.max(bassEnd + 1, Math.floor(n * 0.62));
    var bass = 0, mids = 0, treble = 0;
    for (var i = 0; i < n; i++) {
      var value = live.freq[i] / 255;
      if (i < bassEnd) bass += value;
      else if (i < midEnd) mids += value;
      else treble += value;
    }
    bass /= bassEnd;
    mids /= Math.max(1, midEnd - bassEnd);
    treble /= Math.max(1, n - midEnd);
    var rms = 0;
    for (var j = 0; j < live.wave.length; j++) {
      var centered = (live.wave[j] - 128) / 128;
      rms += centered * centered;
    }
    rms = Math.sqrt(rms / live.wave.length);
    return {
      energy: Math.min(1, rms * 3.2),
      bass: Math.min(1, bass * 1.8),
      mids: Math.min(1, mids * 1.6),
      treble: Math.min(1, treble * 1.8)
    };
  }

  function sample(time, source) {
    source = source || analysis;
    if (!source || !source.frameHopMs) return null;
    if (!Array.isArray(source.energy) || !source.energy.length) return null;
    var hop = source.frameHopMs / 1000;
    var idx = Math.max(0, Math.min(source.energy.length - 1, Math.floor(time / hop)));
    var sum = 0, sumB = 0, sumM = 0, sumT = 0, n = 0;
    for (var k = -1; k <= 1; k++) {
      var i2 = idx + k;
      if (i2 < 0 || i2 >= source.energy.length) continue;
      sum += source.energy[i2] || 0;
      var b = source.bands && source.bands[i2];
      if (b) {
        sumB += b.bass || 0;
        sumM += b.mids || 0;
        sumT += b.treble || 0;
      }
      n++;
    }
    if (!n) return null;
    return {
      energy: Math.min(1, (sum / n) / maxima.energy),
      bass:   Math.min(1, (sumB / n) / maxima.bass),
      mids:   Math.min(1, (sumM / n) / maxima.mids),
      treble: Math.min(1, (sumT / n) / maxima.treble)
    };
  }

  /* ---------- Legacy lightweight modes (kept as fallbacks) ---------- */

  function drawPulse(ctx, w, h, time, frame) {
    var intensity = frame ? frame.bass * 0.6 + frame.energy * 0.4 : 0;
    var cx = w / 2, cy = h / 2;
    var radius = Math.min(w, h) * (0.25 + intensity * 0.35);
    var grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    var alpha = 0.12 + intensity * 0.32;
    grad.addColorStop(0, 'rgba(255,255,255,' + alpha.toFixed(3) + ')');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  function drawSpectrum(ctx, w, h, time, frame) {
    if (!frame) return;
    var bands = [frame.bass, frame.mids, frame.treble];
    var pad = w * 0.08;
    var barW = (w - pad * 2 - 30) / 3;
    var barH = h * 0.20;
    var baseY = h - pad - barH;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (var i = 0; i < 3; i++) {
      var x = pad + i * (barW + 15);
      var filled = barH * Math.min(1, bands[i] * 1.3);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(x, baseY, barW, barH);
      var grad = ctx.createLinearGradient(0, baseY + barH, 0, baseY);
      grad.addColorStop(0, 'rgba(255,255,255,0.05)');
      grad.addColorStop(1, 'rgba(255,255,255,0.85)');
      ctx.fillStyle = grad;
      ctx.fillRect(x, baseY + barH - filled, barW, filled);
    }
    ctx.restore();
  }

  function drawWaveform(ctx, w, h, time, frame) {
    if (!analysis || !analysis.energy) return;
    var y = h / 2;
    var amp = h * 0.12;
    var samples = 200;
    var hop = analysis.frameHopMs / 1000;
    var startIdx = Math.floor(time / hop);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = Math.max(2, h * 0.003);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (var i = 0; i < samples; i++) {
      var idx = startIdx + i;
      var e = analysis.energy[idx]; if (e === undefined) e = 0;
      var norm = Math.min(1, e / maxima.energy);
      var dev = (norm * 2 - 1) * amp;
      var x = (i / (samples - 1)) * w;
      var yy = y + dev;
      if (i === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawRadial(ctx, w, h, time, frame) {
    if (!frame) return;
    var cx = w / 2, cy = h / 2;
    var intensity = frame.energy;
    var radius = Math.min(w, h) * (0.30 + intensity * 0.15);
    var grad = ctx.createRadialGradient(cx, cy, radius * 0.15, cx, cy, radius * 1.8);
    var alpha = 0.08 + intensity * 0.30;
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, 'rgba(255,255,255,' + (alpha * 0.6).toFixed(3) + ')');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.translate(cx, cy);
    ctx.rotate(time * 0.35);
    ctx.translate(-cx, -cy);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  /* ============================================================
     RA — 3D sphere of glowing metal spikes.
     Deterministic: seeded RNG, fixed timestep driven from absolute
     time, hard reset on backward time jumps. Same time → same frame.
     ============================================================ */
  var ra = {
    renderer: null, scene: null, camera: null,
    meshes: [], rods: [],
    glCanvas: null,
    width: 0, height: 0,
    driftClock: 0, spinClock: 0,
    lastTime: -1,
    ready: false,
    kickEnv: 0, vocalEnv: 0, transientEnv: 0, energyEnv: 0, bassEnv: 0,
    spread: undefined,
    centreLight: null,
    FIXED_DT: 1 / 60,
    rngState: 0x1a2b3c4d
  };

  function raSeed(s) { ra.rngState = (s >>> 0) || 1; }
  function raRng() {
    ra.rngState = (ra.rngState + 0x6D2B79F5) >>> 0;
    var t = ra.rngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  var RA_RAMP = [
    [1.00, 0.98, 0.78],
    [1.00, 0.92, 0.55],
    [1.00, 0.84, 0.32],
    [1.00, 0.72, 0.22],
    [0.92, 0.56, 0.14],
    [0.72, 0.38, 0.10],
    [0.48, 0.24, 0.06]
  ];

  var _raDummy = null;
  var _raXAxis = null;
  var _raTempV = null;
  var _raTempQ = null;
  var _raTempQ2 = null;

  function resetRa() {
    ra.lastTime = -1;
    ra.driftClock = 0;
    ra.spinClock = 0;
    ra.kickEnv = 0;
    ra.vocalEnv = 0;
    ra.transientEnv = 0;
    ra.energyEnv = 0;
    ra.bassEnv = 0;
    raSeed(0x1a2b3c4d);
    for (var i = 0; i < ra.rods.length; i++) {
      ra.rods[i].spin = raRng() * Math.PI * 2;
      ra.rods[i].spinSpeed = 0.10 + raRng() * 0.20;
      ra.rods[i].flare = 0;
      ra.rods[i].shot = 0;
    }
  }

  function raInit(w, h){
    if (typeof THREE === 'undefined') {
      console.warn('[KEFE visualiser] Three.js not loaded — Ra disabled');
      return false;
    }

    if (!_raDummy) {
      _raDummy = new THREE.Object3D();
      _raXAxis = new THREE.Vector3(1, 0, 0);
      _raTempV = new THREE.Vector3();
      _raTempQ = new THREE.Quaternion();
      _raTempQ2 = new THREE.Quaternion();
    }

    if (ra.renderer) {
      try { ra.renderer.dispose(); } catch (_) {}
      ra.renderer = null;
    }

    ra.glCanvas = document.createElement('canvas');
    ra.glCanvas.width = w;
    ra.glCanvas.height = h;

    ra.renderer = new THREE.WebGLRenderer({
      canvas: ra.glCanvas,
      antialias: true, alpha: true, premultipliedAlpha: true,
      powerPreference: 'high-performance'
    });
    ra.renderer.setPixelRatio(1);
    ra.renderer.setSize(w, h, false);
    ra.renderer.setClearColor(0x000000, 0);

    ra.scene = new THREE.Scene();
    ra.camera = new THREE.PerspectiveCamera(35, w/h, 1, 200);
    ra.camera.position.set(0, 0, 22);
    ra.camera.lookAt(0, 0, 0);

    ra.scene.add(new THREE.AmbientLight(0x2a1408, 1.1));
    var key = new THREE.DirectionalLight(0xffe8b0, 1.35); key.position.set(6, 7, 9); ra.scene.add(key);
    var rim = new THREE.DirectionalLight(0xff7a28, 0.75); rim.position.set(-7, -5, -8); ra.scene.add(rim);
    var centre = new THREE.PointLight(0xffffff, 1.6, 26); centre.position.set(0, 0, 0); ra.scene.add(centre);
    ra.centreLight = centre;

    var rodGeom = new THREE.CylinderGeometry(0.02, 1.0, 1.0, 7, 1, false);
    rodGeom.rotateZ(-Math.PI/2);

    var shells = 7;
    var golden = Math.PI * (3 - Math.sqrt(5));
    var perShell = [70, 110, 150, 190, 220, 240, 260];
    var meshes = [];

    for (var sh = 0; sh < shells; sh++){
      var ramp = RA_RAMP[sh];
      var mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(ramp[0], ramp[1], ramp[2]),
        emissive: new THREE.Color(ramp[0]*0.15, ramp[1]*0.08, ramp[2]*0.03),
        metalness: 1.0,
        roughness: 0.22,
        side: THREE.DoubleSide
      });
      var m = new THREE.InstancedMesh(rodGeom, mat, perShell[sh]);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(perShell[sh]*3), 3);
      m.instanceColor.setUsage(THREE.DynamicDrawUsage);
      ra.scene.add(m);
      meshes.push(m);
    }
    ra.meshes = meshes;

    ra.rods.length = 0;
    raSeed(0x1a2b3c4d);
    for (var sh = 0; sh < shells; sh++){
      var lT = sh / (shells - 1);
      var shellR = (0.6 + 2.2 * lT);
      var quietLen = (1.4 - 0.5 * lT);
      var n = perShell[sh];
      var phase = sh * golden * 0.5;
      for (var k = 0; k < n; k++){
        var y = 1 - (k / (n - 1)) * 2;
        var rY = Math.sqrt(Math.max(0, 1 - y*y));
        var theta = golden * k + phase;
        ra.rods.push({
          shell: sh,
          nx: Math.cos(theta) * rY,
          ny: y,
          nz: Math.sin(theta) * rY,
          baseRadius: shellR,
          quietLen: quietLen,
          flareLen: quietLen * 0.55,
          radius: 0.030,
          flare: 0,
          shot: 0,
          spin: raRng() * Math.PI * 2,
          spinSpeed: 0.10 + raRng() * 0.20
        });
      }
    }

    ra.width = w;
    ra.height = h;
    ra.ready = true;
    ra.lastTime = -1;
    return true;
  }

  function raOpts(appState) {
    var st = (appState && appState.style) || {};
    var speedPct = (st.raSpeed !== undefined) ? Number(st.raSpeed) : 30;
    var speed;
    if (speedPct <= 30) speed = speedPct / 30;
    else speed = 1 + ((speedPct - 30) / 70) * 4;
    return {
      speed: speed,
      spread: (st.raSpread !== undefined) ? Number(st.raSpread) : 1.0,
      reaction: (st.raReaction !== undefined) ? Number(st.raReaction) : 1.0,
      flare: (st.raFlare !== undefined) ? Number(st.raFlare) : 1.0,
      breath: (st.raBreath !== undefined) ? Number(st.raBreath) : 1.0,
      focus: (st.raFocus !== undefined) ? Number(st.raFocus) : 1.0
    };
  }

  function drawRa(ctx, w, h, time, frame, appState){
    var opts = raOpts(appState);
    if (!ra.ready || ra.width !== w || ra.height !== h || ra.spread !== opts.spread){
      if (!raInit(w, h)) return;
      ra.spread = opts.spread;
      resetRa();
    }
    if (!frame) return;

    if (ra.lastTime < 0 || time < ra.lastTime - 1e-6) {
      resetRa();
    }

    var dt;
    if (ra.lastTime < 0) {
      dt = ra.FIXED_DT;
    } else {
      dt = Math.max(1e-4, Math.min(0.25, time - ra.lastTime));
    }
    ra.lastTime = time;
    var k = dt / ra.FIXED_DT;

    function env(current, target, alphaRef) {
      var alpha = 1 - Math.pow(1 - alphaRef, k);
      return current + (target - current) * alpha;
    }
    ra.kickEnv      = env(ra.kickEnv,      frame.bass,   0.18);
    ra.vocalEnv     = env(ra.vocalEnv,     frame.mids,   0.15);
    ra.transientEnv = env(ra.transientEnv, frame.treble, 0.20);
    ra.energyEnv    = env(ra.energyEnv,    frame.energy, 0.12);
    ra.bassEnv      = env(ra.bassEnv,      frame.bass,   0.10);

    var alive = Math.min(1, frame.energy * 6 + frame.bass * 4 + frame.mids * 4);
    ra.driftClock += dt * alive * opts.speed;
    ra.spinClock  += dt * alive * opts.speed;

    var stepIndex = Math.floor(time / ra.FIXED_DT);
    raSeed((0x1a2b3c4d ^ (stepIndex * 2654435761)) >>> 0);

    var aspect = w / h;
    var counts = new Array(ra.meshes.length).fill(0);

    for (var i = 0; i < ra.rods.length; i++){
      var r = ra.rods[i];

      var flareTarget = 0;
      if (raRng() < ra.vocalEnv * 0.9 * opts.reaction) flareTarget = (0.8 + raRng() * 1.4) * opts.flare;
      r.flare += (flareTarget - r.flare) * 0.22;

      var shotTarget = 0;
      if (ra.transientEnv > 0.05 && raRng() < ra.transientEnv * 0.7 * opts.reaction){
        shotTarget = (1.2 + raRng() * 1.6) * opts.flare;
      }
      r.shot += (shotTarget - r.shot) * 0.28;

      var dx = r.nx, dy = r.ny, dz = r.nz;

      var breath = 1 + ra.kickEnv * 0.22 * opts.breath + ra.energyEnv * 0.06 * opts.breath;
      var len = (r.quietLen + (r.flare + r.shot) * r.flareLen) * breath * opts.spread;

      var baseR = r.baseRadius * opts.spread * (1 + ra.bassEnv * 0.15);

      var cx = dx * baseR + dx * len * 0.5;
      var cy = dy * baseR + dy * len * 0.5;
      var cz = dz * baseR + dz * len * 0.5;

      var ci = r.shell;
      if (ci < ra.meshes.length){
        _raDummy.position.set(cx, cy, cz);
        _raTempV.set(dx, dy, dz);
        _raTempQ.setFromUnitVectors(_raXAxis, _raTempV);
        var spin = r.spin + ra.spinClock * r.spinSpeed;
        _raTempQ2.setFromAxisAngle(_raXAxis, spin);
        _raTempQ.multiply(_raTempQ2);
        _raDummy.quaternion.copy(_raTempQ);
        _raDummy.scale.set(len, r.radius, r.radius);
        _raDummy.updateMatrix();

        var arr = ra.meshes[ci].instanceMatrix.array;
        var o = counts[ci] * 16;
        for (var mm = 0; mm < 16; mm++) arr[o + mm] = _raDummy.matrix.elements[mm];

        var bright = 1 + r.flare * 0.9 + r.shot * 1.4 + ra.energyEnv * 0.6;
        var col = ra.meshes[ci].instanceColor.array;
        col[counts[ci]*3] = bright;
        col[counts[ci]*3+1] = bright;
        col[counts[ci]*3+2] = bright;
        counts[ci]++;
      }
    }

    for (var k2 = 0; k2 < ra.meshes.length; k2++){
      ra.meshes[k2].count = counts[k2];
      ra.meshes[k2].instanceMatrix.needsUpdate = true;
      ra.meshes[k2].instanceColor.needsUpdate = true;
    }

    if (ra.centreLight){
      ra.centreLight.intensity = 1.6 + ra.bassEnv * 6 + ra.kickEnv * 8;
    }

    var t = time * 0.06;
    var camDist = 22 * Math.max(1, opts.spread);
    ra.camera.position.set(Math.sin(t)*camDist, Math.cos(t*0.6)*camDist*0.45, Math.cos(t)*camDist);
    ra.camera.lookAt(0, 0, 0);
    ra.camera.aspect = aspect;
    ra.camera.updateProjectionMatrix();

    ra.renderer.render(ra.scene, ra.camera);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(ra.glCanvas, 0, 0, w, h);
    ctx.restore();
  }

  /* ---------- Delegating wrappers ---------- */

  function drawTuffPuff(ctx, w, h, time, frame, appState){
    if (!window.kefeTuffPuff) return;
    try { window.kefeTuffPuff.draw(ctx, w, h, time, frame, appState); }
    catch(e){ console.warn('[KEFE tuffpuff]', e); }
  }

  function drawAudioReactiveShaders(ctx, w, h, time, frame, appState){
    if (!window.kefeAudioReactiveShaders) return;
    try { window.kefeAudioReactiveShaders.draw(ctx, w, h, time, frame, appState); }
    catch(e){ console.warn('[KEFE Audio Reactive Shaders]', e); }
  }

  function drawMatrixMusic(ctx, w, h, time, frame, appState){
    if (!window.kefeMatrixVisualiser) return;
    try { window.kefeMatrixVisualiser.draw(ctx, w, h, time, frame, appState); }
    catch(e){ console.warn('[KEFE Matrix Music]', e); }
  }

  function drawButterchurn(ctx, w, h, time, frame, appState){
    if (!window.kefeButterchurn) return;
    try { window.kefeButterchurn.draw(ctx, w, h, time, appState); }
    catch(e){ console.warn('[KEFE butterchurn]', e); }
  }

  function drawRidgeline(ctx, w, h, time, frame, appState){
    if (!window.kefeRidgeline || !analysis) return;
    try { window.kefeRidgeline.draw(ctx, w, h, time, frame, appState, analysis); }
    catch(e){ console.warn('[KEFE ridgeline]', e); }
  }

  var MODES = {
    ra: drawRa,
    tuffpuff: drawTuffPuff,
    ridgeline: drawRidgeline,
    butterchurn: drawButterchurn,
    matrixmusic: drawMatrixMusic,
    audioreactive: drawAudioReactiveShaders,
    pulse: drawPulse,
    spectrum: drawSpectrum,
    waveform: drawWaveform,
    radial: drawRadial
  };

  function draw(ctx, w, h, time, appState, audioOverride, analysisOverride) {
    var mode = (appState && appState.style && appState.style.visualiserStyle) || 'pulse';
    var fn = MODES[mode] || drawPulse;

    if (lastDispatchedTime >= 0 && time < lastDispatchedTime - 1e-6) {
      resetAllRenderers();
    }
    lastDispatchedTime = time;

    var frame = sample(time, analysisOverride);
    if (!frame && !exporting && audioOverride && !audioOverride.paused) {
      frame = sampleLive(audioOverride);
    }
    if (!frame && exporting) return;

    try { fn(ctx, w, h, time, frame, appState); }
    catch (e) { console.warn('[KEFE visualiser]', e); }
  }

  function refreshRa(){ ra.ready = false; }

  window.kefeVisualiser = {
    version: 2,
    draw: draw,
    refreshRa: refreshRa,
    reset: resetAllRenderers,
    setExportMode: setExportMode,
    isExporting: isExporting,
    get data() { return analysis; },
    get maxima() { return maxima; },
    get modes() { return Object.keys(MODES); },
    ingest: ingest,
    liveSample: sampleLive,
    ridgeline: function(ctx, w, h, time, frame, appState) {
      if (window.kefeRidgeline && typeof window.kefeRidgeline.draw === 'function') {
        window.kefeRidgeline.draw(ctx, w, h, time, frame, appState, analysis);
      }
    }
  };
})();
