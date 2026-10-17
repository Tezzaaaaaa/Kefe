/* KEFE — the one place effect names live.
 * Add a new lyric effect here, plus a <script> tag for its renderer
 * file in index.html. Nothing else needs editing — the picker, the
 * typography contracts and the smoke test all read this list.
 */
window.KEFE_EFFECTS = [
  { key: 'karaoke',     label: 'Karaoke',          description: 'Standard timed word-colour sweep' },
  { key: 'bounce',      label: 'Bounce Karaoke',   description: 'Timed bouncing-ball karaoke lyrics' },
  { key: 'apple',       label: 'Apple',            description: 'Apple Music-style focus line' },
  { key: 'brat',        label: 'Brat',             description: 'Edge-to-edge album-cover typewriter' },
  { key: 'aurora',      label: 'Aurora',           description: 'Atmospheric gradient lyrics' },
  { key: 'pulse',       label: 'Pulse',            description: 'Rhythmic pulse and glow' },
  { key: 'typewriter',  label: 'Typewriter',       description: 'Character-by-character reveal' },
  { key: 'instagram',   label: 'Instagram',        description: 'Bold Story-style stack' },
  { key: 'fadeup',      label: 'Fade Up',          description: 'Word-by-word fade-up' },
  { key: 'decrypt',     label: 'Decrypt',          description: 'Scramble-in character reveal' },
  { key: 'blur',        label: 'Blur In',          description: 'Drift from blur into focus' },
  { key: 'shiny',       label: 'Shiny',            description: 'Diagonal shine sweep' },
  { key: 'rise',        label: 'Rise',         description: 'Soft upward lift' },
  { key: 'slide',       label: 'Slide',        description: 'Lateral glide' },
  { key: 'drop',        label: 'Drop',         description: 'Controlled downward arrival' },
  { key: 'drift',       label: 'Drift',        description: 'Gentle diagonal float' },
  { key: 'scrolllines', label: 'Scroll Lines', description: 'Editorial multi-line scroll' },
  { key: 'barbie',      label: 'Barbie',           description: 'Pink gradient glow with hero word' },
  { key: 'elasticpop',  label: 'Elastic Pop',      description: 'Spring/overshoot word-by-word punch' },
  { key: 'flipcards',   label: 'Flip Text',        description: 'FlipText-style character reveal' },
  { key: 'trailer',     label: 'Trailer',          description: 'Condensed all-caps movie punch-in' },
  { key: 'fancy',       label: 'Fancy',            description: 'Chunky chromatic RGB-split' },
  { key: 'glitch',      label: 'Glitch',           description: 'Skew + blur + chromatic damage' },
  { key: 'splitflap',   label: 'Split-Flap',       description: 'Mechanical letter roll into place' },
  { key: 'crtdesktop', label: 'CRT Computer Desktop', description: 'Late-80s desktop CRT lyric screen' },
  { key: 'crttv', label: 'CRT TV Box', description: 'Late-80s/90s television lyric screen' },
  { key: 'randomize', label: 'Randomize', description: 'Animated stencil segmentation over any font' }
  ,{ key: 'spin', label: 'Spin Lyrics', description: 'Staggered 3D flip, float and sparkle reveal' }
  ,{ key: 'premium', label: 'Premium Circuit', description: 'Neon circuit paths, beams and luminous type' }
  ,{ key: 'dustoff', label: 'Dust Off', description: 'Lyrics form from and disperse into dust' }
  ,{ key: 'wrapslide', label: 'WrapSlide', description: 'Per-letter vertical wrap and slide' }
  ,{ key: 'eternal', label: 'Eternal Sunshine', description: 'Handwritten ink reveal' }
  ,{ key: 'inkscript', label: 'Ink Script', description: 'Brush-ink write-on, melting transitions and splatter' }
  ,{ key: 'chrome', label: 'Liquid Chrome', description: 'Reflective liquid-metal lettering with steel extrusion and moving glints' }
  ,{ key: 'gel', label: 'Gel Script', description: 'Glossy inflated lettering with word-by-word balloon bounce' }
];
