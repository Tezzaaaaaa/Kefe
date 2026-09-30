# KEFE

KEFE is a browser-based editor for creating lyric videos and music visualisers.

It combines a large library of lyric treatments, effect-specific typography, a visual preview, a compact timeline, media input, and export controls in one editor.

## Editor

The current editor is available at:

- https://tezzaaaaaa.github.io/Kefe/

### Current workflow

1. Add an audio or video file.
2. Enter lyrics, one line per row.
3. Choose a lyric effect.
4. Preview the result on the main canvas.
5. Adjust the lyric font when an override is needed.
6. Scrub or play the timeline.
7. Configure the visualiser/export surface.

The preview remains the primary part of the editor. Editing controls sit beneath it.

## Lyric effects

KEFE currently exposes 27 lyric effects through the canonical effect manifest:

- Apple
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

Effect definitions live in `app/effects/manifest.js`.

Individual effect renderers live in `app/effects/`.

## Typography

KEFE includes a local typography system in `app/ui/typography.js`.

The editor can:

- load local WOFF2 fonts from `/fonts`
- associate fonts with lyric effects
- display the font assigned to the selected effect
- provide a font override selector
- use system fallbacks where a local font is unavailable

The font assets are stored in the repository rather than relying on a remote font CDN.

## Media

The editor accepts:

- Audio files
- Video files

The selected media becomes the master timeline source when browser metadata is available.

## Timeline

The editor includes:

- Play/pause control
- Timeline scrubbing
- Current-time display
- Duration display
- Visual playhead
- Audio-driven time updates when media is loaded

When no media is loaded, the timeline can still be used to preview lyric animation.

## Visualiser

The visualiser canvas is the main preview surface.

The current editor structure reserves dedicated controls for:

- Visualiser presets
- Background
- Motion
- Export

These surfaces are being developed independently from the lyric-effect system so the preview can remain the central composition area.

## Export

The current export surface provides:

- MP4 video
- WebM video
- 1080p
- 4K

The export controls are part of the editor UI; the rendering/export pipeline is still under development.

## Project structure

```
/
├── index.html
├── editor.html
├── app/
│   ├── effects/
│   │   ├── manifest.js
│   │   └── lyric effect renderers
│   └── ui/
│       └── typography.js
└── fonts/
    └── local WOFF2 font assets
```

## Design direction

KEFE uses a compact tactile editor interface designed around the preview rather than a large multi-column control layout.

Core interface principles:

- Preview first
- Compact editing controls
- Clear section navigation
- Consistent spacing
- Restrained rounded surfaces
- Local typography assets
- Audio/video as the master media source
- Lyric effects as the primary creative layer

## Development

KEFE is currently a browser-first project. Most of the editor is contained in `editor.html`, with lyric renderers and typography kept in separate application modules.

To contribute:

1. Work from the `main` branch.
2. Inspect the existing implementation before changing it.
3. Keep the effect manifest as the canonical list of lyric effects.
4. Keep effect-specific typography in the typography system.
5. Avoid duplicating effect or font definitions in individual UI components.

## Status

KEFE is actively being developed.

The current focus is the new editor foundation: lyric effects, typography, media handling, timeline preview, visualiser controls, background/visual FX, and export.

