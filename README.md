# KEFE

KEFE is a browser-based music visualiser and lyric-video editor.

Live editor:

https://tezzaaaaaa.github.io/Kefe/

## Current state

KEFE is in active development. The current editor includes:

- Preview-first editor layout
- Audio and video media input
- 16:9, 9:16 and 1:1 preview modes
- Functional preview fullscreen control
- Timeline playback and scrubbing
- 29 lyric effects
- Effect-specific typography and font controls
- Apple Music-style lyric effect
- Album artwork and song-detail title card
- Particles Swarm as the default 3D visualiser
- Visualiser preset selection, randomisation and generation controls
- Visualiser particle count, speed, spin and preset-specific parameters
- Background-effect controls
- Export controls
- Responsive mobile-friendly editor structure
- Centralised KEFE brand assets

The preview is structured around the visualiser canvas, transparent lyric overlay, conditional title card and fullscreen control so visualiser content is not obscured by the lyric layer.

## Project structure

```
app/
├── brand/          # KEFE logos, wordmark and favicon
├── effects/        # Lyric-effect manifest, shared core and renderers
├── visualiser/     # Default Particles Swarm visualiser
└── ui/             # Editor structure, styles and typography
```

## Progress

The editor foundation and core visualiser/lyric systems are in place. Current development is focused on completing and refining media identification, automatic artwork and lyrics retrieval, visualiser controls, responsive behaviour and export.

KEFE is not a chart app. It is a creative music visualiser and lyric-video editor.

## Do not delete

- `app/effects/core.js` — defines `window.kefeEffectUtils`, which is used by multiple lyric effects and loaded before their renderers in `index.html`. Removing or moving it can break the effect system.
