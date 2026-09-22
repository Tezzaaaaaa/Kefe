/* KEFE — audio-reactive visualiser effects.
   Reads analysis data from analysis-engine.js (window event
   'kefe:audio-analysis-ready') and draws reactive visuals into the
   main canvas during both preview and export.

   Modes are selected via state.style.visualiserStyle:
     pulse    — soft radial glow pulsing with the bass band
     spectrum — three reactive bars along the bottom
     waveform — horizontal wave line from the energy curve
     radial   — slow-rotating radial glow driven by energy
*/
(function(){
  'use strict';
  if (window.kefeVisualiser) return;

  var analysis = null;
  var maxima = { energy: 1, bass: 1, mids: 1, treble: 1, flux: 1 };

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
    // Ridgeline needs a per-track flux ceiling too — spectral flux has no
    // fixed scale, so an un-normalised value is either invisible or clipped
    // depending on the track. (pulse/spectrum/waveform never used flux, so
    // this wasn't tracked before.)
    maxima.flux = maxF || 1;
  }

  window.addEventListener('kefe:audio-analysis-ready', function(e){ ingest(e.detail); });

  function sample(time) {
    if (!analysis || !analysis.frameHopMs) return null;
    var hop = analysis.frameHopMs / 1000;
    var idx = Math.max(0, Math.min(analysis.energy.length - 1, Math.floor(time / hop)));
    var sum = 0, sumB = 0, sumM = 0, sumT = 0, n = 0;
    for (var k = -1; k <= 1; k++) {
      var i2 = idx + k;
      if (i2 < 0 || i2 >= analysis.energy.length) continue;
      sum += analysis.energy[i2] || 0;
      var b = analysis.bands && analysis.bands[i2];
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
     RA — real 3D sphere of glowing metal spikes.
     Renders into a hidden WebGL canvas via Three.js, then blits
     the result into the 2D preview canvas. Inner shells are
     white-hot, outer shells bronze. Bass breathes, vocals fire
     random rods out, transients fire scattered clusters.
     Silence is perfect stillness.
     ============================================================ */
  var ra = {
    renderer: null, scene: null, camera: null,
    meshes: [], rods: [],
    glCanvas: null,
    width: 0, height: 0,
    driftClock: 0, spinClock: 0,
    lastTime: 0,
    ready: false,
    kickEnv: 0, vocalEnv: 0, transientEnv: 0, energyEnv: 0, bassEnv: 0
  };

  var RA_RAMP = [
    [1.00, 0.98, 0.78],  // shell 0 (innermost) — white-hot
    [1.00, 0.92, 0.55],
    [1.00, 0.84, 0.32],
    [1.00, 0.72, 0.22],
    [0.92, 0.56, 0.14],
    [0.72, 0.38, 0.10],
    [0.48, 0.24, 0.06]   // shell 6 (outermost) — deep bronze
  ];

  function raInit(w, h){
    if (typeof THREE === 'undefined') {
      console.warn('[KEFE visualiser] Three.js not loaded — Ra disabled');
      return false;
    }

    // Hidden WebGL canvas — never appended to the DOM
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

    // Lights
    ra.scene.add(new THREE.AmbientLight(0x2a1408, 1.1));
    var key = new THREE.DirectionalLight(0xffe8b0, 1.35); key.position.set(6, 7, 9); ra.scene.add(key);
    var rim = new THREE.DirectionalLight(0xff7a28, 0.75); rim.position.set(-7, -5, -8); ra.scene.add(rim);
    var centre = new THREE.PointLight(0xffffff, 1.6, 26); centre.position.set(0, 0, 0); ra.scene.add(centre);
    ra.centreLight = centre;

    // Tapered rod geometry — sharp at the tip
    var rodGeom = new THREE.CylinderGeometry(0.02, 1.0, 1.0, 7, 1, false);
    rodGeom.rotateZ(-Math.PI/2);   // +X is the outward axis

    // Build 7 concentric shells with Fibonacci distribution
    var shells = 7;
    var golden = Math.PI * (3 - Math.sqrt(5));
    var perShell = [70, 110, 150, 190, 220, 240, 260];
    var meshes = [];

    // Pre-create an InstancedMesh per shell so we can attach a distinct material
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

    // Build per-rod metadata
    ra.rods.length = 0;
    for (var sh = 0; sh < shells; sh++){
      var lT = sh / (shells - 1);
      var shellR = (0.6 + 2.2 * lT);         // 0.6 inner → 2.8 outer
      var quietLen = (1.4 - 0.5 * lT);       // inner longer, outer shorter
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
          spin: Math.random() * Math.PI * 2,
          spinSpeed: 0.10 + Math.random() * 0.20
        });
      }
    }

    ra.width = w;
    ra.height = h;
    ra.spread = (ra.spread === undefined ? 1.0 : ra.spread);
    ra.ready = true;
    return true;
  }

  var _raDummy = new THREE.Object3D ? new THREE.Object3D() : null;
  var _raXAxis = new THREE.Vector3 ? new THREE.Vector3(1, 0, 0) : null;

  function drawRa(ctx, w, h, time, frame, appState){
    var opts = raOpts(appState);
    if (!ra.ready || ra.width !== w || ra.height !== h || ra.spread !== opts.spread){
      if (!raInit(w, h)) return;
    }
    if (!frame) return;

    // Envelope followers
    var dt = ra.lastTime ? Math.min(0.05, time - ra.lastTime) : 0.016;
    ra.lastTime = time;
    ra.kickEnv      += (frame.bass   - ra.kickEnv)      * 0.18;
    ra.vocalEnv     += (frame.mids   - ra.vocalEnv)     * 0.15;
    ra.transientEnv += (frame.treble - ra.transientEnv) * 0.20;
    ra.energyEnv    += (frame.energy - ra.energyEnv)    * 0.12;
    ra.bassEnv      += (frame.bass   - ra.bassEnv)      * 0.10;

    // Only advance clock when audio is alive
    var alive = Math.min(1, frame.energy * 6 + frame.bass * 4 + frame.mids * 4);
    ra.driftClock += dt * alive * opts.speed;
    ra.spinClock  += dt * alive * opts.speed;

    var t0 = performance.now() * 0.001;
    var halfH = 13.2;
    var aspect = w / h;

    // Clear per-shell counts
    var counts = new Array(ra.meshes.length).fill(0);

    for (var i = 0; i < ra.rods.length; i++){
      var r = ra.rods[i];

      // Per-rod random fire (white noise per frame) — vocals
      var flareTarget = 0;
      if (Math.random() < ra.vocalEnv * 0.9 * opts.reaction) flareTarget = (0.8 + Math.random() * 1.4) * opts.flare;
      r.flare += (flareTarget - r.flare) * 0.22;

      // Per-rod random fire — transients
      var shotTarget = 0;
      if (ra.transientEnv > 0.05 && Math.random() < ra.transientEnv * 0.7 * opts.reaction){
        shotTarget = (1.2 + Math.random() * 1.6) * opts.flare;
      }
      r.shot += (shotTarget - r.shot) * 0.28;

      // Direction (unit)
      var dx = r.nx, dy = r.ny, dz = r.nz;

      // Length
      var breath = 1 + ra.kickEnv * 0.22 * opts.breath + ra.energyEnv * 0.06 * opts.breath;
      var len = (r.quietLen + (r.flare + r.shot) * r.flareLen) * breath * opts.spread;

      // Base radius
      var baseR = r.baseRadius * opts.spread * (1 + ra.bassEnv * 0.15);

      var cx = dx * baseR + dx * len * 0.5;
      var cy = dy * baseR + dy * len * 0.5;
      var cz = dz * baseR + dz * len * 0.5;

      var ci = r.shell;
      if (ci < ra.meshes.length && counts[ci] < ra.meshes[ci].count + 10000){
        _raDummy.position.set(cx, cy, cz);
        var v = new THREE.Vector3(dx, dy, dz);
        var qA = new THREE.Quaternion().setFromUnitVectors(_raXAxis, v);
        var spin = r.spin + ra.spinClock * r.spinSpeed;
        var qS = new THREE.Quaternion().setFromAxisAngle(_raXAxis, spin);
        qA.multiply(qS);
        _raDummy.quaternion.copy(qA);
        _raDummy.scale.set(len, r.radius, r.radius);
        _raDummy.updateMatrix();

        var arr = ra.meshes[ci].instanceMatrix.array;
        var o = counts[ci] * 16;
        for (var m = 0; m < 16; m++) arr[o + m] = _raDummy.matrix.elements[m];

        var bright = 1 + r.flare * 0.9 + r.shot * 1.4 + ra.energyEnv * 0.6;
        var col = ra.meshes[ci].instanceColor.array;
        col[counts[ci]*3] = bright;
        col[counts[ci]*3+1] = bright;
        col[counts[ci]*3+2] = bright;
        counts[ci]++;
      }
    }

    // Push counts and flag updates
    for (var k2 = 0; k2 < ra.meshes.length; k2++){
      ra.meshes[k2].count = counts[k2];
      ra.meshes[k2].instanceMatrix.needsUpdate = true;
      ra.meshes[k2].instanceColor.needsUpdate = true;
    }

    // Center light pulses with audio
    if (ra.centreLight){
      ra.centreLight.intensity = 1.6 + ra.bassEnv * 6 + ra.kickEnv * 8;
    }

    // Slow camera orbit
    var t = time * 0.00006;
    var camDist = 22 * Math.max(1, opts.spread);
    ra.camera.position.set(Math.sin(t)*camDist, Math.cos(t*0.6)*camDist*0.45, Math.cos(t)*camDist);
    ra.camera.lookAt(0, 0, 0);
    ra.camera.aspect = aspect;
    ra.camera.updateProjectionMatrix();

    ra.renderer.render(ra.scene, ra.camera);

    // Blit the WebGL canvas into the 2D preview canvas.
    // globalCompositeOperation = 'lighter' lets it layer over the background.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(ra.glCanvas, 0, 0, w, h);
    ctx.restore();
  }

  function raOpts(appState) {
    var st = (appState && appState.style) || {};
    // Speed slider: 0 → frozen, 30 → baseline, 100 → 5x
    var speedPct = (st.raSpeed !== undefined) ? Number(st.raSpeed) : 30;
    var speed;
    if (speedPct <= 30) speed = speedPct / 30;
    else speed = 1 + ((speedPct - 30) / 70) * 4;  // 1 → 5
    return {
      speed: speed,
      spread: (st.raSpread !== undefined) ? Number(st.raSpread) : 1.0,
      reaction: (st.raReaction !== undefined) ? Number(st.raReaction) : 1.0,
      flare: (st.raFlare !== undefined) ? Number(st.raFlare) : 1.0,
      breath: (st.raBreath !== undefined) ? Number(st.raBreath) : 1.0,
      focus: (st.raFocus !== undefined) ? Number(st.raFocus) : 1.0
    };
  }
  function drawTuffPuff(ctx, w, h, time, frame, appState){
    if (!window.kefeTuffPuff) return;
    try { window.kefeTuffPuff.draw(ctx, w, h, time, frame, appState); }
    catch(e){ console.warn('[KEFE tuffpuff]', e); }
  }

  function drawButterchurn(ctx, w, h, time, frame, appState){
    if (!window.kefeButterchurn) return;
    try {
      window.kefeButterchurn.draw(ctx, w, h, time, appState);
    } catch(e){ console.warn('[KEFE butterchurn]', e); }
  }

  function drawRidgeline(ctx, w, h, time, frame, appState){
    if (!window.kefeRidgeline || !analysis) return;
    try { window.kefeRidgeline.draw(ctx, w, h, time, frame, appState, analysis); }
    catch(e){ console.warn('[KEFE ridgeline]', e); }
  }

  // Visualiser modes. The legacy pulse/spectrum/waveform/radial renderers
  // remain available as fallbacks; the picker exposes the production modes.
  var MODES = { ra: drawRa, tuffpuff: drawTuffPuff, ridgeline: drawRidgeline, butterchurn: drawButterchurn };

  function draw(ctx, w, h, time, appState) {
    var mode = (appState && appState.style && appState.style.visualiserStyle) || 'pulse';
    var fn = MODES[mode] || drawPulse;
    var frame = sample(time);
    try { fn(ctx, w, h, time, frame, appState); }
    catch (e) { console.warn('[KEFE visualiser]', e); }
  }

  function refreshRa(){ ra.ready = false; }

  window.kefeVisualiser = {
    draw: draw,
    refreshRa: refreshRa,
    get data() { return analysis; },
    get maxima() { return maxima; },
    get modes() { return Object.keys(MODES); },
    ingest: ingest
  ,
    ridgeline: function(ctx, w, h, time, frame, appState) {
      if (window.kefeRidgeline && typeof window.kefeRidgeline.draw === 'function') {
        window.kefeRidgeline.draw(ctx, w, h, time, frame, appState, analysis);
      }
    }
  };
})();
