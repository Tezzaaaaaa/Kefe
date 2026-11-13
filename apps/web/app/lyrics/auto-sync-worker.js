/* KEFE auto-sync worker: keep model inference and lyric matching off the editor UI thread. */
importScripts('./auto-sync.js');
self.onmessage = async function (event) {
  var data = event.data || {};
  try {
    if (data.type === 'transcribe') {
      var audio = new Float32Array(data.audio);
      var words = await self.kefeAutoSync.transcribeAudio(audio, data.model, function (status) {
        self.postMessage({ status: status });
      });
      self.postMessage({ result: words });
      return;
    }
    if (data.type === 'align') {
      var result = self.kefeAutoSync.align(data.asr, data.text, data.meta || {});
      self.postMessage({ result: result });
      return;
    }
    throw new Error('Unknown auto-sync worker operation.');
  } catch (error) {
    self.postMessage({ error: error && error.message ? error.message : String(error) });
  }
};
