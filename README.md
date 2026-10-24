# KEFE — Lyric Visualiser

KEFE is a browser-based music visualiser and lyric-video editor for creating lyric videos and audio-reactive visualisations from your own audio or video. It combines a playback preview, timed lyric treatments, song artwork and metadata, visualiser scenes, and video export in one editor.

## Open KEFE

**[Launch KEFE Editor](https://tezzaaaaaa.github.io/Kefe/)**

- **Repository:** [Tezzaaaaaa/Kefe](https://github.com/Tezzaaaaaa/Kefe)
- **Deployment:** GitHub Pages
- **Active branch:** `main`

## Current state

The editor foundation, lyric-effect system, canvas-based lyric/title-card composition and visualiser engines are implemented. KEFE remains under active development: connected workflows still need verification and refinement, particularly song identification, automatic artwork and lyrics retrieval, lyric timing and rendering, effect controls, visualiser settings, responsive behaviour and export.

The preview combines the lyric/title-card canvas with a dedicated visualiser canvas. The title card is designed to show the selected track's title, artist, album/year details and artwork, remain visible as the lyrics begin, and then move to a compact position above the lyrics. Behaviour can depend on the selected track, browser and available media services.

## Features

### Media and track details

- Load an audio or video file as the source media.
- Supported formats include MP3, M4A, WAV, AAC, FLAC, OGG, Opus, AIFF, CAF, MP4, MOV, M4V, WebM and AVI, subject to browser support.
- Add an optional background video.
- Search for tracks and albums, review the results and select the correct recording.
- Review or edit the track title, artist, album and year.
- Use available track metadata and album artwork when supplied by search results or external services.

### Lyrics and timing

- Load and edit timed lyrics.
- Adjust lyric timing with a global offset.
- Use the lyric timing editor to adjust line and word start times, create pickups and held words, split or merge lines, insert or delete content, undo edits and follow playback.
- Import enhanced LRC files with word-level timing tags.
- Download lyrics as LRC, SRT or timed JSON.
- Choose a lyric display mode: Line, Word, Karaoke or Chunk.
- Apply capitalisation options and a shared lyric style layer across effects.

### Lyric effects

The editor includes 35 lyric effects:

- Karaoke
- Bounce Karaoke
- Apple
- Brat
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
- Trailer
- Fancy
- Glitch
- Split-Flap
- CRT Computer Desktop
- CRT TV Box
- Randomise
- Spin Lyrics
- Devotion
- Dust Off
- WrapSlide
- Eternal Sunshine
- Ink Script
- Liquid Chrome
- Gel Script

Effects provide different animation and typography treatments. Available controls depend on the selected effect. Use the shared style controls for colours, text size, placement, outline, glow, custom text and logo, with font overrides where available.

### Preview and visualiser

- Preview playback, scrub through the timeline and view the composition fullscreen.
- Switch the composition aspect ratio between 16:9, 9:16 and 1:1.
- Switch between the Liquid Flow, Fluted Glass and Slow Light visualisers.
- Use the available presets and controls for each visualiser.
- Visualiser output responds to source audio where supported and is included in video exports.

### Video formats and export

- Choose a video type preset, including lyric video, full-song visualiser, cover-art video and vertical release cut.
- Choose 720p, 1080p, 1440p (2K) or 2160p (4K) output, subject to browser and device limits.
- Export as WebM or MP4 (H.264/AAC where supported).
- Review the composition with the pre-export checklist and phone-size preview.

Export formats and encoding options depend on browser APIs, codec support, device performance and available resources. Test the rendered file before relying on it for publication.

## Quick start

1. Open [KEFE Editor](https://tezzaaaaaa.github.io/Kefe/). Media, lyrics, effects, visualisers, settings and export are all part of this single workspace.
2. In **Media**, load an audio or video file.
3. Use **Find your song** to search for and select the correct track, then check the metadata and artwork.
4. Load or review the lyrics and correct their timing where needed.
5. Choose a lyric effect and customise its typography and style.
6. Select a visualiser scene, adjust its parameters and set the aspect ratio.
7. Preview the composition, open **Export**, review the settings and render the video.

Track matches, artwork and synchronised lyrics depend on the selected track and the availability of external services or data. Automatic retrieval should be checked rather than assumed to have succeeded.

## Project structure

```text
apps/web/       Unified static editor/workspace (deployed via GitHub Pages)
apps/api/       Express API
packages/       Shared API spec, schemas, client and database packages
docs/           Architecture notes and design references
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the editor's file layout, key files and development commands.


## Licensing

KEFE-authored code and documentation are licensed under the [MIT License](LICENSE). This does **not** automatically cover third-party libraries, bundled fonts, artwork, trademarks or other assets. Review [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the current inventory and outstanding checks before redistribution.

## Releases and downloadable packages

The repository includes a GitHub Actions workflow that assembles the browser-based editor into **ZIP** and **tar.gz** packages and creates a **draft prerelease** for review. The draft is intentional: verify bundled-font ownership and third-party license notices in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) before publishing it publicly.

To prepare a draft, open **Actions → Package KEFE release → Run workflow** and enter a version such as `v0.1.0-beta.1`. The workflow attaches both archives to the draft release. KEFE is currently distributed as a static browser application, not as a public npm package; the workspace package manifests remain private.

## Development status

The next priority is verifying and refining the connected systems end to end: media identification, lyrics and artwork retrieval, consistent lyric/title-card layout across aspect ratios, effect controls, visualiser presets and parameters, mobile layout, and reliable export.

KEFE is a creative music visualiser and lyric-video editor, not a music chart application.
