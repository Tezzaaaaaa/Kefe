require('dotenv').config();

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const { router: authRouter, attachUser } = require('./auth');
const buildBillingRouter = require('./billing');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = __dirname;

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be configured in production.');
}

app.disable('x-powered-by');
app.use(cookieParser());
app.use(attachUser);

// Stripe webhook must receive the raw request body for signature verification.
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
app.use('/api/billing', express.json());
app.use('/api/billing', buildBillingRouter());

app.use(express.json());
app.use('/api/auth', authRouter);

// Serve the browser application from the repository root.
app.use(express.static(ROOT_DIR, { extensions: ['html'] }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'kefe-visualiser' });
});

app.listen(PORT, () => {
  console.log(`KEFE Visualiser running on http://localhost:${PORT}`);
});
