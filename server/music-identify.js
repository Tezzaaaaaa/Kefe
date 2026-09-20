/* KEFE automatic music identification for MiniPlayer. */
'use strict';

const express = require('express');
const router = express.Router();

router.post('/music-identify', express.raw({ type: '*/*', limit: '10mb' }), async (req, res) => {
  const apiToken = process.env.AUDD_API_TOKEN;
  if (!apiToken) {
    return res.status(501).json({ error: 'Automatic song identification is not configured. Set AUDD_API_TOKEN on the server.' });
  }
  if (!req.body || !req.body.length) {
    return res.status(400).json({ error: 'No audio data received.' });
  }
  try {
    const form = new FormData();
    const contentType = String(req.headers['content-type'] || 'application/octet-stream');
    form.append('api_token', apiToken);
    form.append('return', 'apple_music,spotify');
    form.append('market', 'au');
    form.append('file', new Blob([req.body], { type: contentType }), 'kefe-audio');
    const upstream = await fetch('https://api.audd.io/', { method: 'POST', body: form });
    const payload = await upstream.json().catch(() => null);
    if (!upstream.ok || payload?.status === 'error') {
      const code = payload?.error?.error_code;
      const message = payload?.error?.error_message || payload?.error || 'Music recognition failed upstream.';
      return res.status(code === 400 ? 413 : upstream.status >= 500 ? 502 : 422).json({ error: message });
    }
    const result = payload?.result;
    if (!result) return res.json({ match: null });
    const appleArtwork = result.apple_music?.artwork?.url || '';
    const spotifyArtwork = result.spotify?.album?.images?.[0]?.url || '';
    return res.json({
      match: {
        title: result.title || '',
        artist: result.artist || '',
        album: result.album || result.apple_music?.albumName || result.spotify?.album?.name || '',
        artwork: appleArtwork || spotifyArtwork || result.thumbnail_url || ''
      }
    });
  } catch (error) {
    console.error('[music-identify] request failed:', error.message);
    return res.status(502).json({ error: 'The music recognition request failed upstream.' });
  }
});

module.exports = router;
