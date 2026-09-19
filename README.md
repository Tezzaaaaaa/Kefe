# KEFE Visualiser

**KEFE Visualiser** is a browser-based lyric video editor. Drop in a song, add lyrics or captions, pick an effect, and export an MP4 — all locally, without sending your media anywhere.

**Try it:** https://tezzaaaaaa.github.io/Kefe/

---

## What you can make

- **Lyric videos** — timed lyrics with 27 built-in effects (Apple, Brat, Karaoke, Split-Flap, Chromatica, and more).
- **Visualisers** — audio-reactive visuals without lyrics. Beat, Ridgeline, and TuffPuff modes.
- **Captioned videos** — timed captions for spoken audio or video, with automatic transcription fallback.

## Features

- **27 lyric effects** — animated typography ranging from clean Apple Music-style focus lines to glitch, split-flap, and chromatic poster stacks.
- **3 visualiser modes** — beat-reactive output, ridgeline terrain, and colourful smoke plumes that respond to the music.
- **Backgrounds** — solid, gradient, spotlight, aura wash, fine grid, film grain, or your own image/video.
- **Visual FX** — VHS, CRT, RGB shift, bloom, motion blur, camera shake, glitch, halftone, vignette, mixed media, applied as a post-render layer.
- **Lyrics & captions** — LRC import, lyric lookup, manual timing, Whisper transcription fallback, word-level timing.
- **Local export** — frame-by-frame canvas rendering, browser-based FFmpeg encoding, 9:16 / 1:1 / 16:9 output.
- **Projects** — save and reopen work as `.kefe` files.

Everything runs in your browser. Media is not uploaded to a KEFE rendering server.

## Quick start

Just want to use it? Open the live app:

**https://tezzaaaaaa.github.io/Kefe/**

## Running locally

    git clone https://github.com/Tezzaaaaaa/Kefe.git
    cd Kefe
    npm install
    npm start

Then open the local server in your browser. Don't open `index.html` directly with `file://` — the app needs an HTTP origin for modules, media APIs, and export.

## Development

    npm run check
    npm run test:smoke
    npm run test:functional
    npm run format:check

## More documentation

| Document | What's in it |
|---|---|
| docs/ARCHITECTURE.md | Repo layout, effect system, FFmpeg pipeline, backend, security |
| docs/EFFECTS.md | Full list of lyric effects, visualisers, backgrounds, visual FX |
| docs/DEPLOY.md | Deployment (GitHub Pages frontend, Node backend) |
| docs/EFFECT_TYPOGRAPHY.md | Typography rules per effect |
| docs/THIRD-PARTY-LICENSES.md | Third-party licensing |
| CONTRIBUTING.md | Contribution guidance |
| CHANGELOG.md | Release history |

## Status

KEFE Visualiser is actively developed. The `main` branch is the current production branch for the browser app. Current work is focused on reliability, browser/device compatibility, and refinement.

## License

See OFL.txt for font licensing. Third-party assets remain subject to their own licences — see docs/THIRD-PARTY-LICENSES.md.
