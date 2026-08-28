/* KEFE Visualiser — canonical typography system */
(() => {
  'use strict';
  const scale = { ratio: 1.25, micro: 10, caption: 12.5, label: 15.625, body: 19.53125, bodyLarge: 24.414, title: 30.518, display: 38.147, displayXL: 47.684 };
  const families = { ui: 'Open Sans', apple: 'Open Sans', brat: 'Archivo Narrow', eternal: 'Homemade Apple', aurora: 'Homemade Apple', typewriter: 'Courier Prime', instagram: 'Inter Tight', fadeup: 'Momo Trust Display', mixedmedia: 'Open Sans' };
  const effects = {
    apple: { family: families.apple, weight: 700, min: 42, max: 150, lineHeight: 1.08, tracking: -.020, align: 'center', case: 'none', opticalScale: 1.00 },
    brat: { family: families.brat, weight: 700, min: 36, max: 150, lineHeight: .94, tracking: -.055, align: 'center', case: 'none', opticalScale: 1.04 },
    eternal: { family: families.eternal, weight: 400, min: 34, max: 150, lineHeight: 1, tracking: .004, align: 'left', case: 'none', opticalScale: .98 },
    aurora: { family: families.aurora, weight: 400, min: 38, max: 150, lineHeight: 1.05, tracking: -.006, align: 'center', case: 'none', opticalScale: 1.00 },
    typewriter: { family: families.typewriter, weight: 400, min: 32, max: 140, lineHeight: 1.02, tracking: .020, align: 'center', case: 'none', opticalScale: .98 },
    instagram: { family: families.instagram, weight: 800, min: 48, max: 150, lineHeight: .78, tracking: -.035, align: 'center', case: 'upper', opticalScale: 1.00 },
    fadeup: { family: families.fadeup, weight: 400, min: 34, max: 150, lineHeight: 1.08, tracking: -.006, align: 'center', case: 'none', opticalScale: .98 },
    mixedmedia: { family: families.mixedmedia, weight: 800, min: 34, max: 150, lineHeight: 1.0, tracking: .012, align: 'center', case: 'none', opticalScale: 1.00 }
  };
  const fontFaces = [
    '400 1em "Open Sans"', '700 1em "Open Sans"', '800 1em "Open Sans"',
    '700 1em "Archivo Narrow"', '400 1em "Homemade Apple"',
    '400 1em "Courier Prime"', '700 1em "Courier Prime"',
    '800 1em "Inter Tight"', '400 1em "Momo Trust Display"'
  ];

  const ready = (async () => {
    if (!document.fonts?.ready) return true;
    const results = await Promise.all(fontFaces.map(face => document.fonts.load(face).then(() => true).catch(() => false)));
    if (results.some(ok => !ok)) console.warn('KEFE: one or more effect fonts failed to load', fontFaces.filter((_, i) => !results[i]));
    return results.every(Boolean);
  })();

  window.KEFE_TYPE = Object.freeze({ scale, families, effects, ready });
  window.kefeTypographyReady = ready;

  const guarded = new WeakSet();
  function guard(button) {
    if (!button || guarded.has(button)) return;
    guarded.add(button);
    button.addEventListener('click', event => {
      if (button.dataset.kefeFontsReady === '1') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      button.disabled = true;
      ready.finally(() => {
        button.disabled = false;
        button.dataset.kefeFontsReady = '1';
        button.click();
      });
    }, true);
  }

  function installGuards() {
    ['exportBtn', 'exportBottom', 'confirmExport'].forEach(id => guard(document.getElementById(id)));
  }

  const redraw = () => {
    try { window.redrawCurrentPreviewFrame?.(); } catch (_) { /* preview may not be initialised yet */ }
  };

  window.addEventListener('kefe:fonts-ready', redraw);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installGuards, { once: true });
  else installGuards();

  ready.then(() => window.dispatchEvent(new CustomEvent('kefe:fonts-ready')));
})();