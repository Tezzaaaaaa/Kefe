/* Dedicated worker: keep quadratic lyric matching off the editor's UI thread. */
importScripts('./auto-sync.js');
self.onmessage = function (event) {
  var data = event.data || {};
  try {
    var api = self.kefeAutoSync;
    if (!api || typeof api.align !== 'function') throw new Error('Lyric alignment engine did not initialise.');
    var result = api.align(data.asr, data.text, data.meta || {});
    self.postMessage({ result: result });
  } catch (error) {
    self.postMessage({ error: error && error.message ? error.message : String(error) });
  }
};
