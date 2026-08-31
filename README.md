# KEFE Visualiser

**KEFE Visualiser** is a browser-based lyric video creation tool for building music-synchronised lyric visuals with distinctive typography, animated effects, custom backgrounds, and local MP4 export.

**Live application:**
https://tezzaaaaaa.github.io/Kefe/

## What KEFE does

KEFE combines timed lyrics, media, typography, visual effects, and export into a single browser-based workflow.

### Core workflow

1. Load an audio file, or use a background video with audio as the master source.
2. Load synced lyrics from LRC or use KEFE's synced-lyrics workflow.
3. Choose a canvas: **9:16**, **1:1**, or **16:9**.
4. Choose a background or upload an image/video.
5. Choose a lyric effect and customise its controls.
6. Add optional Visual FX.
7. Preview the result on the live canvas.
8. Export an MP4 locally in the browser.

## Features

### Lyric effects

KEFE currently ships with seven production lyric treatments:

- **Apple** — clean, modern lyric presentation
- **Brat** — condensed, high-impact typography treatment
- **Eternal Sunshine** — handwritten-style treatment
- **Aurora** — expressive marker/colour treatment
- **Typewriter** — character-by-character reveal
- **Instagram Lyrics** — social-media-inspired lyric treatment
- **Fade Up** — restrained line-by-line fade treatment

Each production effect is maintained as an independent renderer while sharing common timing, typography, and drawing utilities.

### Visual FX

A separate post-render Visual FX layer can be applied to any lyric effect:

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

Visual FX are composited after the primary lyric renderer, so the two systems can evolve independently.

### Backgrounds

The editor provides six built-in background treatments:

- Colour
- Soft Gradient
- Spotlight
- Aurora Wash
- Fine Grid
- Film Grain

Custom image and video backgrounds are also supported.

### Typography

KEFE uses an effect-specific typography system. Production effects have explicit font contracts rather than relying on accidental global font inheritance.

Included local fonts include:

- Archivo Narrow
- Bricolage Grotesque
- Courier Prime
- Homemade Apple
- Inter Tight
- Momo Trust Display
- Open Sans

### Lyrics and timing

KEFE supports LRC and text lyric import, manual lyric editing, synced lyric lookup, line timing, word-level timing where available, derived word timing, video-as-master timing, and frame-accurate export timestamps.

### Media

The editor supports audio files and image/video backgrounds. When a background video contains audio, it can act as the export master source when no separate audio file is loaded.

### Project files

Projects can be saved and reopened using KEFE project files (`.kefe` / JSON-compatible project data).

### Video export

The export system is separated from the editor and provides pre-export validation, resolution and social presets, 9:16/1:1/16:9 output, frame-by-frame canvas rendering, FFmpeg encoding in the browser, MPEG-TS segment encoding, final MP4 muxing, audio/video handling, progress reporting, cancellation, diagnostic errors, and automatic output filenames ending in `- KEFE Visualiser.mp4`.

Export processing is local to the browser; media does not need to be uploaded to a KEFE rendering server.

## Technology

### Frontend

- HTML
- CSS
- JavaScript
- Canvas 2D rendering
- Modular lyric-effect registry
- Browser media APIs
- Web Workers
- FFmpeg.wasm

### Backend

The repository also contains a Node.js backend architecture for functionality that cannot be hosted by static GitHub Pages, including authentication and membership/billing infrastructure.

- Node.js 18+
- Express
- SQLite / `better-sqlite3`
- JWT
- `bcryptjs`
- Stripe
- `cookie-parser`
- `dotenv`

The backend is separate from the static GitHub Pages frontend and requires a Node-capable deployment environment.

## Project structure

```text
Kefe/
├── index.html
├── app.js
├── styles.css
├── typography.css
├── kefe-logo.svg
├── kefe-logo-light.svg
├── favicon.svg
│
├── assets/branding/   (full logo kit)
├── effects/           (lyric effect modules + selector UI)
├── export/            (MP4 export pipeline, loaded as ES module)
├── fonts/             (local woff2 font library)
├── scripts/           (headless integrity checks)
├── server/            (Node backend: auth, billing, transcription)
├── ui/                (frontend modules: auth, wizard, captions,
│    │                   background presets, typography, preview)
│   └── preview-layout.css (imported by auth-ui.css)
└── vendor/ffmpeg/     (same-origin export worker)
```
├── docs/
│
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
├── CHANGELOG.md
├── CONTRIBUTING.md
├── OFL.txt
└── README.md
```

Production functionality is separated into `effects/`, `export/`, `server/`, `scripts/`, `fonts/`, and `vendor/`. Supporting design, deployment, and licensing documentation lives under `docs/`.

## Running locally

Clone the repository:

```bash
git clone https://github.com/Tezzaaaaaa/Kefe.git
cd Kefe
npm install
npm start
```

The Node server is provided by `server/index.js`. `npm run dev` currently starts the same server.

For the static frontend, serve the repository through an HTTP server. Do not open `index.html` directly from `file://`; browser module loading and media/export behaviour require an HTTP origin.

## Validation

Run:

```bash
npm run check
```

The check covers JavaScript syntax, effect-module integrity, typography contracts, effect registration, and effect UI verification.

Automated checks do not replace real browser export testing. FFmpeg export should be tested in target browsers, particularly Safari on iOS/iPadOS, before treating a release as fully production-validated.

## FFmpeg export architecture

KEFE keeps FFmpeg integration in `export/` and uses a same-origin worker bootstrap in `vendor/ffmpeg/worker.js`.

The runtime uses:

- `@ffmpeg/ffmpeg` **0.12.15**
- `@ffmpeg/core` **0.12.10**

The exporter is deliberately isolated from the main UI so rendering and encoding responsibilities remain separate.

## Effects architecture

Production lyric effects are independent modules registered through the shared KEFE effect registry. Shared timing, typography, and drawing helpers live in `effects/core.js`. The separate Visual FX layer in `effects/effect-app-fx.js` is applied after the primary lyric renderer.

See `effects/README.md` and `effects/EFFECT-APP-IMPLEMENTATION.md` for effect-system details.

## Typography and licensing

Font files are stored locally under `fonts/` so production effects have predictable typography without depending on a remote font service.

Licensing and design documentation is maintained under `docs/`, with the SIL Open Font License text retained at the repository root.

## Deployment

The production frontend is deployed from `main` using GitHub Pages:

https://tezzaaaaaa.github.io/Kefe/

The GitHub Actions workflow is located at `.github/workflows/github-pages.yml`.

The Node backend is **not** hosted by GitHub Pages. It must be deployed separately to a Node-capable runtime when backend functionality is enabled.

See `docs/DEPLOY.md` for deployment details.

## Development documentation

| Document | Purpose |
|---|---|
| `CHANGELOG.md` | Project changes and release history |
| `CONTRIBUTING.md` | Contribution guidance |
| `docs/DEPLOY.md` | Deployment information |
| `docs/DESIGN-SYSTEM-CHECKLIST.md` | Design-system and QA checks |
| `docs/EFFECT_TYPOGRAPHY.md` | Effect typography rules |
| `effects/README.md` | Effect-system documentation |
| `effects/EFFECT-APP-IMPLEMENTATION.md` | Effect implementation notes |
| `docs/THIRD-PARTY-LICENSES.md` | Third-party licensing information |

## Project status

KEFE Visualiser is actively developed. `main` is the current production branch. The frontend is deployed and functional as a static browser application. Export reliability and browser/device compatibility should continue to be validated as the export pipeline evolves.

## Licence

KEFE contains third-party assets and libraries that remain subject to their respective licences.

Refer to `docs/THIRD-PARTY-LICENSES.md`, `OFL.txt`, and the licence files distributed with individual assets before redistributing third-party material.
