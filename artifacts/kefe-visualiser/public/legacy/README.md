# KEFE

KEFE is a browser-based music visualiser and lyric-video editor.

Live editor:

https://tezzaaaaaa.github.io/Kefe/

## Current state

KEFE is in active development. The current editor includes:

- Preview-first editor layout
- Audio and video media input
- 16:9, 9:16 and 1:1 preview modes
- Preview playback, scrubbing and fullscreen
- 29 lyric effects with effect-specific controls
- Apple Music-style lyric rendering
- Album artwork, automatic song details and title-card rendering
- Title card integrated into the lyric canvas for preview/export
- Particles Swarm as the default 3D visualiser
- Visualiser preset selection, preset grid, randomisation and prompt generation
- Visualiser particle count, speed, auto-spin and preset-specific parameters
- Background-effect controls
- Export controls
- Responsive mobile-friendly editor structure
- Consistent neumorphic editor controls and navigation
- Centralised KEFE brand assets
- Settings for title-card, lyric offset, editor defaults and visualiser behaviour
- CRT Computer Desktop and CRT TV lyric effects
- Lyric display modes (Line, Word, Karaoke, Chunk) and text case, applied to every effect
- Lyric timing editor: line and word start times, pickups, held words, split/merge/insert/delete, undo, follow playback
- Enhanced LRC (word tags) import, plus LRC, SRT and timed-JSON downloads
- Lyric style layer: colours, text size, placement, outline, glow, custom text and logo, applied to every effect
- Audio overlays (waveform, spectrum, radial, pulse) included in exports
- Video type presets (lyric video, full-song visualiser, cover-art video, vertical release cut)
- MP4 (H.264/AAC where the browser supports it) or WebM export, and a pre-export review checklist with phone-size preview

## Current development

The editor foundation, lyric-effect system and default visualiser are implemented. Current work is focused on verification and refinement of the connected editor systems, including lyric rendering, effect controls, visualiser presets and parameters, media identification, automatic artwork and lyrics retrieval, responsive behaviour and export.

The preview uses a consolidated canvas-based lyric/title-card rendering path alongside the dedicated visualiser canvas. The title card contains the song title, artist, album/year information and album artwork, and is intended to remain visible as lyrics begin before moving to its compact top position.

## Project structure

```
app/
├── brand/          # KEFE logos, wordmark and favicon
├── effects/        # Lyric-effect manifest, shared core and renderers
├── lyrics/         # lyric-model.js (timing data, LRC/SRT/JSON) and lyric-studio.js (display modes, timing editor, downloads)
├── visualiser/     # Particles Swarm visualiser, backgrounds, gradient layer, audio overlays
└── ui/             # Editor structure, styles, typography and the lyric style layer
```

## Important files

- `app/editor.js` — editor state, media/lyrics handling, canvas rendering and effect dispatch
- `app/effects/manifest.js` — single source of truth for lyric effects
- `app/effects/core.js` — shared lyric-effect utilities
- `app/visualiser/visualiser.js` — visualiser engine, presets and parameters
- `app/lyrics/lyric-model.js` — pure lyric data model (parse, edit, display modes, exports); no DOM
- `app/lyrics/lyric-studio.js` — display mode, timing editor and lyric downloads (uses `window.kefeLyrics` from editor.js)
- `app/ui/style-layer.js` — colours, size, placement, outline, glow, custom text and logo for all effects
- `app/visualiser/audio-overlay.js` — shared WebAudio graph (preview analyser + export stream) and the 2D overlays
- `app/ui/structure.js` — editor sections and controls

## Do not delete

- `app/effects/core.js` — defines `window.kefeEffectUtils`, which is used by multiple lyric effects and loaded before their renderers in `index.html`. Removing or moving it can break the effect system.

KEFE is not a chart app. It is a creative music visualiser and lyric-video editor.
