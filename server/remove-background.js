/* KEFE server-side background removal.
 * The remove.bg API key is kept exclusively in the server environment.
 */
'use strict';

const express = require('express');

const router = express.Router();
const MAX_IMAGE_BYTES = 22 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

router.post('/remove-background', express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '22mb' }), async (req, res) => {
  const apiKey = process.env.REMOVE_BG_API_KEY;
  if (!apiKey) {
    return res.status(501).json({
      error: 'Background removal is not configured. Set REMOVE_BG_API_KEY on the KEFE server.'
    });
  }

  const contentType = String(req.headers['content-type'] || '').split(';')[0].toLowerCase();
  if (!ALLOWED_TYPES.has(contentType)) {
    return res.status(415).json({ error: 'Use a JPG, PNG, or WebP image.' });
  }
  if (!req.body || !req.body.length) {
    return res.status(400).json({ error: 'No image data received.' });
  }
  if (req.body.length > MAX_IMAGE_BYTES) {
    return res.status(413).json({ error: 'Image is too large. Maximum size is 22 MB.' });
  }

  try {
    const form = new FormData();
    const extension = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
    form.append('image_file', new Blob([req.body], { type: contentType }), `kefe-input.${extension}`);
    form.append('size', 'auto');
    form.append('format', 'png');

    const upstream = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': apiKey },
      body: form
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      let message = `Background removal provider returned ${upstream.status}.`;
      try {
        const payload = JSON.parse(text);
        message = payload?.errors?.[0]?.title || payload?.error || message;
      } catch (_) {}
      return res.status(upstream.status === 401 ? 502 : upstream.status).json({ error: message });
    }

    const result = Buffer.from(await upstream.arrayBuffer());
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'no-store');
    return res.send(result);
  } catch (error) {
    console.error('[remove-background] request failed:', error.message);
    return res.status(502).json({ error: 'The background-removal request failed upstream.' });
  }
});

module.exports = router;
