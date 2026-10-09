# KEFE Visualiser

KEFE is a browser-based editor for creating lyric videos and music visualisers. Upload a track, identify the song, work with synchronized lyrics, customise the lyric treatment and visualiser, then export the composition.

## Open the site

**[Launch KEFE Visualiser](https://tezzaaaaaa.github.io/Kefe/)**

The live site is served from the `main` branch through GitHub Pages.

## Current features

### Media and song details
- Upload an audio or video file as the master track.
- Supported file types include MP3, M4A, WAV, AAC, FLAC, OGG, Opus, AIFF, CAF, MP4, MOV, M4V, WebM and AVI, subject to browser support.
- Optionally add a background video.
- Search songs and albums, browse results, and select the correct recording.
- Edit the song title, artist, album and year; selected search results can supply album artwork and track metadata.

### Synchronized lyrics
- Load synchronized lyrics after identifying a song.
- Review and edit the lyric text.
- Adjust all lyric timing earlier or later with the timing offset control.
- Choose from the available lyric effects, including Apple Music-style focus lyrics, Karaoke, Typewriter, Aurora, Brat, Eternal Sunshine, Instagram, Fade Up, Decrypt, Blur In, Shiny, Glitch and other treatments.
- Use the effect's font or select an available font override.

### Preview and visualiser
- Preview the composition with playback controls and a seekable timeline.
- Switch the preview between 16:9, 9:16 and 1:1 aspect ratios.
- Use the particle visualiser presets, randomise the scene, or describe a visualiser to generate a scene.
- Adjust particle count, speed, auto-spin and available effect parameters.
- View the composition in fullscreen.

### Export
- Export the current preview composition as WebM or MP4 where supported by the browser and its recording/encoding capabilities.
- Choose 720p or 1080p output.

## Using KEFE

1. Open the [live site](https://tezzaaaaaa.github.io/Kefe/).
2. In **Media**, upload an audio or video file.
3. Use **Find your song** to search for and select the correct song or album, then check the song details.
4. Review the lyrics and adjust their timing if needed.
5. Choose a lyric effect and customise the visualiser.
6. Preview the result, choose an aspect ratio, then open **Export** to render the video.

Availability and results for song searches, artwork and synchronized lyrics depend on the external services and data available for the selected track. MP4 export also depends on browser support.

## Repository

- **Source:** [Tezzaaaaaa/Kefe on GitHub](https://github.com/Tezzaaaaaa/Kefe)
- **Live site:** [tezzaaaaaa.github.io/Kefe](https://tezzaaaaaa.github.io/Kefe/)
- **Active branch:** `main`

The root `index.html` redirects to the deployed editor in `artifacts/kefe-visualiser/public/legacy/`.
