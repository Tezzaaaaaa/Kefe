/* KEFE server-side speech transcription (optional).
 *
 * Powers the "KEFE server API" provider in the browser Caption Generator.
 * The API key lives ONLY in the server environment — it is never sent to,
 * stored in, or committed with the frontend. Any OpenAI-compatible
 * transcription endpoint works (default: OpenAI whisper-1, verbose_json so
 * the client receives word/segment timestamps).
 *
 * Configure via .env:
 *   TRANSCRIBE_API_KEY   (required to enable; route returns 501 without it)
 *   TRANSCRIBE_API_URL   (default https://api.openai.com/v1/audio/transcriptions)
 *   TRANSCRIBE_MODEL     (default whisper-1)
 */
'use strict';

const express = require('express');

const router = express.Router();

router.post('/transcribe', express.raw({ type: '*/*', limit: '30mb' }), async (req, res) => {
  const apiKey = process.env.TRANSCRIBE_API_KEY;
  if (!apiKey) {
    return res.status(501).json({
      error: 'Server transcription is not configured. Set TRANSCRIBE_API_KEY (and optionally TRANSCRIBE_API_URL / TRANSCRIBE_MODEL) on the server, or use the local in-browser engine.'
    });
  }
  if (!req.body || !req.body.length) {
    return res.status(400).json({ error: 'No audio data received.' });
  }

  const upstreamUrl = process.env.TRANSCRIBE_API_URL || 'https://api.openai.com/v1/audio/transcriptions';
  const model = process.env.TRANSCRIBE_MODEL || 'whisper-1';

  try {
    const form = new FormData();
    form.append('file', new Blob([req.body]), `audio${req.headers['content-type'] === 'audio/wav' ? '.wav' : '.bin'}`);
    form.append('model', model);
    form.append('response_format', 'verbose_json');
    form.append('timestamp_granularities[]', 'segment');
    form.append('timestamp_granularities[]', 'word');

    const upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form
    });
    const payload = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      const message = payload?.error?.message || `Upstream transcription error (${upstream.status}).`;
      return res.status(upstream.status === 401 ? 502 : upstream.status).json({ error: message });
    }
    return res.json(payload);
  } catch (error) {
    console.error('[transcribe] request failed:', error.message);
    return res.status(502).json({ error: 'The transcription request failed upstream.' });
  }
});

module.exports = router;
