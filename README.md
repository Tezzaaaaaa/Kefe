# KEFE Visualiser

KEFE Visualiser is a browser-based music visualiser and lyric/caption video editor. It combines timed text, typography, backgrounds, visual effects, media, live preview, project files, and local MP4 export in one editor.

**Live application:** https://tezzaaaaaa.github.io/Kefe/

## Current editor

KEFE is the visualiser application itself. There is no separate landing page or home page; the repository's `index.html` loads the editor directly.

The editor is organised around five production sections:

1. **Media** — audio input, metadata, and media-source handling.
2. **Format** — aspect ratio, output presets, project save/open, and export.
3. **Lyrics & Captions** — lyrics, captions, timing, and text styling.
4. **Background** — built-in backgrounds plus custom image/video media.
5. **Visual FX** — post-render effects applied independently of the lyric renderer.

## Lyric effects

The current editor exposes eight lyric treatments:

- **Apple**
- **Brat**
- **Eternal Sunshine**
- **Aurora**
- **Pulse**
- **Typewriter**
- **Instagram Lyrics**
- **Fade Up**

Effects are registered through the shared KEFE rendering architecture. Canonical/native renderers and modular effect implementations share common timing, typography, and canvas utilities rather than maintaining duplicate render pipelines.

## Backgrounds

The editor currently provides six built-in background choices:

- Solid colour
- Soft Gradient
- Spotlight
- Aurora Wash
- Fine Grid
- Film Grain

Users can also supply their own image or video background. Aurora Wash includes the current native WebGL Aurora FX implementation.

## Visual FX

Visual FX are applied as a separate post-render layer. The current selector provides:

- Off
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

This separation allows lyric rendering and post-processing to evolve independently and keeps the export path shared.

## Lyrics, captions and timing

KEFE supports:

- LRC import
- Text lyric editing/pasting
- Automatic lyric lookup
- Manual timing adjustment and offset nudging
- Caption generation and caption-block editing
- Word-level timing where available
- Derived timing and music-aware style recommendations
- Video-as-master audio/timing workflows

## Media and projects

KEFE works with browser-loaded audio, images, and video. A background video containing audio can act as the master audio source when appropriate.

Projects can be saved and reopened as `.kefe` / JSON-compatible project files.

## Export

The export system is separated from the editor and handles:

- Pre-export validation
- 9:16, 1:1, and 16:9 output
- Resolution/output presets
- Frame-by-frame canvas rendering
- Browser-based FFmpeg encoding
- Same-origin FFmpeg worker loading
- MP4 muxing and audio/video handling
- Progress reporting and cancellation
- Diagnostic export errors
- Automatic filenames ending in `- KEFE Visualiser.mp4`

Rendering and encoding are performed locally in the browser. KEFE does not require uploaded media to be sent to a KEFE rendering server.

## Technology

### Frontend

- HTML
- CSS
- JavaScript
- Canvas 2D rendering
- Native WebGL visual FX where required
- Browser media APIs
- Web Workers
- FFmpeg.wasm

### Backend

The repository also contains a separate Node.js backend architecture for functionality that cannot be provided by static GitHub Pages, including authentication, membership/billing, database access, transcription, and related server functionality.

- Node.js 18+
- Express
- SQLite / `better-sqlite3`
- JWT
- `bcryptjs`
- Stripe
- `cookie-parser`
- `dotenv`

The backend is separate from the GitHub Pages frontend and requires a Node-capable deployment environment.

## Repository structure

```text
Kefe/
├── app/
│   ├── core/       # analysis, project, rendering, runtime and creation logic
│   ├── effects/    # lyric renderers, Visual FX and effect data
│   ├── export/     # browser video export pipeline
│   ├── ui/         # editor UI modules and controls
│   └── app.js      # main frontend application module
├── assets/         # branding and static assets
├── docs/           # deployment, design, licensing and development documentation
├── fonts/          # local production font files
├── scripts/        # integrity, smoke and verification tooling
├── server/         # Node backend
├── tests/          # smoke and functional tests
├── vendor/         # locally hosted third-party runtime assets
├── .github/        # CI/CD and repository quality workflows
├── .husky/         # local Git hooks
├── index.html      # editor document
├── package.json    # scripts and dependencies
├── CHANGELOG.md
├── CONTRIBUTING.md
└── README.md
```

Repository-level configuration files such as `.gitignore`, `.prettierrc.json`, `.prettierignore`, `.mega-linter.yml`, and `.env.example` remain at the root because they are consumed directly by development, CI, formatting, environment, or tooling workflows.

## Running locally

```bash
git clone https://github.com/Tezzaaaaaa/Kefe.git
cd Kefe
npm install
npm start
```

The Node server is provided by `server/index.js`. `npm run dev` currently starts the same server.

For the static frontend, serve the repository through an HTTP server. Do not open `index.html` directly with `file://`; browser modules, media APIs, and export behaviour require an HTTP origin.

## Validation

Run the repository checks with:

```bash
npm run check
```

Additional test commands are available for smoke and functional coverage:

```bash
npm run test:smoke
npm run test:functional
```

Formatting checks are available with:

```bash
npm run format:check
```

Automated checks do not replace real browser export testing. FFmpeg export should be tested in target browsers, particularly Safari on iOS/iPadOS, before treating a release as fully production-validated.

## FFmpeg

FFmpeg integration is isolated under `app/export/` and uses a same-origin worker bootstrap under `vendor/ffmpeg/`.

The current runtime uses:

- `@ffmpeg/ffmpeg` 0.12.15
- `@ffmpeg/core` 0.12.10

## Effect architecture

Lyric effects live under `app/effects/` and use the shared KEFE effect architecture. Shared timing, typography, and drawing helpers are kept in `app/effects/core.js`.

The separate Visual FX layer is implemented in `app/effects/effect-app-fx.js` and is applied after the primary lyric renderer.

Effect documentation is maintained alongside the implementation in `app/effects/README.md` and `app/effects/EFFECT-APP-IMPLEMENTATION.md`.

The repository also contains a public Effect.app catalogue as reference data. KEFE-native implementations remain independent; proprietary renderer source and undisclosed Effect.app defaults are not copied into the project.

## Typography and licensing

Production fonts are stored locally under `fonts/` so effects have predictable typography without depending on a remote font service.

Licensing documentation is maintained under `docs/`, with the SIL Open Font License text retained at the repository root in `OFL.txt`.

Third-party assets and libraries remain subject to their respective licences. See `docs/THIRD-PARTY-LICENSES.md` and the relevant licence files before redistributing third-party material.

## Deployment

The frontend is deployed from `main` through GitHub Pages:

https://tezzaaaaaa.github.io/Kefe/

The workflow is located at `.github/workflows/github-pages.yml`.

The Node backend is not hosted by GitHub Pages and must be deployed separately when backend functionality is enabled.

See `docs/DEPLOY.md` for deployment details.

## Development documentation

| Document | Purpose |
|---|---|
| `CHANGELOG.md` | Project changes and release history |
| `CONTRIBUTING.md` | Contribution guidance |
| `docs/DEPLOY.md` | Deployment information |
| `docs/DESIGN-SYSTEM-CHECKLIST.md` | Design-system and QA checks |
| `docs/EFFECT_TYPOGRAPHY.md` | Effect typography rules |
| `app/effects/README.md` | Effect-system documentation |
| `app/effects/EFFECT-APP-IMPLEMENTATION.md` | Effect implementation notes |
| `docs/THIRD-PARTY-LICENSES.md` | Third-party licensing information |

## Project status

KEFE Visualiser is actively developed. `main` is the current production branch, and the browser frontend is deployed through GitHub Pages.

The current codebase includes the editor, lyric/caption workflows, native effect system, background system, post-render Visual FX, project files, local MP4 export pipeline, automated checks, and a separate Node backend architecture.

Export reliability and browser/device compatibility remain ongoing validation areas as the rendering and export pipeline evolves.
