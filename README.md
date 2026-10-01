# KEFE

KEFE is a browser-based music visualiser and lyric-video editor.

Live editor:

https://tezzaaaaaa.github.io/Kefe/

## Current state

KEFE is in active development. The core editor foundation is now in place:

- Preview-first editor layout
- Audio and video media input
- Responsive 16:9, 9:16 and 1:1 preview modes
- Timeline playback and scrubbing
- 27 canonical lyric effects
- Local typography and effect-specific fonts
- Apple-style lyric visualisation
- Album artwork and title-card presentation
- Visualiser, background and export controls
- Mobile-friendly editor structure
- Centralised KEFE brand assets

## Project structure

```
app/
├── brand/      # KEFE logos, wordmark and favicon
├── effects/    # Lyric-effect manifest and renderers
└── ui/         # Editor structure, styles and typography
```

## Progress

The project is moving from the editor foundation into refinement and feature completion. Current work is focused on media handling, automatic lyrics and artwork, visualiser controls, responsive UI, and export.

KEFE is not a chart app. It is a creative music visualiser and lyric-video editor.

## ⚠️ Do not delete

- `app/effects/core.js` — defines `window.kefeEffectUtils`. **17 effect files depend on it.** Nothing imports it directly; it is loaded via `<script>` in `index.html` before the effect renderers. Deleting it silently breaks most effects.
