/* KEFE Visualiser — canonical typography system.
   Single source of truth for every font the app uses.
   Local fonts live in /fonts and are loaded via @font-face injected at boot.
   No remote font CDN dependency (except documented fallbacks). */
(() => {
  'use strict';

  /* ---------------------------------------------------------
     1. Font family registry
     --------------------------------------------------------- */
  const families = {
    ui:                  'Open Sans',
    apple:               'Open Sans',
    brat:                'Archivo Narrow',
    eternal:             'Homemade Apple',
    aurora:              'Bricolage Grotesque',
    typewriter:          'Courier Prime',
    instagram:           'Inter Tight',
    fadeup:              'Momo Trust Display',
    mixedmedia:          'Open Sans',
    decrypt:             'Courier Prime',
    blur:                'Bricolage Grotesque',
    shiny:               'Inter Tight',
    // New lyric effects
    barbie:              'Baloo 2',
    elasticpop:          'Bangers',
    flipcards:           'Urbanist',
    karaoke:             'Boogaloo',
    trailer:             'Monoton',
    // Next batch (effects coming next)
    chromatica:          'Memesique',
    analogtv:            'VT323',
    fancy:               'Anton',
    glitch:              'Anton',
    splitflap:           'Big Shoulders Stencil Display',
    rain:                'Frijole'
  };

  /* ---------------------------------------------------------
     2. Local @font-face definitions
        Paths are relative to the site root.
     --------------------------------------------------------- */
  const FONT_FACES = [
    // Open Sans (400/700/800) — already in fonts/open-sans
    { family: 'Open Sans', weight: 300, style: 'normal', file: 'fonts/open-sans/OpenSans-VariableFont_wdth-wght.woff2' },
    { family: 'Open Sans', weight: 400, style: 'normal', file: 'fonts/open-sans/OpenSans-VariableFont_wdth-wght.woff2' },
    { family: 'Open Sans', weight: 500, style: 'normal', file: 'fonts/open-sans/OpenSans-VariableFont_wdth-wght.woff2' },
    { family: 'Open Sans', weight: 600, style: 'normal', file: 'fonts/open-sans/OpenSans-VariableFont_wdth-wght.woff2' },
    { family: 'Open Sans', weight: 700, style: 'normal', file: 'fonts/open-sans/OpenSans-VariableFont_wdth-wght.woff2' },
    { family: 'Open Sans', weight: 800, style: 'normal', file: 'fonts/open-sans/OpenSans-VariableFont_wdth-wght.woff2' },
    { family: 'Open Sans', weight: 300, style: 'italic', file: 'fonts/open-sans/OpenSans-Italic-VariableFont_wdth-wght.woff2' },
    { family: 'Open Sans', weight: 400, style: 'italic', file: 'fonts/open-sans/OpenSans-Italic-VariableFont_wdth-wght.woff2' },
    { family: 'Open Sans', weight: 500, style: 'italic', file: 'fonts/open-sans/OpenSans-Italic-VariableFont_wdth-wght.woff2' },
    { family: 'Open Sans', weight: 600, style: 'italic', file: 'fonts/open-sans/OpenSans-Italic-VariableFont_wdth-wght.woff2' },
    { family: 'Open Sans', weight: 700, style: 'italic', file: 'fonts/open-sans/OpenSans-Italic-VariableFont_wdth-wght.woff2' },
    { family: 'Open Sans', weight: 800, style: 'italic', file: 'fonts/open-sans/OpenSans-Italic-VariableFont_wdth-wght.woff2' },
    // Archivo Narrow
    { family: 'Archivo Narrow', weight: 400, style: 'normal', file: 'fonts/archivo-narrow/ArchivoNarrow-VariableFont_wght.woff2' },
    { family: 'Archivo Narrow', weight: 500, style: 'normal', file: 'fonts/archivo-narrow/ArchivoNarrow-VariableFont_wght.woff2' },
    { family: 'Archivo Narrow', weight: 600, style: 'normal', file: 'fonts/archivo-narrow/ArchivoNarrow-VariableFont_wght.woff2' },
    { family: 'Archivo Narrow', weight: 700, style: 'normal', file: 'fonts/archivo-narrow/ArchivoNarrow-VariableFont_wght.woff2' },
    { family: 'Archivo Narrow', weight: 800, style: 'normal', file: 'fonts/archivo-narrow/ArchivoNarrow-VariableFont_wght.woff2' },
    { family: 'Archivo Narrow', weight: 900, style: 'normal', file: 'fonts/archivo-narrow/ArchivoNarrow-VariableFont_wght.woff2' },
    { family: 'Archivo Narrow', weight: 400, style: 'italic', file: 'fonts/archivo-narrow/ArchivoNarrow-Italic-VariableFont_wght.woff2' },
    { family: 'Archivo Narrow', weight: 500, style: 'italic', file: 'fonts/archivo-narrow/ArchivoNarrow-Italic-VariableFont_wght.woff2' },
    { family: 'Archivo Narrow', weight: 600, style: 'italic', file: 'fonts/archivo-narrow/ArchivoNarrow-Italic-VariableFont_wght.woff2' },
    { family: 'Archivo Narrow', weight: 700, style: 'italic', file: 'fonts/archivo-narrow/ArchivoNarrow-Italic-VariableFont_wght.woff2' },
    { family: 'Archivo Narrow', weight: 800, style: 'italic', file: 'fonts/archivo-narrow/ArchivoNarrow-Italic-VariableFont_wght.woff2' },
    { family: 'Archivo Narrow', weight: 900, style: 'italic', file: 'fonts/archivo-narrow/ArchivoNarrow-Italic-VariableFont_wght.woff2' },
    // Homemade Apple
    { family: 'Homemade Apple',    weight: 400, style: 'normal', file: 'fonts/homemade-apple/HomemadeApple-Regular.woff2' },
    // Courier Prime
    { family: 'Courier Prime',     weight: 400, style: 'normal', file: 'fonts/courier-prime/CourierPrime-Regular.woff2' },
    { family: 'Courier Prime',     weight: 700, style: 'normal', file: 'fonts/courier-prime/CourierPrime-Bold.woff2' },
    // Inter Tight
    { family: 'Inter Tight', weight: 100, style: 'normal', file: 'fonts/inter-tight/InterTight-VariableFont_wght.woff2' },
    { family: 'Inter Tight', weight: 200, style: 'normal', file: 'fonts/inter-tight/InterTight-VariableFont_wght.woff2' },
    { family: 'Inter Tight', weight: 300, style: 'normal', file: 'fonts/inter-tight/InterTight-VariableFont_wght.woff2' },
    { family: 'Inter Tight', weight: 400, style: 'normal', file: 'fonts/inter-tight/InterTight-VariableFont_wght.woff2' },
    { family: 'Inter Tight', weight: 500, style: 'normal', file: 'fonts/inter-tight/InterTight-VariableFont_wght.woff2' },
    { family: 'Inter Tight', weight: 600, style: 'normal', file: 'fonts/inter-tight/InterTight-VariableFont_wght.woff2' },
    { family: 'Inter Tight', weight: 700, style: 'normal', file: 'fonts/inter-tight/InterTight-VariableFont_wght.woff2' },
    { family: 'Inter Tight', weight: 800, style: 'normal', file: 'fonts/inter-tight/InterTight-VariableFont_wght.woff2' },
    { family: 'Inter Tight', weight: 900, style: 'normal', file: 'fonts/inter-tight/InterTight-VariableFont_wght.woff2' },
    { family: 'Inter Tight', weight: 100, style: 'italic', file: 'fonts/inter-tight/InterTight-Italic-VariableFont_wght.woff2' },
    { family: 'Inter Tight', weight: 200, style: 'italic', file: 'fonts/inter-tight/InterTight-Italic-VariableFont_wght.woff2' },
    { family: 'Inter Tight', weight: 300, style: 'italic', file: 'fonts/inter-tight/InterTight-Italic-VariableFont_wght.woff2' },
    { family: 'Inter Tight', weight: 400, style: 'italic', file: 'fonts/inter-tight/InterTight-Italic-VariableFont_wght.woff2' },
    { family: 'Inter Tight', weight: 500, style: 'italic', file: 'fonts/inter-tight/InterTight-Italic-VariableFont_wght.woff2' },
    { family: 'Inter Tight', weight: 600, style: 'italic', file: 'fonts/inter-tight/InterTight-Italic-VariableFont_wght.woff2' },
    { family: 'Inter Tight', weight: 700, style: 'italic', file: 'fonts/inter-tight/InterTight-Italic-VariableFont_wght.woff2' },
    { family: 'Inter Tight', weight: 800, style: 'italic', file: 'fonts/inter-tight/InterTight-Italic-VariableFont_wght.woff2' },
    { family: 'Inter Tight', weight: 900, style: 'italic', file: 'fonts/inter-tight/InterTight-Italic-VariableFont_wght.woff2' },
    // Momo Trust Display
    { family: 'Momo Trust Display', weight: 400, style: 'normal', file: 'fonts/momo-trust-display/MomoTrustDisplay-Regular.woff2' },
    // Bricolage Grotesque
    { family: 'Bricolage Grotesque', weight: 200, style: 'normal', file: 'fonts/bricolage-grotesque/BricolageGrotesque-VariableFont_opsz-wdth-wght.woff2' },
    { family: 'Bricolage Grotesque', weight: 300, style: 'normal', file: 'fonts/bricolage-grotesque/BricolageGrotesque-VariableFont_opsz-wdth-wght.woff2' },
    { family: 'Bricolage Grotesque', weight: 400, style: 'normal', file: 'fonts/bricolage-grotesque/BricolageGrotesque-VariableFont_opsz-wdth-wght.woff2' },
    { family: 'Bricolage Grotesque', weight: 500, style: 'normal', file: 'fonts/bricolage-grotesque/BricolageGrotesque-VariableFont_opsz-wdth-wght.woff2' },
    { family: 'Bricolage Grotesque', weight: 600, style: 'normal', file: 'fonts/bricolage-grotesque/BricolageGrotesque-VariableFont_opsz-wdth-wght.woff2' },
    { family: 'Bricolage Grotesque', weight: 700, style: 'normal', file: 'fonts/bricolage-grotesque/BricolageGrotesque-VariableFont_opsz-wdth-wght.woff2' },
    { family: 'Bricolage Grotesque', weight: 800, style: 'normal', file: 'fonts/bricolage-grotesque/BricolageGrotesque-VariableFont_opsz-wdth-wght.woff2' },
    // Baloo 2 — for Barbie effect
    { family: 'Baloo 2',           weight: 800, style: 'normal', file: 'fonts/baloo2/Baloo2-800.woff2' },
    // Memesique — for Chromatica effect (locked Chromatica typeface)
    { family: 'Memesique',         weight: 400, style: 'normal', file: 'fonts/memesique/Memesique.woff2' },
    // Bangers — elasticpop
    { family: 'Bangers',        weight: 400, style: 'normal', file: 'fonts/bangers/Bangers-Regular.woff2' },
    // Monoton — trailer
    { family: 'Monoton',        weight: 400, style: 'normal', file: 'fonts/monoton/Monoton-Regular.woff2' },
    // Big Shoulders Stencil Display — splitflap
    { family: 'Big Shoulders Stencil Display', weight: 900, style: 'normal', file: 'fonts/big-shoulders-stencil/BigShouldersStencil-Black.woff2' },
    // Frijole — rain
    { family: 'Frijole',        weight: 400, style: 'normal', file: 'fonts/frijole/Frijole-Regular.woff2' },
    // Urbanist — flipcards
    { family: 'Urbanist',       weight: 800, style: 'normal', file: 'fonts/urbanist/Urbanist-VariableFont_wght.woff2' },
    // Special Elite — glitch
    { family: 'Special Elite',  weight: 400, style: 'normal', file: 'fonts/special-elite/SpecialElite-Regular.woff2' },
    // Anton — fancy, glitch
    { family: 'Anton',         weight: 400, style: 'normal', file: 'fonts/anton/Anton-Regular.woff2' },
    // VT323 — analogtv
    { family: 'VT323',        weight: 400, style: 'normal', file: 'fonts/vt323/VT323-Regular.woff2' },
    // Boogaloo — karaoke
    { family: 'Boogaloo',       weight: 400, style: 'normal', file: 'fonts/boogaloo/Boogaloo-Regular.woff2' },
  ];

  /* ---------------------------------------------------------
     3. Inject @font-face rules once
     --------------------------------------------------------- */
  function injectFontFaces() {
    if (document.getElementById('kefe-font-faces')) return;
    const style = document.createElement('style');
    style.id = 'kefe-font-faces';
    style.textContent = FONT_FACES.map(f =>
      `@font-face{font-family:"${f.family}";font-weight:${f.weight};font-style:${f.style};font-display:swap;src:url("${f.file}") format("woff2");}`
    ).join('\n');
    document.head.appendChild(style);
  }
  injectFontFaces();

  /* ---------------------------------------------------------
     4. Effect typography contracts
     --------------------------------------------------------- */
  const scale = { ratio: 1.25, micro: 10, caption: 12.5, label: 15.625, body: 19.53125, bodyLarge: 24.414, title: 30.518, display: 38.147, displayXL: 47.684 };

  const effects = {
    apple:      { family: families.apple,       weight: 700, min: 42, max: 150, lineHeight: 1.08, tracking: -.020, align: 'center', case: 'none',  opticalScale: 1.00 },
    brat:       { family: families.brat,        weight: 700, min: 36, max: 150, lineHeight: .94,  tracking: -.055, align: 'center', case: 'none',  opticalScale: 1.04 },
    eternal:    { family: families.eternal,     weight: 400, min: 34, max: 150, lineHeight: 1,    tracking: .004,  align: 'left',   case: 'none',  opticalScale: .98 },
    aurora:     { family: families.aurora,      weight: 500, min: 38, max: 150, lineHeight: 1.05, tracking: -.006, align: 'center', case: 'none',  opticalScale: 1.00 },
    typewriter: { family: families.typewriter,  weight: 400, min: 32, max: 140, lineHeight: 1.02, tracking: .020,  align: 'center', case: 'none',  opticalScale: .98 },
    instagram:  { family: families.instagram,   weight: 800, min: 48, max: 150, lineHeight: .78,  tracking: -.035, align: 'center', case: 'upper', opticalScale: 1.00 },
    fadeup:     { family: families.fadeup,      weight: 400, min: 34, max: 150, lineHeight: 1.08, tracking: -.006, align: 'center', case: 'none',  opticalScale: .98 },
    mixedmedia: { family: families.mixedmedia,  weight: 800, min: 34, max: 150, lineHeight: 1.0,  tracking: .012,  align: 'center', case: 'none',  opticalScale: 1.00 },
    decrypt:    { family: families.decrypt,     weight: 700, min: 30, max: 140, lineHeight: 1.10, tracking: .010,  align: 'center', case: 'none',  opticalScale: .98 },
    blur:       { family: families.blur,        weight: 600, min: 30, max: 140, lineHeight: 1.14, tracking: -.010, align: 'center', case: 'none',  opticalScale: 1.00 },
    shiny:      { family: families.shiny,       weight: 800, min: 30, max: 150, lineHeight: 1.10, tracking: -.020, align: 'center', case: 'none',  opticalScale: 1.00 },
    // New lyric effects
    barbie:     { family: families.barbie,      weight: 800, min: 44, max: 220, lineHeight: 1.05, tracking: 0,      align: 'center', case: 'none',  opticalScale: 1.00 },
    elasticpop: { family: families.elasticpop,  weight: 400, min: 36, max: 160, lineHeight: 1.1, tracking: 0.01,      align: 'center', case: 'none',  opticalScale: 1.00 },
    flipcards:  { family: families.flipcards,   weight: 800, min: 30, max: 140, lineHeight: 1.2, tracking: 0,      align: 'center', case: 'none',  opticalScale: 1.00 },
    karaoke:    { family: families.karaoke,     weight: 400, min: 40, max: 170, lineHeight: 1.05, tracking: 0,      align: 'center', case: 'none',  opticalScale: 1.00 },
    trailer:    { family: families.trailer,     weight: 400, min: 52, max: 220, lineHeight: 1.05, tracking: 0.04,      align: 'center', case: 'upper', opticalScale: 1.00 },
    rain:       { family: families.rain,        weight: 400, min: 40, max: 180, lineHeight: 1.35, tracking: 0,      align: 'center', case: 'none',  opticalScale: 1.00 },
    fancy:      { family: families.fancy,       weight: 400, min: 40, max: 220, lineHeight: 1.02, tracking: 0,      align: 'center', case: 'upper', opticalScale: 1.00 },
    glitch:     { family: families.glitch,      weight: 400, min: 40, max: 220, lineHeight: 1.02, tracking: 0,      align: 'center', case: 'upper', opticalScale: 1.00 },
    analogtv:   { family: families.analogtv,    weight: 400, min: 34, max: 200, lineHeight: 1.12, tracking: 0,      align: 'center', case: 'none',  opticalScale: 1.00 },
    splitflap:  { family: families.splitflap,   weight: 900, min: 44, max: 220, lineHeight: 1.02, tracking: 0.06,      align: 'center', case: 'upper', opticalScale: 1.00 },
    chromatica: { family: families.chromatica,  weight: 400, min: 40, max: 220, lineHeight: 0.92, tracking: 0,      align: 'center', case: 'upper', opticalScale: 1.00 }
  };

  /* ---------------------------------------------------------
     5. Wait for all fonts to be ready
     --------------------------------------------------------- */
  const checkFaces = FONT_FACES.map(f => `${f.weight} 1em "${f.family}"`);
  const ready = (async () => {
    if (!document.fonts || !document.fonts.ready) return true;
    const results = await Promise.all(checkFaces.map(face => document.fonts.load(face).then(() => true).catch(() => false)));
    const failed = checkFaces.filter((_, i) => !results[i]);
    if (failed.length === checkFaces.length) {
      console.warn('KEFE: no fonts loaded at all — check /fonts paths');
    } else if (failed.length) {
      // Not an error. Safari lazily resolves variable fonts and only
      // materialises the weights it's asked for. Reporting every deferral
      // as a failure is noise.
      console.info('[KEFE] ' + failed.length + ' font variants deferred (normal)');
    }
    return results.every(Boolean);
  })();

  window.KEFE_TYPE = Object.freeze({ scale, families, effects, ready, fontFaces: FONT_FACES });
  window.kefeTypographyReady = ready;
  console.log('[KEFE] typography loaded,', FONT_FACES.length, 'font faces registered');
})();
