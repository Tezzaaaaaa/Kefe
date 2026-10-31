/* KEFE — the one place effect names live.
 * Add a new lyric effect here, plus a <script> tag for its renderer
 * file in editor.source.html. Nothing else needs editing — the picker,
 * the typography contracts and the smoke test all read this list.
 *
 * Roster: Apple (retained) + the 50 Signature LyricFX effects.
 * The Signature effects are grouped by collection in `category`; the
 * renderer pack lives in app/effects/lyric-signature-pack.js.
 */
window.KEFE_EFFECTS = [
  { key: 'apple', label: 'Apple', description: 'Apple Music-style focus-line animation', category: 'Core' },

  /* Kinetic Dynamics */
  { key: 'sigkineticpunch', label: 'Kinetic Punch', description: 'Beat-locked scale punch with tracking spread', category: 'Kinetic Dynamics' },
  { key: 'sigelasticslam', label: 'Elastic Slam', description: 'Rubber-band glyph entry with overshoot settle', category: 'Kinetic Dynamics' },
  { key: 'siggravitylanding', label: 'Gravity Landing', description: 'Weighted fall with squash-and-stretch impact', category: 'Kinetic Dynamics' },
  { key: 'sigmagnetrepulse', label: 'Magnet Repulse', description: 'Glyphs repel from centre mass, then snap back', category: 'Kinetic Dynamics' },
  { key: 'sigwordcascade', label: 'Word Cascade', description: 'Perspective word flip-in with blur-to-sharp entry', category: 'Kinetic Dynamics' },
  { key: 'sigmarqueerail', label: 'Marquee Rail', description: 'Continuous kinetic rail with feathered edges', category: 'Kinetic Dynamics' },
  { key: 'sigslotroll', label: 'Slot Roll', description: 'Mechanical reel roll per glyph', category: 'Kinetic Dynamics' },
  { key: 'sigstompbeat', label: 'Stomp Beat', description: 'Alternating word stomp with rotation kick', category: 'Kinetic Dynamics' },
  { key: 'sigrubberstretch', label: 'Rubber Stretch', description: 'Squash-stretch tension cycle through the line', category: 'Kinetic Dynamics' },

  /* Glow Shaders */
  { key: 'signeonatmosphere', label: 'Neon Atmosphere', description: 'Slow atmospheric aura breathing behind the type', category: 'Glow Shaders' },
  { key: 'sigtubeignition', label: 'Tube Ignition', description: 'Failing neon tube restart with contact flicker', category: 'Glow Shaders' },
  { key: 'sighalobloom', label: 'Halo Bloom', description: 'Expanding concentric halos on a fixed cadence', category: 'Glow Shaders' },
  { key: 'sigemberrise', label: 'Ember Rise', description: 'Warm heat-haze drift with a dissolving ember tail', category: 'Glow Shaders' },
  { key: 'sigultraviolet', label: 'Ultraviolet Breath', description: 'Hue-rotating violet bloom with brightness swell', category: 'Glow Shaders' },
  { key: 'sigphosphor', label: 'Phosphor Drift', description: 'Dual-tone phosphor shadows drifting in opposition', category: 'Glow Shaders' },
  { key: 'sigspotlight', label: 'Spotlight Sweep', description: 'A hard light band travels through the glyphs', category: 'Glow Shaders' },
  { key: 'sigaurorawash', label: 'Aurora Wash', description: 'Blurred conic aurora bloom rotating behind the line', category: 'Glow Shaders' },
  { key: 'sigcandleflicker', label: 'Candle Flicker', description: 'Irregular warm flicker with no looping tell', category: 'Glow Shaders' },

  /* Cyber Networks */
  { key: 'sigterminalglitch', label: 'Terminal Glitch', description: 'RGB split terminal jitter with bracket housing', category: 'Cyber Networks' },
  { key: 'sigvhstracking', label: 'VHS Tracking', description: 'Tape tracking error with skew and scanlines', category: 'Cyber Networks' },
  { key: 'sigdatacorrupt', label: 'Data Corrupt', description: 'Sliced band corruption across offset colour plates', category: 'Cyber Networks' },
  { key: 'sigcathodescan', label: 'Cathode Scan', description: 'CRT raster roll with phosphor decay', category: 'Cyber Networks' },
  { key: 'sigcamcorder', label: 'Camcorder OSD', description: 'Viewfinder burn-in with blinking REC and timecode', category: 'Cyber Networks' },
  { key: 'sighexrain', label: 'Hex Rain', description: 'Scrolling byte column falling behind the type', category: 'Cyber Networks' },
  { key: 'sigsignalloss', label: 'Signal Loss', description: 'Band displacement dropout with chromatic fringe', category: 'Cyber Networks' },
  { key: 'sigbitcrush', label: 'Bit Crush', description: 'Stepped pixel jitter locked per glyph', category: 'Cyber Networks' },

  /* Rare Gem Treatments */
  { key: 'sigiridescent', label: 'Iridescent Shimmer', description: 'Holographic gradient flowing across the line', category: 'Rare Gem Treatments' },
  { key: 'siggoldfoil', label: 'Gold Foil', description: 'Burnished leaf sweep with warm specular falloff', category: 'Rare Gem Treatments' },
  { key: 'sigchromemetal', label: 'Chrome Metal', description: 'Liquid mirror chrome with a hard specular band', category: 'Rare Gem Treatments' },
  { key: 'sigprismsplit', label: 'Prism Split', description: 'Spectral copies converge into the white original', category: 'Rare Gem Treatments' },
  { key: 'sigdiamondfacet', label: 'Diamond Facet', description: 'Bevel edges with a slow internal sparkle', category: 'Rare Gem Treatments' },
  { key: 'sigrosequartz', label: 'Rose Quartz', description: 'Soft blush gradient with a warm inner light', category: 'Rare Gem Treatments' },
  { key: 'sigobsidian', label: 'Obsidian Glass', description: 'Dark glass fill with a living specular stroke', category: 'Rare Gem Treatments' },
  { key: 'sigsodalite', label: 'Sodalite Deep', description: 'Deep blue core glow with slow gradient drift', category: 'Rare Gem Treatments' },

  /* Liquid & Organic */
  { key: 'sigmetaball', label: 'Metaball Merge', description: 'Blurred glyphs merge into a liquid metaball mass', category: 'Liquid & Organic' },
  { key: 'siginkbleed', label: 'Ink Bleed', description: 'Radial ink flood spreading through the letterforms', category: 'Liquid & Organic' },
  { key: 'sigwaterripple', label: 'Water Ripple', description: 'Surface refraction pulse with skew and focus drift', category: 'Liquid & Organic' },
  { key: 'sigmoltendrip', label: 'Molten Drip', description: 'Heat-softened type sags and drips out of frame', category: 'Liquid & Organic' },
  { key: 'sigmercurybead', label: 'Mercury Bead', description: 'Per-glyph liquid metal beads with morphing shells', category: 'Liquid & Organic' },
  { key: 'sigsilkwave', label: 'Silk Wave', description: 'Travelling sine wave with per-letter rotation', category: 'Liquid & Organic' },
  { key: 'sigpetalbloom', label: 'Petal Bloom', description: 'Words hinge open from their baseline like petals', category: 'Liquid & Organic' },
  { key: 'sigvaporbloom', label: 'Vapor Bloom', description: 'Type resolves out of mist, then dissolves back', category: 'Liquid & Organic' },

  /* Dimensional Depth */
  { key: 'sigchromeextrusion', label: 'Chrome Extrusion', description: 'Stacked bevel planes with rotating extrusion', category: 'Dimensional Depth' },
  { key: 'sigletterflip', label: 'Letter Flip', description: 'Per-glyph rotateX flip with staggered delay', category: 'Dimensional Depth' },
  { key: 'sigcardstack', label: 'Card Stack', description: 'Layered offset plates that swing with the beat', category: 'Dimensional Depth' },
  { key: 'sigrackfocus', label: 'Rack Focus', description: 'Cinematic focus pull from soft to razor sharp', category: 'Dimensional Depth' },
  { key: 'sigkaleidoscope', label: 'Kaleidoscope', description: 'Mirrored ghost reflections folding around the type', category: 'Dimensional Depth' },
  { key: 'sigorbitring', label: 'Orbit Ring', description: 'Conic light ring orbiting behind the letterforms', category: 'Dimensional Depth' },
  { key: 'sigtypewriter', label: 'Typewriter', description: 'Monospace reveal with a live blinking caret', category: 'Dimensional Depth' },
  { key: 'sigcinemabars', label: 'Cinema Bars', description: 'Anamorphic punch framed by closing letterbox bars', category: 'Dimensional Depth' }
];
