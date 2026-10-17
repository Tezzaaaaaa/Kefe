(() => {
  'use strict';

  const STORAGE_KEY = 'kefe.settings.v1';

  // key, label, hint, type, default, options
  const SCHEMA = [
    { group: 'Title card', items: [
      { key: 'titleCard', label: 'Show title card', hint: 'Apple Music effect only: artwork and details on their own until 1s before the first lyric, then they move up into the header. Included in exports.', type: 'toggle', def: true }
    ]},
    { group: 'Lyrics', items: [
      { key: 'lyricOffset', label: 'Lyric offset', hint: 'Positive shows lyrics later, negative shows them earlier.', type: 'range', def: 0, min: -3, max: 3, step: 0.05, fmt: v => (v > 0 ? '+' : '') + v.toFixed(2) + 's' }
    ]},
    { group: 'Engine', items: [
      { key: 'fpsTarget', label: 'FPS target', hint: 'Caps how often the visualiser renders in the preview and in exports. Lower it on slower devices.', type: 'range', def: 60, min: 30, max: 120, step: 10, fmt: v => String(v) },
      { key: 'fftPower', label: 'FFT size', hint: 'Audio analysis detail for audio-reactive visuals. Larger is more precise but heavier.', type: 'range', def: 11, min: 9, max: 12, step: 1, fmt: v => String(Math.pow(2, v)) }
    ]},
    { group: 'Defaults', items: [
      { key: 'aspect', label: 'Aspect ratio', hint: 'Used for the preview and exports.', type: 'select', def: '16:9', options: [['16:9', '16:9'], ['9:16', '9:16'], ['1:1', '1:1']] },
      { key: 'exportResolution', label: 'Export resolution', type: 'select', def: '1080', options: [['720', '720p'], ['1080', '1080p'], ['1440', '1440p (2K)'], ['2160', '2160p (4K)']] }
    ]},
  ];

  const defaults = {};
  SCHEMA.forEach(g => g.items.forEach(i => { defaults[i.key] = i.def; }));

  let values = { ...defaults };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (saved && typeof saved === 'object') {
      Object.keys(defaults).forEach(k => {
        if (!(k in saved)) return;
        if (typeof saved[k] === typeof defaults[k]) values[k] = saved[k];
      });
    }
  } catch (_) {}

  const listeners = [];
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(values)); } catch (_) {}
  }
  function set(key, value) {
    if (!(key in defaults) || values[key] === value) return;
    values[key] = value;
    persist();
    listeners.slice().forEach(fn => { try { fn(key, value); } catch (e) { console.warn('[KEFE settings]', e); } });
  }

  window.kefeSettings = {
    get: key => values[key],
    set,
    all: () => ({ ...values }),
    defaults: () => ({ ...defaults }),
    schema: () => SCHEMA.map(group => ({ group: group.group, items: group.items.map(({ key, label, hint, type, def, min, max, step, options }) => ({ key, label, hint, type, def, min, max, step, options })) })),
    reset() { Object.keys(defaults).forEach(k => set(k, defaults[k])); },
    onChange(fn) { if (typeof fn === 'function') listeners.push(fn); }
  };

})();
