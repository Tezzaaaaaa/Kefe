/* KEFE — cursor-following border glow for wizard choice cards.
   2D canvas version: exact rounded-rect corners matching the card CSS,
   no WebGL, no context loss, no shader math.
   The border is stroked on a canvas sized to the card. A radial gradient
   centred on the cursor lights up the stroke near the mouse and fades
   with distance. The selected state orbits the highlight automatically. */
(function(){
  'use strict';
  if (window.__kefeShapeBlur) return;
  window.__efeShapeBlur = true;
  window.__kefeShapeBlur = true;

  var css = document.createElement('style');
  css.id = 'kefe-shape-blur-css';
  css.textContent = [
    '.kefe-shape-blur{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;border-radius:inherit;z-index:3}',
    '.wizard-choice{position:relative}'
  ].join('\n');
  document.head.appendChild(css);

  var mounted = new Map();

  function isNight() {
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

    var ctx = canvas.getContext('2d');
    if (!ctx) { canvas.remove(); return null; }

    var active = true, raf = 0;
    var mouseX = -9999, mouseY = -9999;
    var smoothX = -9999, smoothY = -9999;
    var lastT = performance.now();

    function resize() {
      if (!active) return;
      var rect = card.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
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

    function roundedPath(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.lineTo(x + w, y + h - r);
      ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
      ctx.lineTo(x + r, y + h);
      ctx.arcTo(x, y + h, x, y + h - r, r);
      ctx.lineTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
      ctx.closePath();
    }

    function frame(now) {
      if (!active) return;
      var dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;

      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var W = canvas.width, H = canvas.height;
      var cw = W / dpr, ch = H / dpr;

      var selected = card.classList.contains('selected');

      // Damped cursor position
      if (selected) {
        // Auto-orbit when selected
        var t = now / 1000;
        var cx = cw / 2, cy = ch / 2;
        var rx = cw * 0.42, ry = ch * 0.32;
        smoothX = cx + Math.sin(t * 0.65) * rx;
        smoothY = cy + Math.cos(t * 1.05) * ry;
      } else if (mouseX > -1000) {
        if (smoothX < -1000) { smoothX = mouseX; smoothY = mouseY; }
        var k = 1 - Math.exp(-8 * dt);
        smoothX += (mouseX - smoothX) * k;
        smoothY += (mouseY - smoothY) * k;
      } else {
        smoothX = -9999;
        smoothY = -9999;
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.scale(dpr, dpr);

      // Border geometry: match card CSS
      var cs = getComputedStyle(card);
      var radius = parseFloat(cs.borderTopLeftRadius) || 12;
      var borderWidth = selected ? 2.2 : 1.2;
      var inset = borderWidth / 2 + 0.5;
      var x = inset, y = inset;
      var w = cw - inset * 2, h = ch - inset * 2;

      var colour = isNight()
        ? 'rgba(255,255,255,'
        : 'rgba(10,10,10,';

      if (selected) {
        // Full-brightness border with a moving hot spot along the ring
        ctx.lineWidth = borderWidth;
        ctx.strokeStyle = colour + '0.98)';
        ctx.shadowColor = colour + '0.85)';
        ctx.shadowBlur = 14;
        roundedPath(ctx, x, y, w, h, radius);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Hot spot at the orbit position
        if (smoothX > -1000) {
          var grad = ctx.createRadialGradient(smoothX, smoothY, 0, smoothX, smoothY, Math.max(cw, ch) * 0.35);
          grad.addColorStop(0, colour + '1)');
          grad.addColorStop(0.4, colour + '0.55)');
          grad.addColorStop(1, colour + '0)');
          ctx.lineWidth = borderWidth * 2.4;
          ctx.strokeStyle = grad;
          roundedPath(ctx, x, y, w, h, radius);
          ctx.stroke();
        }
      } else if (smoothX > -1000) {
        // Hover: cursor-revealed glow along the border ring
        var g2 = ctx.createRadialGradient(smoothX, smoothY, 0, smoothX, smoothY, Math.max(cw, ch) * 0.5);
        g2.addColorStop(0, colour + '0.95)');
        g2.addColorStop(0.35, colour + '0.45)');
        g2.addColorStop(0.75, colour + '0.06)');
        g2.addColorStop(1, colour + '0)');
        ctx.lineWidth = borderWidth * 1.6;
        ctx.strokeStyle = g2;
        roundedPath(ctx, x, y, w, h, radius);
        ctx.stroke();
      }

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return function cleanup() {
      active = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      card.removeEventListener('pointermove', onMove);
      card.removeEventListener('pointerenter', onMove);
      card.removeEventListener('pointerleave', onLeave);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
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

  console.log('[KEFE] border glow: 2D canvas, exact corners');
})();
