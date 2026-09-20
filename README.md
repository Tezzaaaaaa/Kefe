# KEFE Visualiser

**KEFE Visualiser** is a browser-based music visualiser, lyric video and captioned video editor. It brings media, music-aware analysis, timed lyrics and captions, typography, backgrounds, audio-reactive visualisers, visual effects, live preview, project files and local MP4 export into one editor.

**Try it:** https://tezzaaaaaa.github.io/Kefe/

---

## What KEFE is

KEFE is an in-browser creation tool for turning music, lyrics, spoken audio and video into finished visual content.

It is **not a music chart app**. Its job is visual creation: prepare the media, build the timing and typography, choose a visual treatment, preview the result, and render the finished video.

The current editor supports three main creation types:

- **Lyric videos** — timed lyrics with a large library of animated typography treatments.
- **Music visualisers** — audio-reactive visuals that can be created without lyrics.
- **Captioned videos** — timed captions for spoken audio or video, with transcription fallback.

The workflow starts with **Upload Media** rather than forcing users into an audio-only workflow. Audio and video can be used as the source, and a video containing audio can provide the master audio/timing source where appropriate.

---

## Current editor

KEFE is organised around five production areas:

1. **Media** — audio/video input, metadata, source selection and upload status.
2. **Format** — aspect ratio, output presets, project save/open and export.
3. **Lyrics & Captions** — lyrics, captions, timing and text styling.
4. **Background** — built-in backgrounds plus custom image/video media.
5. **Visual FX** — post-render effects applied independently of the primary lyric or visualiser renderer.

Successful uploads provide an in-editor summary and retry path. Embedded audio metadata can be used to prefill title and artist information.

---

## Lyric effects

The current production picker contains **27 lyric effects**:

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
- Flip Cards
- Karaoke
- Trailer
- Rain on Glass
- Fancy
- Glitch
- Analog TV
- Split-Flap
- Chromatica

The effects range from restrained music-player typography and handwritten treatments to karaoke fills, mechanical split-flap animation, chromatic poster treatments, glitch effects and analog-TV styling.

The lyric effect system uses a shared catalogue and dispatch architecture so the picker, renderer registration and effect checks use the same source of truth.

---

## Music visualisers

KEFE currently provides **14 selectable audio-reactive visualiser styles**, plus the **Spectrum** preset library containing **100 presets**:

1. **Ferrofluid**
2. **Liquid Glass**
3. **Cinematic Fluid**
4. **Fractal Planet**
5. **Cosmic Attractor**
6. **Gyroid Crystal**
7. **Sonic Metaball**
8. **Holographic Ribbon**
9. **Black Hole**
10. **Neural Network**
11. **Ra**
12. **TuffPuff**
13. **Ridgeline**
14. **Spectrum**

**Spectrum** is the MilkDrop-style visualiser and provides an additional library of **100 selectable presets**.

Visualisers are separate from lyric typography, allowing music-driven visuals to be created without lyric text.

---

## Backgrounds

Built-in background choices include:

- Solid colour
- Soft Gradient
- Spotlight
- Aura Wash
- Fine Grid
- Film Grain

Users can also provide their own image or video background.

---

## Visual FX

Visual FX are handled as a separate post-render layer so primary lyric/visualiser rendering and post-processing can evolve independently.

The current KEFE FX layer includes:

- VHS
- CRT
- RGB Shift
- Bloom
- Motion Blur
- Camera Shake
- Glitch
- Halftone
- Vignette
- Mixed Media

KEFE also contains native WebGL visual treatments where required, alongside its Canvas-based rendering system.

---

## Lyrics, captions and timing

KEFE supports:

- LRC lyric import
- Text lyric editing and pasting
- Automatic lyric lookup
- Manual timing adjustment
- Timing offset nudging
- Caption generation
- Caption-block editing
- Whisper-backed transcription fallback
- Word-level timing where available
- Music-aware analysis and timing information
- Video-as-master audio/timing workflows

For captioned creation, KEFE can attempt lyric lookup before falling back to transcription when appropriate.

---

## Media and projects

KEFE works with browser-loaded:

- Audio
- Video
- Images

Projects can be saved and reopened as **'.kefe' / JSON-compatible project files**.

Media processing and rendering are designed to happen locally in the browser. The GitHub Pages application does not require media to be uploaded to a KEFE rendering server.

---

## Export

The export pipeline is separated from the editor and is designed for local browser rendering.

It supports:

- Pre-export validation
- **9:16, 1:1 and 16:9** output
- Resolution/output presets
- Frame-by-frame canvas rendering
- Browser-based FFmpeg encoding
- FFmpeg worker loading from the same origin
- Audio/video MP4 muxing
- Export progress
- Cancellation
- Diagnostic export errors
- Automatic filenames ending in **'- KEFE Visualiser.mp4'**

The rendered frames and final encoding are processed locally in the browser rather than being sent to a KEFE rendering service.

---

## Technology

### Frontend

- HTML
- CSS
- JavaScript
- Canvas 2D
- Native WebGL where required
- Browser media APIs
- Web Workers
- FFmpeg.wasm
- Local media metadata handling

### Backend

The repository also contains a separate Node.js backend for functionality that cannot be provided by a static GitHub Pages frontend, including authentication, membership/billing, database access, transcription, background removal and related server functionality.

The backend uses:

- Node.js 18+
- Express
- SQLite / better-sqlite3
- JWT
- bcryptjs
- Stripe
- cookie-parser
- dotenv

The backend is separate from the GitHub Pages frontend and requires a Node-capable deployment environment.

---

## Quick start

### Use KEFE

Open the live application:

**https://tezzaaaaaa.github.io/Kefe/**

### Run locally

    git clone https://github.com/Tezzaaaaaa/Kefe.git
    cd Kefe
    npm install
    npm start

Then open the local server in your browser.

Do not open 'index.html' directly with 'file://'. KEFE requires an HTTP origin for modules, browser media APIs and export.

---

## Development

    npm run check
    npm run test:smoke
    npm run test:functional
    npm run format:check

The repository also contains automated checks covering syntax, effects, architecture, smoke/functional behaviour, formatting, security and GitHub Pages deployment.

---

## Repository structure

    Kefe/
    ├── app/
    │   ├── core/       # analysis, projects, rendering, runtime and creation logic
    │   ├── effects/    # lyric effects and audio-reactive visualisers
    │   ├── export/     # browser rendering and MP4 export
    │   └── ui/         # editor UI and creation workflow
    ├── assets/         # application assets
    ├── fonts/          # bundled fonts
    ├── server/         # optional Node backend
    ├── scripts/        # validation and development scripts
    ├── tests/          # automated tests
    ├── vendor/         # bundled third-party browser assets
    ├── index.html      # production editor entry point
    └── package.json

---

## Status

KEFE Visualiser is actively developed. The 'main' branch contains the current browser application and its production rendering/export pipeline.

Current development is focused on reliability, browser/device compatibility, rendering/export performance, and refinement of the creation and visualisation experience.

---

## License

See 'OFL.txt' for font licensing. Third-party assets remain subject to their own licences.
