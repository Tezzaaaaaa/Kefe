# KEFE Visualiser

KEFE is a browser-based music visualiser and lyric-video editor for turning audio or video into customised music-led visuals. It combines a playback preview, timed lyric treatments, song artwork and metadata, visualiser scenes, and video export in one editor.

## Open KEFE

**[Launch the live editor](https://tezzaaaaaa.github.io/Kefe/)**

- **Repository:** [Tezzaaaaaa/Kefe](https://github.com/Tezzaaaaaa/Kefe)
- **Deployment:** GitHub Pages
- **Active branch:** `main`

## Current state

The editor foundation, lyric-effect system, canvas-based lyric/title-card composition and default 3D visualiser are implemented. KEFE remains under active development: connected workflows still need verification and refinement, particularly song identification, automatic artwork and lyrics retrieval, lyric timing and rendering, effect controls, visualiser settings, responsive behaviour and export.

The preview combines the lyric/title-card canvas with a dedicated visualiser canvas. The title card is designed to show the selected track's title, artist, album/year details and artwork, remain visible as the lyrics begin, and then move to a compact position above the lyrics. Behaviour can depend on the selected track, browser and available media services.

## Features

### Media and track details

- Load an audio or video file as the source media.
- Supported formats include MP3, M4A, WAV, AAC, FLAC, OGG, Opus, AIFF, CAF, MP4, MOV, M4V, WebM and AVI, subject to browser support.
- Add an optional background video.
- Search for songs and albums, review results and select the intended recording.
- Review or edit the track title, artist, album and year.
- Use available track metadata and album artwork when supplied by search results or external services.

### Lyrics and timing

- Load and edit timed lyrics.
- Adjust lyric timing with a global offset.
- Use the lyric timing editor to adjust line and word start times, create pickups and held words, split or merge lines, insert or delete content, undo edits and follow playback.
- Import enhanced LRC files with word-level timing tags.
- Download lyrics as LRC, SRT or timed JSON.
- Choose a lyric display mode: Line, Word, Karaoke or Chunk.
- Apply text-case options and a shared lyric style layer across effects.

### Lyric effects

The effect manifest currently lists 30 lyric effects:

- Apple Music-style focus lyrics
- Brat
- Eternal Sunshine
- Aurora
- Pulse
- Typewriter
- Instagram
- Fade Up
- Decrypt
- Blur In
- Shiny
- Rise
- Slide
- Drop
- Drift
- Scroll Lines
- Barbie
- Elastic Pop
- Flip Text
- Karaoke
- Trailer
- Fancy
- Glitch
- Analog TV
- Split-Flap
- Chromatica
- Progressive Blur
- CRT Computer Desktop
- CRT TV Box
- Randomize

Effects provide different animation and typography treatments. Available controls depend on the selected effect. Use the shared style controls for colours, text size, placement, outline, glow, custom text and logo, with font overrides where available.

### Preview and visualiser

- Preview playback, scrub through the timeline and view the composition fullscreen.
- Switch the composition aspect ratio between 16:9, 9:16 and 1:1.
- Use the Particles Swarm 3D visualiser and available scene presets.
- Switch between the Particles, Gradient and dedicated Glitch visualiser panels.
- The Glitch Visualiser provides audio-reactive signal tears, RGB separation, block displacement, colour trails and adjustable glitch, RGB split, feedback and zoom parameters.
- Randomise a visualiser scene or use the prompt-based scene generation control.
- Adjust particle count, speed, auto-spin and preset-specific parameters.
- Configure background effects and optional audio-reactive overlays, including waveform, spectrum, radial and pulse treatments.
- Audio overlays are designed to be included in exports.

### Video formats and export

- Choose a video type preset, including lyric video, full-song visualiser, cover-art video and vertical release cut.
- Choose 720p or 1080p output.
- Export as WebM or MP4 (H.264/AAC where supported).
- Review the composition with the pre-export checklist and phone-size preview.

Export formats and encoding options depend on browser APIs, codec support, device performance and available resources. Test the rendered file before relying on it for publication.

## Quick start

1. Open the [live editor](https://tezzaaaaaa.github.io/Kefe/).
2. In **Media**, load an audio or video file.
3. Use **Find your song** to search for and select the correct track, then check the metadata and artwork.
4. Load or review the lyrics and correct their timing where needed.
5. Choose a lyric effect and customise its typography and style.
6. Select a visualiser scene, adjust its parameters and set the aspect ratio.
7. Preview the composition, open **Export**, review the settings and render the video.

Song matches, artwork and synchronized lyrics depend on the selected track and the availability of external services or data. Automatic retrieval should be checked rather than assumed to have succeeded.

## Project structure

The deployed editor lives under `artifacts/kefe-visualiser/public/legacy/`.

```text
app/
├── brand/       # KEFE logos, wordmark and favicon
├── effects/     # Effect manifest, shared utilities and lyric renderers
├── lyrics/      # Lyric data model, timing tools and lyric downloads
├── visualiser/  # 3D visualiser, backgrounds, gradient and audio overlays
└── ui/          # Editor structure, styling, typography and lyric style layer
```

Important files:

- `app/editor.js` — editor state, media and lyric handling, canvas rendering and effect dispatch
- `app/effects/manifest.js` — central list of lyric effects
- `app/effects/core.js` — shared utilities used by multiple lyric renderers
- `app/visualiser/visualiser.js` — visualiser engine, presets and parameters
- `app/lyrics/lyric-model.js` — lyric timing data, parsing, editing and export formats
- `app/lyrics/lyric-studio.js` — lyric display modes, timing editor and downloads
- `app/ui/style-layer.js` — shared lyric styling controls
- `app/visualiser/audio-overlay.js` — audio analysis and 2D overlays
- `app/ui/structure.js` — editor sections and controls

**Important:** Keep `app/effects/core.js` in place and loaded before the lyric renderers. Multiple effects depend on the shared utilities it defines.

## Development status

The next priority is verifying and refining the connected systems end to end: media identification, lyrics and artwork retrieval, consistent lyric/title-card layout across aspect ratios, effect controls, visualiser presets and parameters, mobile layout, and reliable export.

KEFE is a creative music visualiser and lyric-video editor, not a music chart application.
