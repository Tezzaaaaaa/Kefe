# KEFE Visual Effects

KEFE keeps lyric renderers modular. The canonical renderer registry is `renderer-registry.js`; shared timing and typography helpers live in `core.js`.

## Lyric renderers

### Native/editor renderers

- `apple` — Apple-style lyric treatment (native renderer)
- `pulse` — Pulse lyric treatment (native renderer)

### Modular renderers

- `brat.js` — Brat typography
- `eternal-sunshine.js` — Eternal Sunshine handwritten treatment
- `aurora.js` + `aurora-fx.js` — Aurora lyric/background treatment
- `typewriter.js` — character-by-character reveal
- `instagram-lyrics.js` — Instagram Stories Music lyric treatment
- `story-fade.js` — Fade Up / story fade treatment
- `decrypt-text.js` — decrypt-style text reveal
- `blur-text.js` — blur-in text reveal
- `shiny-text.js` — moving highlight across text
- `scroll-lines.js` — scrolling lyric lines
- `motion.js` — Rise, Slide, Drop and Drift renderers
- `vhs-glitch.js` — retro VHS/CRT lyric treatment

## Other visual-effect modules

- `dark-veil.js` — WebGL background effect
- `effect-app-fx.js` — KEFE-native visual FX implementations
- `presets.json` — reusable effect/preset configuration
- `effect-app-public-catalog.json` — public effect catalog
- `effect-selector.css` — effect selector presentation

`renderer-registry.js` is the single dispatch point for lyric renderers. It must remain the only renderer ownership map; individual effect files provide implementations and do not create competing registries.

The registry may contain renderers that are not part of the static editor button list because the guided lyric pathway can expose additional styles. The visible editor buttons are validated separately by `scripts/verify-effect-ui.js`.
