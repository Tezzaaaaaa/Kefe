// KEFE export configuration — single source of truth.
export const ASPECTS = Object.freeze({
  '9:16': { label: '1080 × 1920 (Vertical)' },
  '1:1':  { label: '1080 × 1080 (Square)' },
  '16:9': { label: '1920 × 1080 (Horizontal)' }
});

export const RESOLUTIONS = Object.freeze({
  '480p':  { '9:16': [480, 854],  '1:1': [480, 480],  '16:9': [854, 480]  },
  '720p':  { '9:16': [720, 1280], '1:1': [720, 720],  '16:9': [1280, 720] },
  '1080p': { '9:16': [1080,1920], '1:1': [1080,1080], '16:9': [1920,1080] }
});

export const QUALITY_PRESETS = Object.freeze({
  low:     { label: 'Low',     description: 'Fast export · social drafts', crf: 28, videoBitrate:  1_000_000, audioBitrate:  96_000 },
  medium:  { label: 'Medium',  description: 'Balanced · recommended',       crf: 23, videoBitrate:  3_000_000, audioBitrate: 128_000 },
  high:    { label: 'High',    description: 'Best for YouTube',             crf: 18, videoBitrate:  8_000_000, audioBitrate: 192_000 },
  ultra:   { label: 'Ultra',   description: 'Maximum quality',              crf: 15, videoBitrate: 16_000_000, audioBitrate: 320_000 },
  maximum: { label: 'Maximum', description: 'Visually lossless · very large files', crf: 10, videoBitrate: 40_000_000, audioBitrate: 320_000 }
});

export function normaliseQuality(name) {
  if (name === 'lossless') return 'maximum';
  return QUALITY_PRESETS[name] ? name : 'medium';
}

export const SOCIAL_PRESETS = Object.freeze({
  instagram: { resolution: '1080p', aspect: '9:16', fps: 30 },
  tiktok:    { resolution: '1080p', aspect: '9:16', fps: 30 },
  youtube:   { resolution: '1080p', aspect: '16:9', fps: 30 }
});

export const CODEC = Object.freeze({
  video: 'avc1.640028',
  audio: 'mp4a.40.2',
  container: 'mp4'
});

export function getQualityPreset(name = 'medium') {
  const key = normaliseQuality(name);
  return { key, ...QUALITY_PRESETS[key] };
}

// Positional (preset, aspect) accepted for backwards compat.
export function getExportConfig(opts = {}) {
  if (typeof opts === 'string') {
    const preset = opts;
    const aspect = arguments[1] || '9:16';
    return getExportConfig({ preset, aspect });
  }

  const base = opts.preset && SOCIAL_PRESETS[opts.preset]
    ? { ...SOCIAL_PRESETS[opts.preset], ...opts, preset: opts.preset }
    : opts;

  const resolutionKey = RESOLUTIONS[base.resolution] ? base.resolution : '720p';
  const aspectKey = ASPECTS[base.aspect] ? base.aspect : '9:16';
  const [width, height] = RESOLUTIONS[resolutionKey][aspectKey];
  const fps = Number.isFinite(base.fps) ? base.fps : 30;
  const quality = getQualityPreset(base.quality);

  return Object.freeze({
    preset: base.preset || null,
    resolution: resolutionKey,
    aspect: aspectKey,
    quality: quality.key,
    width, height, fps,
    videoCodec: CODEC.video,
    videoBitrate: quality.videoBitrate,
    audioCodec: CODEC.audio,
    audioBitrate: quality.audioBitrate,
    crf: quality.crf,
    container: CODEC.container
  });
}
