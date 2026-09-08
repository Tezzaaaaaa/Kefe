require('dotenv').config();

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const { router: authRouter, attachUser } = require('./auth');
const buildBillingRouter = require('./billing');

const app = express();
// The frontend lives in the repository root, one level above this file.
const ROOT_DIR = path.join(__dirname, '..');
const PORT = Number(process.env.PORT) || 3000;

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be configured in production.');
}

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Permissions-Policy',
    'camera=(), geolocation=(), microphone=(), payment=(self)',
  );
  if (req.secure || process.env.NODE_ENV === 'production') {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains',
    );
  }
  next();
});
app.use(cookieParser());
app.use(attachUser); // populates req.user from the session cookie on every route

// Stripe webhook needs the raw request body for signature verification,
// so it's scoped to raw parsing BEFORE the JSON parser is applied to the
// rest of /api/billing.
app.use('/api/billing/webhook', express.raw({ type: 'application/json', limit: '256kb' }));
app.use('/api/billing', express.json({ limit: '256kb' }));
app.use('/api/billing', buildBillingRouter());

app.use(express.json({ limit: '256kb' }));
app.use('/api/auth', authRouter);
app.use('/api', require('./transcribe'));
app.use('/api', require('./remove-background'));

// Everything else (frontend) is static.
app.use(express.static(ROOT_DIR, { extensions: ['html'] }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'kefe-visualiser' });
});

app.listen(PORT, () => {
  console.log(`KEFE Visualiser running on http://localhost:${PORT}`);
});
