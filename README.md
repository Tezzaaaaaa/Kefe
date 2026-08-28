# KEFE Visualiser

KEFE Visualiser is a browser-based lyric video editor for creating timed lyric compositions with configurable typography, backgrounds, visual effects and local video export.

## What it provides

- Audio and metadata import
- Synced LRC lyric import and editing
- Multiple canvas formats: 9:16, 1:1 and 16:9
- Configurable backgrounds, including colour, gradient, spotlight, aurora, grid and grain treatments
- Modular lyric effects
- Project save/open support
- Browser-based FFmpeg export
- Optional Node.js API for authentication and billing

## Architecture

The repository intentionally keeps the browser application and its supporting Node.js service in the same deployable project.

### Browser application

- `index.html` — application shell and UI structure
- `app.js` — application state, media handling and rendering orchestration
- `styles.css`, `typography.css`, `ui-polish.css`, `design-refresh.css` — presentation layers
- `typography.js` — typography behaviour and configuration
- `background-presets.js` — background preset definitions
- `presets.json` — reusable effect/presentation presets
- `encoder.js` — FFmpeg loading and lifecycle management
- `ffmpeg-worker.js` / `worker.js` — worker support for media processing
- `*effect*.js` / effect renderer files — lyric visual treatments

### Node.js service

- `index.js` — Express application entry point
- `auth.js` — authentication routes and session handling
- `billing.js` — Stripe billing integration
- `entitlements.js` — plan and trial entitlement logic
- `db.js` — SQLite persistence

The Node service is optional for purely local browser use. Authentication and billing require the server and corresponding environment variables.

## Requirements

- Node.js 18 or newer for the optional server
- A modern browser with Canvas, Web Audio and WebAssembly support

## Local development

```bash
npm install
cp .env.example .env
npm run check
npm start
```

Then open `http://localhost:3000`.

For browser-only development, the static application can also be served by any local HTTP server. A local HTTP origin is recommended because browser media, module and WebAssembly behaviour is more reliable than opening `index.html` directly from `file://`.

## Environment

Copy `.env.example` to `.env` and provide the values required for the features you use. Never commit `.env` or production credentials.

Runtime SQLite data is stored in `data/` by default and is intentionally excluded from Git.

## Effects

Each production effect follows the shared renderer contract used by the application. The effect catalogue and implementation notes are documented in the repository's effect documentation.

## Project documentation

- `CHANGELOG.md` — notable project changes
- `CONTRIBUTING.md` — contribution and development conventions
- `DEPLOY.md` — deployment guidance
- `DESIGN-SYSTEM-CHECKLIST.md` — visual consistency checklist
- `EFFECT-APP-IMPLEMENTATION.md` — effect integration notes
- `EFFECT_TYPOGRAPHY.md` — effect typography conventions
- `THIRD-PARTY-LICENSES.md` — third-party asset licensing notes
- `SECURITY.md` — security and production requirements

## Repository standards

Keep production code, configuration, documentation and assets clearly separated by responsibility. Do not commit generated output, runtime data, operating-system metadata, archives or secrets. Prefer small, focused commits using conventional prefixes such as `feat:`, `fix:`, `refactor:`, `docs:`, `chore:` and `test:`.

## License

See the included licensing documentation for third-party assets. Project licensing should be established explicitly before redistributing the application.
