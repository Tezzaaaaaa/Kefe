/* KEFE — the one place effect names live.
 * Add a new lyric effect here, plus a <script> tag for its renderer
 * file in index.html. Nothing else needs editing — the picker, the
 * typography contracts and the smoke test all read this list.
 */
window.KEFE_EFFECTS = [
  { key: 'karaoke',     label: 'Karaoke',          description: 'Timed word-colour sweep' },
  { key: 'bounce',      label: 'Bounce Karaoke',   description: 'Timed bouncing-ball lyric animation' },
  { key: 'apple',       label: 'Apple',            description: 'Apple Music-style focus-line animation' },
  { key: 'brat',        label: 'Brat',             description: 'Edge-to-edge typewriter lettering' },
  { key: 'aurora',      label: 'Aurora',           description: 'Atmospheric gradient text' },
  { key: 'pulse',       label: 'Pulse',            description: 'Rhythmic pulsing glow' },
  { key: 'typewriter',  label: 'Typewriter',       description: 'Character-by-character text reveal' },
  { key: 'instagram',   label: 'Instagram',        description: 'Bold, stacked social-story lettering' },
  { key: 'fadeup',      label: 'Fade Up',          description: 'Word-by-word fade-up animation' },
  { key: 'decrypt',     label: 'Decrypt',          description: 'Scrambled character reveal' },
  { key: 'blur',        label: 'Blur In',          description: 'Text drifts from blur into focus' },
  { key: 'shiny',       label: 'Shiny',            description: 'Diagonal light sweep' },
  { key: 'rise',        label: 'Rise',         description: 'Soft upward text movement' },
  { key: 'slide',       label: 'Slide',        description: 'Horizontal text movement' },
  { key: 'drop',        label: 'Drop',         description: 'Controlled downward text movement' },
  { key: 'drift',       label: 'Drift',        description: 'Gentle diagonal text movement' },
  { key: 'scrolllines', label: 'Scroll Lines', description: 'Editorial multi-line lyric scroll' },
  { key: 'barbie',      label: 'Barbie',           description: 'Pink gradient glow with a featured word' },
  { key: 'elasticpop',  label: 'Elastic Pop',      description: 'Springing word-by-word motion with overshoot' },
  { key: 'flipcards',   label: 'Flip Text',        description: 'Flip-card character reveal' },
  { key: 'trailer',     label: 'Trailer',          description: 'Condensed, all-caps cinematic text reveal' },
  { key: 'fancy',       label: 'Fancy',            description: 'Bold lettering with chromatic RGB split' },
  { key: 'glitch',      label: 'Glitch',           description: 'Skew, blur and chromatic distortion' },
  { key: 'splitflap',   label: 'Split-Flap',       description: 'Mechanical letter roll-in' },
  { key: 'crtdesktop', label: 'CRT Computer Desktop', description: 'Late-1980s CRT desktop lyric screen' },
  { key: 'crttv', label: 'CRT TV Box', description: 'Late-1980s and 1990s CRT television lyric screen' },
  { key: 'randomize', label: 'Randomise', description: 'Animated stencil segmentation for any font' }
  ,{ key: 'spin', label: 'Spin Lyrics', description: 'Staggered 3D flip, float and sparkle reveal' }
  ,{ key: 'premium', label: 'Devotion', description: 'Softly fading typography on solid black or white backgrounds' }
  ,{ key: 'dustoff', label: 'Dust Off', description: 'Lyrics form from and disperse into dust particles' }
  ,{ key: 'wrapslide', label: 'WrapSlide', description: 'Per-letter vertical wrap-and-slide animation' }
  ,{ key: 'eternal', label: 'Eternal Sunshine', description: 'Handwritten ink reveal' }
  ,{ key: 'inkscript', label: 'Ink Script', description: 'Brush-ink lettering with melting transitions and splatter' }
  ,{ key: 'chrome', label: 'Liquid Chrome', description: 'Reflective liquid-metal lettering with steel depth and moving highlights' }
  ,{ key: 'gel', label: 'Gel Script', description: 'Glossy, inflated lettering with a word-by-word bounce' }
];
