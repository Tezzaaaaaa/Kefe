// KEFE local bootstrap for @ffmpeg/ffmpeg 0.12.15.
// Keeping this worker on the same origin avoids the browser resolving
// the package's relative ./worker.js from a CDN/blob URL.
import 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm/worker.js';
