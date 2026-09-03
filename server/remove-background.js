/* KEFE server-side background removal.
 * The browser talks only to this route. The actual inference runs on KEFE's
 * self-hosted Lucida service; no remove.bg API key or third-party image API is used.
 */
'use strict';

const express = require('express');

const router = express.Router();
const MAX_IMAGE_BYTES = 22 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const LUCIDA_URL = (process.env.LUCIDA_URL || 'http://127.0.0.1:8756').replace(/\/$/, '');

router.get('/remove-background/health', async (_req, res) => {
  try {
    const upstream = await fetch(`${LUCIDA_URL}/health`);
    const payload = await upstream.json().catch(() => ({}));
    return res.status(upstream.ok ? 200 : 503).json({
      ok: upstream.ok,
      provider: 'lucida',
      ...payload
    });
  } catch (error) {
    return res.status(503).json({
      ok: false,
      provider: 'lucida',
      error: 'Background-removal service is unavailable.'
    });
  }
});

router.post('/remove-background', express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '22mb' }), async (req, res) => {
  const contentType = String(req.headers['content-type'] || '').split(';')[0].toLowerCase();
  if (!ALLOWED_TYPES.has(contentType)) {
    return res.status(415).json({ error: 'Use a JPG, PNG, or WebP image.' });
  }
  if (!Buffer.isBuffer(req.body)) {
    return res.status(400).json({ error: 'Invalid image payload.' });
  }
  if (!req.body.length) {
    return res.status(400).json({ error: 'No image data received.' });
  }
  if (req.body.length > MAX_IMAGE_BYTES) {
    return res.status(413).json({ error: 'Image is too large. Maximum size is 22 MB.' });
  }

  try {
    const extension = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
    const form = new FormData();
    form.append('file', new Blob([req.body], { type: contentType }), `kefe-input.${extension}`);

    const upstream = await fetch(`${LUCIDA_URL}/remove`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(120000)
    });

    if (!upstream.ok) {
      const payload = await upstream.json().catch(() => ({}));
      const message = payload?.detail || payload?.error || `Background removal failed (${upstream.status}).`;
      return res.status(upstream.status >= 500 ? 502 : upstream.status).json({ error: message });
    }

    const result = Buffer.from(await upstream.arrayBuffer());
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'no-store');
    return res.send(result);
  } catch (error) {
    console.error('[remove-background] Lucida request failed:', error.message);
    return res.status(502).json({ error: 'The background-removal service is unavailable.' });
  }
});

module.exports = router;
