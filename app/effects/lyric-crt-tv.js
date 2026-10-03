/* KEFE Visualiser — CRT TV Box lyric effect.
   Renders a period-correct CRT television with scanlines, composite softness,
   colour bleed, shadow mask, bloom, barrel curvature, hum bar, tracking error
   and mains flicker. Lyrics appear as broadcast-style subtitles. */
(function(){
  'use strict';
  var u = window.kefeEffectUtils;
  window.kefeEffects = window.kefeEffects || {};
  if (!u) { console.error('[lyric-crttv] requires editor.js utils'); return; }

  var STORE = 'kefe.crttv.v2';

  var DEFAULTS = {
    zoom: 0, lines: 400, curve: 25, vig: 45, reflect: true,
    soft: 20, bleed: 18, noise: 12, jitter: 15, hum: 25, flick: 20, persist: 35,
    scan: 55, mask: 35, glow: 18,
    capFont: 'broadcast', capColor: 'yellow', capSize: 100, capY: 88, capBox: false, upper: false,
    idleStatic: true, idle: 90, burst: true
  };
  var CAP_COLORS = { yellow: '#ece86e', white: '#f2f2ea', green: '#8cf0a0', amber: '#ffb64a' };

  var S = (function(){
    var o = {}, k;
    for (k in DEFAULTS) o[k] = DEFAULTS[k];
    try { var saved = JSON.parse(localStorage.getItem(STORE) || '{}'); for (k in saved) if (k in DEFAULTS && typeof saved[k] === typeof DEFAULTS[k]) o[k] = saved[k]; } catch (e) {}
    return o;
  })();
  function save(){ try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) {} }
  function fire(){ window.dispatchEvent(new Event('kefe-effects-ready')); }

  function mk(w, h){ var c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; }
  function clamp(v, a, b){ return v < a ? a : v > b ? b : v; }
  var rs = 0x9e3779b9;
  function rnd(){ rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5; return (rs >>> 0) / 4294967296; }
  function hash(n){ var x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); }
  function rrect(c, x, y, w, h, r){
    c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
  }
  function wrap(c, text, maxW){
    var words = text.split(/\s+/), out = [], cur = '';
    words.forEach(function(wd){
      var t = cur ? cur + ' ' + wd : wd;
      if (cur && c.measureText(t).width > maxW) { out.push(cur); cur = wd; } else cur = t;
    });
    if (cur) out.push(cur);
    return out;
  }

  /* The TV frame is drawn procedurally — no external image needed. */
  var GLASS = { x: 0, y: 0, w: 1, h: 1, r: 28 };
  var HORSE = { x: 214, y: 170, w: 306, h: 308 };

  function drawTvBody(ctx, x, y, w, h, glass){
    var pad = Math.round(w * 0.03);
    var gx = x + pad, gy = y + pad, gw = w - pad * 2, gh = h - pad * 2;
    glass.x = gx; glass.y = gy; glass.w = gw; glass.h = gh;
    glass.cx = gx + gw / 2; glass.cy = gy + gh / 2;

    /* Cabinet */
    var body = ctx.createLinearGradient(x, y, x, y + h);
    body.addColorStop(0, '#d4cfbf'); body.addColorStop(0.5, '#c9c2b0'); body.addColorStop(1, '#b5ac97');
    rrect(ctx, x, y, w, h, 18); ctx.fillStyle = body; ctx.fill();
    /* Inner bevel */
    rrect(ctx, x + 3, y + 3, w - 6, h - 6, 16);
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; ctx.stroke();
    /* Glass recess */
    rrect(ctx, gx - 8, gy - 8, gw + 16, gh + 16, 22);
    ctx.fillStyle = '#1a1815'; ctx.fill();
    /* Bottom control strip */
    var stripY = y + h - Math.round(h * 0.07);
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x + 12, stripY, w - 24, 2);
    /* Speaker grille */
    var spkX = x + w - Math.round(w * 0.22), spkW = Math.round(w * 0.16);
    for (var i = 0; i < 5; i++) {
      ctx.fillStyle = 'rgba(0,0,0,.22)';
      ctx.fillRect(spkX, stripY + 6 + i * 4, spkW, 2);
    }
    /* Dial knobs */
    var dialR = Math.round(h * 0.022);
    var dialY = stripY + Math.round(h * 0.035);
    [x + w * 0.12, x + w * 0.22].forEach(function(dx){
      ctx.beginPath(); ctx.arc(dx, dialY, dialR, 0, Math.PI * 2);
      ctx.fillStyle = '#9a9186'; ctx.fill();
      ctx.beginPath(); ctx.arc(dx - dialR * 0.15, dialY - dialR * 0.15, dialR * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fill();
    });
    /* Brand plate */
    ctx.fillStyle = 'rgba(60,56,48,.55)';
    ctx.font = '700 ' + Math.round(h * 0.026) + 'px "Open Sans",system-ui,sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('HVTV', x + w * 0.42, dialY);
  }

  function drawCaption(b, Bw, Bh, text, alpha, style){
    var contract = (window.KEFE_TYPE && window.KEFE_TYPE.effects && window.KEFE_TYPE.effects.crttv) || {};
    var famC = contract.family || 'Open Sans';
    var fam = (style && style.kefeMotionFont && style.kefeMotionFont !== famC) ? style.kefeMotionFont : (S.capFont === 'teletext' ? 'VT323' : famC);
    var weight = fam === 'VT323' ? 400 : (contract.weight || 600);
    var base = Bh * 0.07 * (S.capSize / 100) * (fam === 'VT323' ? 1.3 : 1);
    var maxW = Bw * 0.8, size = base, lines;
    if (S.upper || fam === 'VT323') text = text.toUpperCase();
    for (var t = 0; t < 10; t++) {
      b.font = weight + ' ' + size + 'px "' + fam + '",system-ui,sans-serif';
      lines = wrap(b, text, maxW);
      var widest = 0; lines.forEach(function(l){ widest = Math.max(widest, b.measureText(l).width); });
      if (lines.length <= 3 && widest <= maxW * 1.02) break;
      size *= 0.9;
    }
    var lh = size * 1.18, bottom = Bh * (S.capY / 100);
    var top = bottom - lines.length * lh;
    if (top < Bh * 0.04) bottom += Bh * 0.04 - top;
    b.save();
    b.globalAlpha = alpha; b.textAlign = 'center'; b.textBaseline = 'alphabetic'; b.lineJoin = 'round';
    for (var i = 0; i < lines.length; i++) {
      var y = bottom - (lines.length - 1 - i) * lh - size * 0.24, x = Bw / 2;
      if (S.capBox) {
        var tw = b.measureText(lines[i]).width + size * 0.7;
        b.fillStyle = 'rgba(0,0,0,.72)'; b.fillRect(x - tw / 2, y - size * 0.92, tw, lh * 0.98);
      }
      b.lineWidth = Math.max(1.2, size * 0.1); b.strokeStyle = 'rgba(0,0,0,.6)'; b.strokeText(lines[i], x, y);
      b.fillStyle = CAP_COLORS[S.capColor] || CAP_COLORS.yellow; b.fillText(lines[i], x, y);
    }
    b.restore();
  }

  /* Raster buffers */
  var B = { w: 0, h: 0 }, accReset = true, last = 0;
  function ensure(w, h){
    if (B.w === w && B.h === h) return;
    B.w = w; B.h = h; accReset = true;
    ['buf', 'acc', 'fin', 'proc', 'cr', 'cg', 'cb', 'out'].forEach(function(k){ B[k] = mk(w, h); B[k + 'x'] = B[k].getContext('2d'); });
    B.snow = mk(w, h); B.snowx = B.snow.getContext('2d');
    B.snowd = B.snowx.createImageData(w, h); B.snow32 = new Uint32Array(B.snowd.data.buffer);
    B.bl1 = mk(w >> 2, h >> 2); B.bl1x = B.bl1.getContext('2d');
    B.bl2 = mk(w / 10, h / 10); B.bl2x = B.bl2.getContext('2d');
  }
  function paintSnow(){
    var d = B.snow32, w = B.w, h = B.h;
    for (var y = 0; y < h; y++) {
      var gain = 0.5 + 0.6 * rnd(), row = y * w, x = 0;
      while (x < w) {
        var run = 1 + ((rnd() * 3) | 0), v = Math.pow(rnd(), 0.7) * 255 * gain;
        v = v > 255 ? 255 : v | 0;
        var px = 0xff000000 | (v << 16) | (v << 8) | v;
        for (var k = 0; k < run && x < w; k++, x++) d[row + x] = px;
      }
    }
    B.snowx.putImageData(B.snowd, 0, 0);
  }
  var maskTile = null, maskTileA = -1;
  function getMaskTile(a){
    var q = Math.round(a * 50) / 50;
    if (maskTile && q === maskTileA) return maskTile;
    var c = maskTile || mk(3, 1), x = c.getContext('2d'), lo = Math.round(255 - 105 * q);
    x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
    x.fillStyle = 'rgb(255,' + lo + ',' + lo + ')'; x.fillRect(0, 0, 1, 1);
    x.fillStyle = 'rgb(' + lo + ',255,' + lo + ')'; x.fillRect(1, 0, 1, 1);
    x.fillStyle = 'rgb(' + lo + ',' + lo + ',255)'; x.fillRect(2, 0, 1, 1);
    maskTileA = q; return (maskTile = c);
  }

  function render(ctx, w, h, style, lines, time){
    var now = performance.now() / 1000;
    var dt = last ? Math.min(0.25, Math.max(0, now - last)) : 0.25; last = now;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

    var hasLines = !!(lines && lines.length);
    var idleMode = !hasLines && S.idleStatic;
    var act = hasLines ? u.activeLine(lines, time) : null;
    var lp = act ? u.lineProgress(act.line, time) : null;
    var text = act ? String(act.line.text || '').trim() : '';
    var age = act ? time - Number(act.line.time || 0) : 99;
    var burst = (S.burst && act && age >= 0 && age < 0.22) ? 1 - age / 0.22 : 0;

    /* TV frame dimensions */
    var frameW = w, frameH = h;
    var aspect = 4 / 3;
    if (frameW / frameH > aspect) frameW = frameH * aspect;
    else frameH = frameW / aspect;
    var fx = (w - frameW) / 2, fy = (h - frameH) / 2;
    var glass = { x: 0, y: 0, w: 0, h: 0, r: 0, cx: 0, cy: 0 };
    var pad = frameW * 0.05;
    var gx = fx + pad, gy = fy + pad * 1.1;
    var gw = frameW - pad * 2, gh = frameH - pad * 1.6 - pad * 1.6;
    glass.x = gx; glass.y = gy; glass.w = gw; glass.h = gh;
    glass.cx = gx + gw / 2; glass.cy = gy + gh / 2; glass.r = Math.min(gw, gh) * 0.06;

    /* Raster size */
    var Bh = Math.round(clamp(S.lines, 120, 480));
    var Bw = Math.round(Bh * gw / gh);
    ensure(Bw, Bh);

    /* 1. Content layer */
    var b = B.bufx;
    b.setTransform(1, 0, 0, 1, 0, 0); b.globalAlpha = 1; b.globalCompositeOperation = 'source-over';
    var g = b.createRadialGradient(Bw * 0.5, Bh * 0.46, 0, Bw * 0.5, Bh * 0.5, Bw * 0.72);
    g.addColorStop(0, '#13262d'); g.addColorStop(0.6, '#0a161c'); g.addColorStop(1, '#03070a');
    b.fillStyle = g; b.fillRect(0, 0, Bw, Bh);
    if (!idleMode) {
      if (text && lp && lp.opacity > 0.01) drawCaption(b, Bw, Bh, text, Math.min(1, lp.opacity * 2), style);
    }

    /* 2. Phosphor persistence */
    var tau = 0.02 + 0.3 * (S.persist / 100), keep = accReset ? 0 : Math.exp(-dt / tau);
    accReset = false;
    var a = B.accx;
    a.setTransform(1, 0, 0, 1, 0, 0);
    a.globalCompositeOperation = 'source-over'; a.globalAlpha = 1 - keep; a.fillStyle = '#000'; a.fillRect(0, 0, Bw, Bh);
    a.globalCompositeOperation = 'lighten'; a.globalAlpha = 1; a.drawImage(B.buf, 0, 0);

    /* 3. Signal layer */
    var f = B.finx;
    f.setTransform(1, 0, 0, 1, 0, 0); f.globalCompositeOperation = 'source-over'; f.globalAlpha = 1;
    f.drawImage(B.acc, 0, 0);
    var snowA = idleMode ? S.idle / 100 : (S.noise / 100) * 0.3 + burst * 0.32;
    if (snowA > 0.004) { paintSnow(); f.globalAlpha = clamp(snowA, 0, 1); f.drawImage(B.snow, 0, 0); f.globalAlpha = 1; }
    var humA = (S.hum / 100) * (idleMode ? 0.22 : 0.10), bandY = ((now * 0.11) % 1.35 - 0.2);
    if (humA > 0.002) {
      var by = bandY * Bh, bh = Bh * 0.2, hg = f.createLinearGradient(0, by, 0, by + bh);
      hg.addColorStop(0, 'rgba(255,255,255,0)'); hg.addColorStop(0.5, 'rgba(255,255,255,' + humA + ')'); hg.addColorStop(1, 'rgba(255,255,255,0)');
      f.globalCompositeOperation = 'lighter'; f.fillStyle = hg; f.fillRect(0, by, Bw, bh); f.globalCompositeOperation = 'source-over';
    }

    /* 4. Composite softness + chroma bleed */
    var p = B.procx;
    p.setTransform(1, 0, 0, 1, 0, 0); p.globalCompositeOperation = 'source-over'; p.globalAlpha = 1;
    p.drawImage(B.fin, 0, 0);
    var soft = S.soft / 100;
    if (soft > 0.02) {
      p.globalAlpha = 0.5 * soft; p.drawImage(B.fin, 1, 0);
      p.globalAlpha = 0.4 * soft; p.drawImage(B.fin, -1, 0);
      p.globalAlpha = 0.22 * soft; p.drawImage(B.fin, 2, 0);
      p.globalAlpha = 1;
    }
    var src = B.proc, bleed = S.bleed / 100;
    if (bleed > 0.03) {
      var sh = bleed * 2.2;
      [['cr', '#f00', -sh], ['cg', '#0f0', 0], ['cb', '#00f', sh]].forEach(function(ch){
        var c = B[ch[0] + 'x'];
        c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
        c.fillStyle = '#000'; c.fillRect(0, 0, Bw, Bh);
        c.drawImage(B.proc, ch[2], 0);
        if (ch[0] !== 'cg') { c.globalAlpha = 0.4; c.drawImage(B.proc, ch[2] * 1.9, 0); c.globalAlpha = 1; }
        c.globalCompositeOperation = 'multiply'; c.fillStyle = ch[1]; c.fillRect(0, 0, Bw, Bh);
        c.globalCompositeOperation = 'source-over';
      });
      var o = B.outx;
      o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = 'source-over'; o.globalAlpha = 1;
      o.fillStyle = '#000'; o.fillRect(0, 0, Bw, Bh);
      o.globalCompositeOperation = 'lighter';
      o.drawImage(B.cr, 0, 0); o.drawImage(B.cg, 0, 0); o.drawImage(B.cb, 0, 0);
      o.globalCompositeOperation = 'source-over';
      src = B.out;
    }

    /* 5. Bloom */
    var glow = S.glow / 100;
    if (glow > 0.02) {
      B.bl1x.globalCompositeOperation = 'source-over'; B.bl1x.globalAlpha = 1; B.bl1x.imageSmoothingEnabled = true;
      B.bl1x.clearRect(0, 0, B.bl1.width, B.bl1.height);
      B.bl1x.drawImage(src, 0, 0, B.bl1.width, B.bl1.height);
      B.bl2x.clearRect(0, 0, B.bl2.width, B.bl2.height);
      B.bl2x.drawImage(src, 0, 0, B.bl2.width, B.bl2.height);
    }

    /* 6. The set */
    var t = clamp(S.zoom / 100, 0, 1);
    var vw = lerp(frameW, gw * 1.02, t);
    var vh = lerp(frameH, gh * 1.02, t);
    var vx = lerp(fx, glass.cx - vw / 2, t);
    var vy = lerp(fy, glass.cy - vh / 2, t);

    ctx.save();
    drawTvBody(ctx, vx, vy, vw, vh, glass);

    ctx.save();
    rrect(ctx, glass.x, glass.y, glass.w, glass.h, glass.r); ctx.clip();
    ctx.fillStyle = '#03070a'; ctx.fillRect(glass.x, glass.y, glass.w, glass.h);

    var LH = glass.h / Bh, curv = (S.curve / 100) * 0.07, J = S.jitter / 100;
    var scanA = (S.scan / 100) * 0.62 * clamp((LH - 1.1) / 1.4, 0.3, 1);
    var trk = Math.floor(now * 24);
    ctx.imageSmoothingEnabled = true;
    for (var i = 0; i < Bh; i++) {
      var yy = (i + 0.5) / Bh, e = 2 * yy - 1, widthK = (1 + curv * 0.35) * (1 - curv * e * e);
      var off = Math.sin(now * 1.9 + yy * 6) * 0.35 * J;
      if (yy > 0.93) off += (hash(i * 13.37 + trk) * 2 - 1) * J * 3 * ((yy - 0.93) / 0.07);
      var dBand = Math.abs(yy - (bandY + 0.1));
      if (dBand < 0.05) off += Math.sin(i * 1.7 + now * 30) * J * 1.4 * (1 - dBand / 0.05);
      var dw = glass.w * widthK, dx = glass.cx - dw / 2 + off * (glass.w / Bw), dy = glass.y + i * LH;
      ctx.drawImage(src, 0, i, Bw, 1, dx, dy, dw, LH + 0.4);
      if (scanA > 0.01) { ctx.fillStyle = 'rgba(0,0,0,' + scanA.toFixed(3) + ')'; ctx.fillRect(dx, dy + LH * 0.58, dw, LH * 0.42); }
    }

    if (glow > 0.02) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = glow * 0.75; ctx.drawImage(B.bl1, glass.x, glass.y, glass.w, glass.h);
      ctx.globalAlpha = glow * 0.9; ctx.drawImage(B.bl2, glass.x, glass.y, glass.w, glass.h);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }

    var maskA = (S.mask / 100) * 0.5;
    if (maskA > 0.01) {
      var pat = ctx.createPattern(getMaskTile(maskA / 0.5), 'repeat');
      if (pat) { ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = pat; ctx.fillRect(glass.x, glass.y, glass.w, glass.h); ctx.restore(); }
    }

    var vig = S.vig / 100;
    ctx.save(); ctx.translate(glass.cx, glass.cy); ctx.scale(1, glass.h / glass.w);
    var vg = ctx.createRadialGradient(0, 0, glass.w * 0.3, 0, 0, glass.w * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,' + (vig * 0.9).toFixed(3) + ')');
    ctx.fillStyle = vg; ctx.fillRect(-glass.w, -glass.w, glass.w * 2, glass.w * 2); ctx.restore();

    rrect(ctx, glass.x, glass.y, glass.w, glass.h, glass.r);
    ctx.lineWidth = 22; ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.stroke();
    ctx.lineWidth = 9; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.stroke();

    var fl = S.flick / 100;
    if (fl > 0.01) {
      var fv = 0.5 + 0.25 * Math.sin(now * 47.3) + 0.15 * Math.sin(now * 13.1 + 1) + 0.1 * Math.sin(now * 5.7);
      ctx.fillStyle = 'rgba(0,0,0,' + (fl * 0.14 * fv).toFixed(3) + ')'; ctx.fillRect(glass.x, glass.y, glass.w, glass.h);
    }

    if (S.reflect) {
      var rx = glass.x, ry = glass.y;
      var rg = ctx.createLinearGradient(rx, ry, rx + 140, ry + 190);
      rg.addColorStop(0, 'rgba(190,205,235,.30)'); rg.addColorStop(1, 'rgba(190,205,235,0)');
      ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = rg;
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + 150, ry); ctx.quadraticCurveTo(rx + 92, ry + 92, rx + 4, ry + 205); ctx.lineTo(rx, ry + 205); ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
    ctx.restore();
    ctx.restore();
  }
  function lerp(a, b, t){ return a + (b - a) * t; }
  render.idle = true;
  window.kefeEffects.crttv = render;

  /* Controls */
  var GROUPS = [
    { t: 'Set', c: [
      ['range', 'zoom', 'Zoom to screen', 0, 100, 1, '%'],
      ['range', 'lines', 'Scanline count', 120, 480, 10, ''],
      ['range', 'curve', 'Curvature', 0, 100, 1, '%'], ['range', 'vig', 'Vignette', 0, 100, 1, '%'],
      ['toggle', 'reflect', 'Glass reflection'] ] },
    { t: 'Signal', c: [
      ['range', 'soft', 'Softness', 0, 100, 1, '%'], ['range', 'bleed', 'Colour bleed', 0, 100, 1, '%'],
      ['range', 'noise', 'Signal noise', 0, 100, 1, '%'], ['range', 'jitter', 'Instability / tracking', 0, 100, 1, '%'],
      ['range', 'hum', 'Hum bar', 0, 100, 1, '%'], ['range', 'flick', 'Mains flicker', 0, 100, 1, '%'], ['range', 'persist', 'Persistence', 0, 100, 1, '%'] ] },
    { t: 'Phosphor', c: [
      ['range', 'scan', 'Scanlines', 0, 100, 1, '%'], ['range', 'mask', 'Shadow mask', 0, 100, 1, '%'], ['range', 'glow', 'Glow / bloom', 0, 100, 1, '%'] ] },
    { t: 'Captions', c: [
      ['select', 'capFont', 'Face', [['broadcast', 'Broadcast sans'], ['teletext', 'Teletext']]],
      ['select', 'capColor', 'Colour', [['yellow', 'Yellow'], ['white', 'White'], ['green', 'Green'], ['amber', 'Amber']]],
      ['range', 'capSize', 'Size', 50, 200, 1, '%'], ['range', 'capY', 'Position', 30, 98, 1, '%'],
      ['toggle', 'capBox', 'Caption box'], ['toggle', 'upper', 'Uppercase'] ] },
    { t: 'No lyrics loaded', c: [
      ['toggle', 'idleStatic', 'Static screen mode'], ['range', 'idle', 'Static level', 0, 100, 1, '%'], ['toggle', 'burst', 'Signal burst on new line'] ] }
  ];

  function buildPanel(){
    var host = document.querySelector('[data-panel-view="effects"] .kefe-form');
    if (!host || document.getElementById('crtTvControls')) return;
    var wrap = document.createElement('div'); wrap.id = 'crtTvControls'; wrap.className = 'crt-controls'; wrap.hidden = true;
    var els = {};
    GROUPS.forEach(function(gr){
      var box = document.createElement('div'); box.className = 'crt-group';
      var hd = document.createElement('h3'); hd.textContent = gr.t; box.appendChild(hd);
      gr.c.forEach(function(d){
        var kind = d[0], key = d[1], row = document.createElement('label'), inp, out;
        if (kind === 'range') {
          row.className = 'crt-row';
          var sp = document.createElement('span'); sp.textContent = d[2]; row.appendChild(sp);
          inp = document.createElement('input'); inp.type = 'range'; inp.className = 'crt-range';
          inp.min = d[3]; inp.max = d[4]; inp.step = d[5]; inp.value = S[key];
          out = document.createElement('output'); out.textContent = S[key] + d[6];
          inp.addEventListener('input', function(){ S[key] = Number(inp.value); out.textContent = inp.value + d[6]; save(); fire(); });
          row.appendChild(inp); row.appendChild(out);
          els[key] = function(){ inp.value = S[key]; out.textContent = S[key] + d[6]; };
        } else if (kind === 'toggle') {
          row.className = 'crt-toggle';
          inp = document.createElement('input'); inp.type = 'checkbox'; inp.checked = !!S[key];
          inp.addEventListener('change', function(){ S[key] = inp.checked; save(); fire(); });
          var tx = document.createElement('span'); tx.textContent = d[2];
          row.appendChild(inp); row.appendChild(tx);
          els[key] = function(){ inp.checked = !!S[key]; };
        } else {
          row.className = 'crt-row crt-select';
          var sl = document.createElement('span'); sl.textContent = d[2]; row.appendChild(sl);
          inp = document.createElement('select'); inp.className = 'kefe-select';
          d[3].forEach(function(o){ var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; inp.appendChild(op); });
          inp.value = S[key];
          inp.addEventListener('change', function(){ S[key] = inp.value; save(); fire(); });
          row.appendChild(inp);
          els[key] = function(){ inp.value = S[key]; };
        }
        box.appendChild(row);
      });
      wrap.appendChild(box);
    });
    var reset = document.createElement('button'); reset.type = 'button'; reset.className = 'kefe-btn crt-reset'; reset.textContent = 'Reset CRT settings';
    reset.addEventListener('click', function(){ for (var k in DEFAULTS) S[k] = DEFAULTS[k]; save(); for (var k2 in els) els[k2](); fire(); });
    wrap.appendChild(reset);
    host.appendChild(wrap);
  }

  var panel = null;
  function isActive(){
    var sel = document.getElementById('lyricEffect');
    return !!sel && sel.value === 'crttv';
  }
  function sync(){
    if (!panel) panel = document.getElementById('crtTvControls') || (buildPanel(), document.getElementById('crtTvControls'));
    if (panel) panel.hidden = !isActive();
  }
  var sel = document.getElementById('lyricEffect');
  if (sel) sel.addEventListener('change', sync);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync);
  else sync();
  window.addEventListener('kefe-effects-ready', sync);
})();