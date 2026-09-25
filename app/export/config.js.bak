// KEFE export quality configuration. Kept separate so the UI and encoder can share one source of truth.
export const QUALITY_PRESETS = Object.freeze({
  low: { label: 'Low', description: 'Fast export · social drafts', crf: 28, videoBitrate: '1M', audioBitrate: '96k' },
  medium: { label: 'Medium', description: 'Balanced · recommended', crf: 23, videoBitrate: '3M', audioBitrate: '128k' },
  high: { label: 'High', description: 'Best for YouTube', crf: 18, videoBitrate: '8M', audioBitrate: '192k' },
  ultra: { label: 'Ultra', description: 'Maximum quality', crf: 15, videoBitrate: '16M', audioBitrate: '320k' },
  lossless: { label: 'Lossless', description: 'Visually lossless · very large files', crf: 0, videoBitrate: null, audioBitrate: '320k' }
});

export function getQualityPreset(name = 'medium') {
  return QUALITY_PRESETS[name] || QUALITY_PRESETS.medium;
}

// Trigger the export-upgrade wiring workflow after initial module creation.
