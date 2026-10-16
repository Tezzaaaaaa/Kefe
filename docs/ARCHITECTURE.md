# Architecture

KEFE is a browser-based music visualiser and lyric-video editor. The editor is a static web app (`apps/web`) with no build step; a small Express API (`apps/api`) and shared workspace packages (`packages/`) are in place for accounts and billing.

## Repository layout

```text
apps/
  web/            Static editor, deployed via GitHub Pages
  api/            Express API (health check only so far)
packages/
  api-spec/       OpenAPI spec and Orval config
  api-zod/        Generated Zod schemas
  api-client-react/  Generated React client
  db/             Drizzle ORM schema and config
docs/
  ARCHITECTURE.md
  reference/      Original design references (not shipped)
.github/workflows/  Browser layout and release checks
```

## Web app (`apps/web`)

```text
index.html        Entry point and script load order
app/
  brand/          Logos, wordmark and favicon
  effects/        Effect manifest, shared core and lyric renderers
  lyrics/         Lyric data model, timing editor and downloads
  visualiser/     Liquid Flow, Dithr, Fluted Glass, Slow Light, backgrounds and audio-reactive rendering
  ui/             Editor structure, styles, typography and lyric style layer
fonts/            Bundled fonts, each with its own licence file
```

### Key files

- `app/editor.js` - editor state, media and lyric handling, canvas rendering, effect dispatch
- `app/effects/manifest.js` - single source of truth for lyric effects
- `app/effects/core.js` - shared utilities (`window.kefeEffectUtils`)
- `app/visualiser/visualiser.js` - visualiser engine, presets and parameters
- `app/visualiser/audio-overlay.js` - shared WebAudio graph for audio-reactive rendering and video export
- `app/lyrics/lyric-model.js` - pure lyric data model (parse, edit, display modes, exports); no DOM
- `app/lyrics/lyric-studio.js` - display modes, timing editor and downloads
- `app/ui/style-layer.js` - colours, size, placement, outline, glow, custom text and logo
- `app/ui/structure.js` - editor sections and controls

### Rules

- Keep `app/effects/core.js` in place and loaded **before** the lyric renderers in `index.html`. Multiple effects depend on it.
- Each effect is registered in `manifest.js` and loaded by a script tag in `index.html`.
- The `?v=` query strings on script and style tags are cache-busters that the CI workflows compare against the live site. Update them when you change the file.

## Development

```bash
pnpm install
pnpm typecheck
python3 -m http.server 4173 --directory apps/web   # run the editor locally
pnpm --filter @workspace/api-server dev            # run the API
```
