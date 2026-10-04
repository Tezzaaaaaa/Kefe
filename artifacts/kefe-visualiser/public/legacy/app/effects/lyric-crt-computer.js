/* KEFE Visualiser — CRT Computer Desktop lyric effect.
   Faithful canvas port of the original HTML/CSS terminal screen: black fill,
   thin green rounded border, live clock top-left, KEFE branding in the
   corners, green block cursor, VT323 lyrics. Scanline, roll and vignette
   overlays are all driven by the panel sliders. */
(function(){
  'use strict';
  var u = window.kefeEffectUtils;
  window.kefeEffects = window.kefeEffects || {};
  if (!u) { console.error('[lyric-crtdesktop] requires editor.js utils'); return; }

  var STORE = 'kefe.crtdesktop.v3';

  var DEFAULTS = {
    zoom: 0, curve: 14, vig: 55, scan: 65, glow: 65, roll: true,
    flick: 18, chroma: 30, lines: 320,
    capFont: 'VT323', capColor: '#3fff6a', capSize: 100, capY: 50, capBox: false, upper: true,
    clock: true, brand: true, cursor: true,
    prompt: true
  };

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
  function lerp(a, b, t){ return a + (b - a) * t; }
  function wrap(c, text, maxW){
    var words = text.split(/\s+/), out = [], cur = '';
    words.forEach(function(wd){
      var t = cur ? cur + ' ' + wd : wd;
      if (cur && c.measureText(t).width > maxW) { out.push(cur); cur = wd; } else cur = t;
    });
    if (cur) out.push(cur);
    return out;
  }

  function drawCaption(b, Bw, Bh, text, alpha, style){
    var contract = (window.KEFE_TYPE && window.KEFE_TYPE.effects && window.KEFE_TYPE.effects.crtdesktop) || {};
    var fam = S.capFont === 'broadcast' ? (contract.family || 'Open Sans') : 'VT323';
    var size = Bh * 0.11 * (S.capSize / 100);
    var maxW = Bw * 0.82;
    var shown = S.upper ? text.toUpperCase() : text;
    var lines;
    for (var t = 0; t < 10; t++) {
      b.font = '400 ' + size + 'px "' + fam + '",monospace';
      lines = wrap(b, shown, maxW);
      var widest = 0; lines.forEach(function(l){ widest = Math.max(widest, b.measureText(l).width); });
      if (lines.length <= 3 && widest <= maxW * 1.02) break;
      size *= 0.9;
    }
    var lh = size * 1.15, bottom = Bh * (S.capY / 100);
    var top = bottom - lines.length * lh;
    if (top < Bh * 0.05) bottom += Bh * 0.05 - top;
    b.save();
    b.globalAlpha = alpha;
    b.textAlign = 'center'; b.textBaseline = 'alphabetic'; b.lineJoin = 'round';
    for (var i = 0; i < lines.length; i++) {
      var y = bottom - (lines.length - 1 - i) * lh - size * 0.22, x = Bw / 2;
      if (S.capBox) {
        var tw = b.measureText(lines[i]).width + size * 0.6;
        b.fillStyle = 'rgba(0,0,0,.55)'; b.fillRect(x - tw / 2, y - size * 0.9, tw, lh * 0.98);
      }
      b.lineWidth = Math.max(1, size * 0.06);
      b.strokeStyle = 'rgba(0,0,0,.5)';
      b.strokeText(lines[i], x, y);
      b.fillStyle = S.capColor;
      b.shadowColor = S.capColor;
      b.shadowBlur = size * 0.6;
      b.fillText(lines[i], x, y);
      b.shadowBlur = 0;
    }
    b.restore();
  }

  function drawClock(b, Bw, Bh){
    if (!S.clock) return;
    var d = new Date();
    var h24 = d.getHours();
    var h12 = ((h24 + 11) % 12) + 1;
    var ampm = h24 >= 12 ? 'PM' : 'AM';
    var pad = function(n){ return n < 10 ? '0' + n : '' + n; };
    var months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    var stamp = pad(h12) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + ' ' + ampm +
                ' | ' + months[d.getMonth()] + ' ' + d.getDate() + ' ' + d.getFullYear();
    var s = Bh * 0.04;
    b.save();
    b.font = '400 ' + s + 'px "VT323",monospace';
    b.fillStyle = S.capColor;
    b.shadowColor = S.capColor; b.shadowBlur = s * 0.5;
    b.textAlign = 'left'; b.textBaseline = 'top';
    b.fillText(stamp.toUpperCase(), Bw * 0.06, Bh * 0.045);
    b.restore();
  }

  function drawBrand(b, Bw, Bh){
    if (!S.brand) return;
    var s = Bh * 0.04;
    b.save();
    b.font = '400 ' + s + 'px "VT323",monospace';
    b.fillStyle = S.capColor;
    b.shadowColor = S.capColor; b.shadowBlur = s * 0.5;
    b.textBaseline = 'alphabetic';
    b.textAlign = 'left';
    b.fillText('//KEFE', Bw * 0.06, Bh * 0.96);
    b.textAlign = 'right';
    b.fillText('#KEFE', Bw * 0.94, Bh * 0.96);
    b.restore();
  }

  function drawCursor(b, Bw, Bh){
    if (!S.cursor) return;
    var blink = (performance.now() / 500 | 0) % 2 === 0;
    if (!blink) return;
    var w = Bh * 0.022, h = Bh * 0.055;
    b.fillStyle = S.capColor;
    b.shadowColor = S.capColor; b.shadowBlur = h * 0.8;
    b.fillRect(Bw * 0.06, Bh * 0.11, w, h);
    b.shadowBlur = 0;
  }

  function drawBorder(b, Bw, Bh){
    var pad = Math.min(Bw, Bh) * 0.035;
    var r = Math.min(Bw, Bh) * 0.06;
    b.save();
    b.strokeStyle = S.capColor;
    b.shadowColor = S.capColor; b.shadowBlur = Math.min(Bw, Bh) * 0.015;
    b.lineWidth = Math.max(1.2, Math.min(Bw, Bh) * 0.004);
    b.beginPath();
    b.moveTo(pad + r, pad);
    b.lineTo(Bw - pad - r, pad);
    b.quadraticCurveTo(Bw - pad, pad, Bw - pad, pad + r);
    b.lineTo(Bw - pad, Bh - pad - r);
    b.quadraticCurveTo(Bw - pad, Bh - pad, Bw - pad - r, Bh - pad);
    b.lineTo(pad + r, Bh - pad);
    b.quadraticCurveTo(pad, Bh - pad, pad, Bh - pad - r);
    b.lineTo(pad, pad + r);
    b.quadraticCurveTo(pad, pad, pad + r, pad);
    b.closePath();
    b.stroke();
    b.restore();
  }

  var B = { w: 0, h: 0 };
  function ensure(w, h){
    if (B.w === w && B.h === h) return;
    B.w = w; B.h = h;
    ['buf', 'proc', 'cr', 'cg', 'cb', 'out'].forEach(function(k){ B[k] = mk(w, h); B[k + 'x'] = B[k].getContext('2d'); });
    B.bl1 = mk(w >> 2, h >> 2); B.bl1x = B.bl1.getContext('2d');
    B.bl2 = mk(w / 10, h / 10); B.bl2x = B.bl2.getContext('2d');
  }

  function render(ctx, w, h, style, lines, time){
    var now = performance.now() / 1000;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

    var hasLines = !!(lines && lines.length);
    var act = hasLines ? u.activeLine(lines, time) : null;
    var lp = act ? u.lineProgress(act.line, time) : null;
    var text = act ? String(act.line.text || '').trim() : '';

    /* Monitor frame is a 4:3 area centred in the canvas */
    var frameW = w, frameH = h;
    var aspect = 4 / 3;
    if (frameW / frameH > aspect) frameW = frameH * aspect;
    else frameH = frameW / aspect;
    var fx = (w - frameW) / 2, fy = (h - frameH) / 2;

    var t = clamp(S.zoom / 100, 0, 1);
    var vw = lerp(frameW, w, t), vh = lerp(frameH, h, t);
    var vx = lerp(fx, 0, t), vy = lerp(fy, 0, t);

    var pad = vw * 0.045;
    var gx = vx + pad, gy = vy + pad * 1.1;
    var gw = vw - pad * 2, gh = vh - pad * 2.4;
    var glass = { x: gx, y: gy, w: gw, h: gh, cx: gx + gw / 2, cy: gy + gh / 2 };

    /* Monitor shell */
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.beginPath(); ctx.ellipse(vx + vw / 2, vy + vh + 4, vw * 0.42, vh * 0.04, 0, 0, Math.PI * 2); ctx.fill();

    var body = ctx.createLinearGradient(vx, vy, vx, vy + vh);
    body.addColorStop(0, '#d6cfbe'); body.addColorStop(0.5, '#c4bba7'); body.addColorStop(1, '#a89e88');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(vx + 14, vy);
    ctx.lineTo(vx + vw - 14, vy);
    ctx.quadraticCurveTo(vx + vw, vy, vx + vw, vy + 14);
    ctx.lineTo(vx + vw, vy + vh - 14);
    ctx.quadraticCurveTo(vx + vw, vy + vh, vx + vw - 14, vy + vh);
    ctx.lineTo(vx + 14, vy + vh);
    ctx.quadraticCurveTo(vx, vy + vh, vx, vy + vh - 14);
    ctx.lineTo(vx, vy + 14);
    ctx.quadraticCurveTo(vx, vy, vx + 14, vy);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.42)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(vx + 16, vy + 1.5); ctx.lineTo(vx + vw - 16, vy + 1.5); ctx.stroke();

    ctx.fillStyle = '#2b2721';
    ctx.beginPath();
    ctx.moveTo(gx - 8, gy - 8);
    ctx.lineTo(gx + gw + 8, gy - 8);
    ctx.quadraticCurveTo(gx + gw + 8, gy - 8, gx + gw + 8, gy);
    ctx.lineTo(gx + gw + 8, gy + gh);
    ctx.quadraticCurveTo(gx + gw + 8, gy + gh + 8, gx + gw, gy + gh + 8);
    ctx.lineTo(gx, gy + gh + 8);
    ctx.quadraticCurveTo(gx - 8, gy + gh + 8, gx - 8, gy + gh);
    ctx.lineTo(gx - 8, gy);
    ctx.quadraticCurveTo(gx - 8, gy - 8, gx, gy - 8);
    ctx.closePath(); ctx.fill();

    var stripY = vy + vh - pad * 0.9;
    ctx.fillStyle = 'rgba(0,0,0,.16)';
    ctx.fillRect(vx + 16, stripY, vw - 32, 1.5);
    ctx.font = '700 ' + Math.round(vh * 0.022) + 'px "Open Sans",system-ui,sans-serif';
    ctx.fillStyle = 'rgba(60,56,48,.62)';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('KEFE', vx + vw * 0.07, stripY + pad * 0.45);
    var ledOn = 0.55 + 0.45 * Math.sin(now * 2.6);
    ctx.save();
    ctx.shadowColor = S.capColor; ctx.shadowBlur = 12;
    ctx.globalAlpha = ledOn;
    ctx.fillStyle = S.capColor;
    ctx.beginPath(); ctx.arc(vx + vw - vw * 0.07, stripY + pad * 0.45, vh * 0.009, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    /* Raster */
    var Bh = Math.round(clamp(S.lines, 120, 480));
    var Bw = Math.round(Bh * glass.w / glass.h);
    ensure(Bw, Bh);

    var b = B.bufx;
    b.setTransform(1, 0, 0, 1, 0, 0); b.globalAlpha = 1; b.globalCompositeOperation = 'source-over';
    b.fillStyle = '#000'; b.fillRect(0, 0, Bw, Bh);

    /* Border and content sit inside the screen */
    drawBorder(b, Bw, Bh);
    drawClock(b, Bw, Bh);
    drawBrand(b, Bw, Bh);
    drawCursor(b, Bw, Bh);

    if (text && lp && lp.opacity > 0.01) {
      drawCaption(b, Bw, Bh, text, Math.min(1, lp.opacity * 2), style);
    }

    /* Post: softness + chroma */
    var p = B.procx;
    p.setTransform(1, 0, 0, 1, 0, 0); p.globalCompositeOperation = 'source-over'; p.globalAlpha = 1;
    p.drawImage(B.buf, 0, 0);
    p.globalAlpha = 0.28; p.drawImage(B.buf, 1, 0);
    p.globalAlpha = 0.28; p.drawImage(B.buf, -1, 0);
    p.globalAlpha = 1;

    var src = B.proc;
    var chroma = S.chroma / 100;
    if (chroma > 0.03) {
      var sh = chroma * 2;
      [['cr', '#f00', -sh], ['cg', '#0f0', 0], ['cb', '#00f', sh]].forEach(function(ch){
        var c = B[ch[0] + 'x'];
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
        c.fillStyle = '#000'; c.fillRect(0, 0, Bw, Bh);
        c.drawImage(B.proc, ch[2], 0);
        c.globalCompositeOperation = 'multiply'; c.fillStyle = ch[1]; c.fillRect(0, 0, Bw, Bh);
        c.globalCompositeOperation = 'source-over';
      });
      var o = B.outx;
      o.setTransform(1, 0, 0, 1, 0, 0);
      o.globalCompositeOperation = 'source-over'; o.globalAlpha = 1;
      o.fillStyle = '#000'; o.fillRect(0, 0, Bw, Bh);
      o.globalCompositeOperation = 'lighter';
      o.drawImage(B.cr, 0, 0); o.drawImage(B.cg, 0, 0); o.drawImage(B.cb, 0, 0);
      o.globalCompositeOperation = 'source-over';
      src = B.out;
    }

    var glow = S.glow / 100;
    if (glow > 0.02) {
      B.bl1x.globalCompositeOperation = 'source-over'; B.bl1x.globalAlpha = 1;
      B.bl1x.clearRect(0, 0, B.bl1.width, B.bl1.height);
      B.bl1x.drawImage(src, 0, 0, B.bl1.width, B.bl1.height);
      B.bl2x.clearRect(0, 0, B.bl2.width, B.bl2.height);
      B.bl2x.drawImage(src, 0, 0, B.bl2.width, B.bl2.height);
    }

    /* Glass clip */
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(glass.x + 6, glass.y);
    ctx.lineTo(glass.x + glass.w - 6, glass.y);
    ctx.quadraticCurveTo(glass.x + glass.w, glass.y, glass.x + glass.w, glass.y + 6);
    ctx.lineTo(glass.x + glass.w, glass.y + glass.h - 6);
    ctx.quadraticCurveTo(glass.x + glass.w, glass.y + glass.h, glass.x + glass.w - 6, glass.y + glass.h);
    ctx.lineTo(glass.x + 6, glass.y + glass.h);
    ctx.quadraticCurveTo(glass.x, glass.y + glass.h, glass.x, glass.y + glass.h - 6);
    ctx.lineTo(glass.x, glass.y + 6);
    ctx.quadraticCurveTo(glass.x, glass.y, glass.x + 6, glass.y);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = '#000'; ctx.fillRect(glass.x, glass.y, glass.w, glass.h);

    var LH = glass.h / Bh, curv = (S.curve / 100) * 0.06;
    var scanA = (S.scan / 100) * 0.55;
    ctx.imageSmoothingEnabled = true;
    for (var i = 0; i < Bh; i++) {
      var yy = (i + 0.5) / Bh, e = 2 * yy - 1;
      var widthK = (1 + curv * 0.35) * (1 - curv * e * e);
      var dw = glass.w * widthK, dx = glass.cx - dw / 2, dy = glass.y + i * LH;
      ctx.drawImage(src, 0, i, Bw, 1, dx, dy, dw, LH + 0.4);
      if (scanA > 0.01) {
        ctx.fillStyle = 'rgba(0,0,0,' + scanA.toFixed(3) + ')';
        ctx.fillRect(dx, dy + LH * 0.55, dw, LH * 0.45);
      }
    }

    if (S.roll) {
      var bandY = ((now * 0.14) % 1.3 - 0.15);
      var by = glass.y + bandY * glass.h, bh = glass.h * 0.16;
      var bg = ctx.createLinearGradient(0, by, 0, by + bh);
      bg.addColorStop(0, 'rgba(255,255,255,0)');
      bg.addColorStop(0.5, 'rgba(255,255,255,.06)');
      bg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = bg; ctx.fillRect(glass.x, by, glass.w, bh);
    }

    if (glow > 0.02) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = glow * 0.7;
      ctx.drawImage(B.bl1, glass.x, glass.y, glass.w, glass.h);
      ctx.globalAlpha = glow * 0.85;
      ctx.drawImage(B.bl2, glass.x, glass.y, glass.w, glass.h);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }

    var vig = S.vig / 100;
    ctx.save();
    ctx.translate(glass.cx, glass.cy); ctx.scale(1, glass.h / glass.w);
    var vg = ctx.createRadialGradient(0, 0, glass.w * 0.35, 0, 0, glass.w * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,' + (vig * 0.85).toFixed(3) + ')');
    ctx.fillStyle = vg; ctx.fillRect(-glass.w, -glass.w, glass.w * 2, glass.w * 2);
    ctx.restore();

    var fl = S.flick / 100;
    if (fl > 0.01) {
      var fv = 0.5 + 0.25 * Math.sin(now * 47.3) + 0.15 * Math.sin(now * 13.1) + 0.1 * Math.sin(now * 5.7);
      ctx.fillStyle = 'rgba(0,0,0,' + (fl * 0.13 * fv).toFixed(3) + ')';
      ctx.fillRect(glass.x, glass.y, glass.w, glass.h);
    }

    ctx.restore();

    var rg = ctx.createLinearGradient(glass.x, glass.y, glass.x + glass.w * 0.5, glass.y + glass.h * 0.6);
    rg.addColorStop(0, 'rgba(200,215,235,.20)');
    rg.addColorStop(0.5, 'rgba(200,215,235,.04)');
    rg.addColorStop(1, 'rgba(200,215,235,0)');
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(glass.x, glass.y);
    ctx.lineTo(glass.x + glass.w * 0.55, glass.y);
    ctx.quadraticCurveTo(glass.x + glass.w * 0.32, glass.y + glass.h * 0.5, glass.x + 6, glass.y + glass.h);
    ctx.lineTo(glass.x, glass.y + glass.h);
    ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    ctx.restore();
  }
  render.idle = true;
  window.kefeEffects.crtdesktop = render;

  var GROUPS = [
    { t: 'Monitor', c: [
      ['range', 'zoom', 'Zoom to screen', 0, 100, 1, '%'],
      ['range', 'curve', 'Curvature', 0, 100, 1, '%'],
      ['range', 'vig', 'Vignette', 0, 100, 1, '%'],
      ['range', 'lines', 'Scanline count', 120, 480, 10, ''] ] },
    { t: 'Signal', c: [
      ['range', 'scan', 'Scanlines', 0, 100, 1, '%'],
      ['range', 'glow', 'Glow / bloom', 0, 100, 1, '%'],
      ['range', 'chroma', 'Chromatic split', 0, 100, 1, '%'],
      ['range', 'flick', 'Mains flicker', 0, 100, 1, '%'],
      ['toggle', 'roll', 'Rolling band'] ] },
    { t: 'Captions', c: [
      ['select', 'capFont', 'Face', [['VT323', 'VT323'], ['broadcast', 'Broadcast sans']]],
      ['select', 'capColor', 'Colour', [['#3fff6a', 'Phosphor green'], ['#f1efe2', 'Soft white'], ['#21e6ff', 'Cyan'], ['#ffb64a', 'Amber']]],
      ['range', 'capSize', 'Size', 50, 200, 1, '%'],
      ['range', 'capY', 'Position', 20, 90, 1, '%'],
      ['toggle', 'capBox', 'Caption box'],
      ['toggle', 'upper', 'Uppercase'] ] },
    { t: 'Screen', c: [
      ['toggle', 'clock', 'Live clock'],
      ['toggle', 'brand', 'KEFE corners'],
      ['toggle', 'cursor', 'Blinking cursor'] ] }
  ];

  function buildPanel(){
    var host = document.querySelector('[data-panel-view="effects"] .kefe-form');
    if (!host || document.getElementById('crtDesktopControlsV3')) return;
    var wrap = document.createElement('div'); wrap.id = 'crtDesktopControlsV3'; wrap.className = 'crt-controls'; wrap.hidden = true;
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
  function isActive(){ var sel = document.getElementById('lyricEffect'); return !!sel && sel.value === 'crtdesktop'; }
  function sync(){
    if (!panel) panel = document.getElementById('crtDesktopControlsV3') || (buildPanel(), document.getElementById('crtDesktopControlsV3'));
    if (panel) {
      var show = isActive();
      panel.hidden = !show;
      panel.classList.toggle('kefe-hidden', !show);
    }
  }
  var sel = document.getElementById('lyricEffect');
  if (sel) sel.addEventListener('change', sync);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync); else sync();
  window.addEventListener('kefe-effects-ready', sync);
})();