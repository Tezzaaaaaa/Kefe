# KEFE Visualiser

**KEFE Visualiser** is a browser-based lyric video creation tool for building music-synchronised lyric visuals with distinctive typography, animated effects, custom backgrounds, and local MP4 export.

**Live application:**
https://tezzaaaaaa.github.io/Kefe/

---

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

---

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

The Colour tile includes an integrated colour picker. Custom image and video backgrounds are available separately from the presets.

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

KEFE supports:

- LRC and text lyric import
- Manual lyric editing
- Synced lyric lookup workflow
- Line timing
- Word-level timing where available
- Derived word timing when only line timing is supplied
- Video-as-master timing
- Frame-accurate export timestamps

### Media

The editor supports audio files and image/video backgrounds. When a background video contains audio, it can act as the export master source when no separate audio file is loaded.

### Image enhancement

KEFE also includes a standalone browser-based image enhancement tool for preparing visual assets. Processing is performed locally in the browser.

### Project files

Projects can be saved and reopened using KEFE project files (`.kefe` / JSON-compatible project data).

### Video export

The export system is separated from the editor and provides:

- Pre-export validation
- 480p, 720p, and 1080p output presets
- Instagram and TikTok presets
- 9:16, 1:1, and 16:9 output
- Frame-by-frame canvas rendering
- FFmpeg encoding in the browser
- MPEG-TS segment encoding
- Final MP4 muxing
- Audio/video handling
- Progress reporting
- Cancellation
- Diagnostic export errors
- Automatic output filenames ending in `- KEFE Visualiser.mp4`

Export processing is local to the browser; media does not need to be uploaded to a KEFE rendering server.

---

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

---

## Project structure

```text
Kefe/
├── index.html
├── app.js
├── styles.css
├── typography.css
├── typography.js
├── ui-polish.css
├── design-refresh.css
├── auth-ui.css
├── auth-ui.js
├── background-presets.js
├── background-presets.css
├── preview-layout.css
├── kefe-logo.svg
├── favicon.svg
│
├── effects/
│   ├── core.js
│   ├── brat.js
│   ├── aurora.js
│   ├── eternal-sunshine.js
│   ├── typewriter.js
│   ├── instagram-lyrics.js
│   ├── story-fade.js
│   ├── effect-app-fx.js
│   ├── effect-selector.css
│   ├── presets.json
│   ├── effect-app-public-catalog.json
│   ├── README.md
│   └── EFFECT-APP-IMPLEMENTATION.md
│
├── export/
│   ├── index.js
│   ├── encoder.js
│   └── ui.js
│
├── vendor/
│   └── ffmpeg/
│       └── worker.js
│
├── server/
│   ├── index.js
│   ├── auth.js
│   ├── billing.js
│   ├── db.js
│   └── entitlements.js
│
├── scripts/
│   ├── smoke-effects.js
│   └── verify-effect-ui.js
│
├── fonts/
│   ├── archivo-narrow/
│   ├── bricolage-grotesque/
│   ├── courier-prime/
│   ├── homemade-apple/
│   ├── inter-tight/
│   ├── momo-trust-display/
│   └── open-sans/
│
├── image-enhancer.html
├── image-enhancer.js
├── image-enhancer.css
│
├── .env.example
├── .gitignore
├── package.json
├── CHANGELOG.md
├── CONTRIBUTING.md
├── DEPLOY.md
├── DESIGN-SYSTEM-CHECKLIST.md
├── EFFECT_TYPOGRAPHY.md
├── OFL.txt
└── THIRD-PARTY-LICENSES.md
```

The repository intentionally keeps production functionality separated into `effects/`, `export/`, `server/`, `scripts/`, `fonts/`, and `vendor/` rather than maintaining duplicate standalone implementations.

---

## Running locally

Clone the repository:

```bash
git clone https://github.com/Tezzaaaaaa/Kefe.git
cd Kefe
```

Install dependencies:

```bash
npm install
```

Start the Node server:

```bash
npm start
```

The development server is provided by:

```text
server/index.js
```

`npm run dev` currently starts the same server.

For the static frontend, the repository can also be served by a static HTTP server. Do not open `index.html` directly from `file://`; browser module loading and media/export behaviour require an HTTP origin.

---

## Validation

The repository includes a lightweight integrity suite for the production lyric-effect system.

Run:

```bash
npm run check
```

The check covers JavaScript syntax, effect-module integrity, typography contracts, effect registration, and the effect UI verification scripts.

This automated check does **not** replace real browser export testing. FFmpeg export should be tested in the target browsers, particularly Safari on iOS/iPadOS, before treating a release as fully production-validated.

---

## FFmpeg export architecture

KEFE keeps the FFmpeg integration in `export/` and uses a same-origin worker bootstrap in `vendor/ffmpeg/worker.js`.

The runtime uses:

- `@ffmpeg/ffmpeg` **0.12.15**
- `@ffmpeg/core` **0.12.10**

The FFmpeg module and core assets are cached for the browser session. Individual encoder instances are still released between export segments to control WASM memory usage during long exports.

The exporter is deliberately isolated from the main UI so rendering and encoding responsibilities remain separate.

---

## Effects architecture

Production lyric effects are independent modules registered through the shared KEFE effect registry.

The common renderer contract is:

```text
(ctx, width, height, style, lines, time)
```

Shared timing, typography, and drawing helpers live in:

```text
effects/core.js
```

The separate Visual FX layer in:

```text
effects/effect-app-fx.js
```

is applied after the primary lyric renderer.

More detailed documentation:

- [`effects/README.md`](effects/README.md)
- [`effects/EFFECT-APP-IMPLEMENTATION.md`](effects/EFFECT-APP-IMPLEMENTATION.md)
- [`EFFECT_TYPOGRAPHY.md`](EFFECT_TYPOGRAPHY.md)

---

## Typography and licensing

Font files are stored locally under `fonts/` so production effects have predictable typography without depending on a remote font service.

Licensing information is provided in:

- [`THIRD-PARTY-LICENSES.md`](THIRD-PARTY-LICENSES.md)
- [`OFL.txt`](OFL.txt)
- Individual font licence files where applicable

---

## Deployment

The production frontend is deployed from `main` using GitHub Pages and is available at:

https://tezzaaaaaa.github.io/Kefe/

The GitHub Actions workflow is located at:

```text
.github/workflows/github-pages.yml
```

The Node backend is **not** hosted by GitHub Pages. It must be deployed separately to a Node-capable runtime when backend functionality is enabled.

See [`DEPLOY.md`](DEPLOY.md) for deployment details.

---

## Development documentation

| Document | Purpose |
|---|---|
| [`CHANGELOG.md`](CHANGELOG.md) | Project changes and release history |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Contribution guidance |
| [`DEPLOY.md`](DEPLOY.md) | Deployment information |
| [`DESIGN-SYSTEM-CHECKLIST.md`](DESIGN-SYSTEM-CHECKLIST.md) | Design-system checks |
| [`EFFECT_TYPOGRAPHY.md`](EFFECT_TYPOGRAPHY.md) | Effect typography rules |
| [`effects/README.md`](effects/README.md) | Effect-system documentation |
| [`effects/EFFECT-APP-IMPLEMENTATION.md`](effects/EFFECT-APP-IMPLEMENTATION.md) | Effect implementation notes |
| [`THIRD-PARTY-LICENSES.md`](THIRD-PARTY-LICENSES.md) | Third-party licensing information |

---

## Repository hygiene

The `main` branch is intended to contain the current production codebase and its required supporting documentation/assets only.

Experimental or obsolete standalone implementations should not be retained alongside production code. Production functionality should live in its canonical module and should not be duplicated in separate legacy files.

---

## Project status

KEFE Visualiser is actively developed.

`main` is the current production branch.

The frontend is deployed and functional as a static browser application. Export reliability and browser/device compatibility should continue to be validated as the export pipeline evolves.

---

## Licence

KEFE contains third-party assets and libraries that remain subject to their respective licences.

Refer to [`THIRD-PARTY-LICENSES.md`](THIRD-PARTY-LICENSES.md) and the licence files distributed with individual assets before redistributing third-party material.
