require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const { router: authRouter, attachUser } = require('./auth');
const buildBillingRouter = require('./billing');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cookieParser());
app.use(attachUser); // populates req.user from the session cookie on every route

// Stripe webhook needs the raw request body for signature verification,
// so it's scoped to raw parsing BEFORE the JSON parser is applied to the
// rest of /api/billing.
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
app.use('/api/billing', express.json());
app.use('/api/billing', buildBillingRouter());

app.use(express.json());
app.use('/api/auth', authRouter);

// Everything else (frontend) is static.
app.use(express.static(path.join(__dirname, '..'), { extensions: ['html'] }));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`KEFE Visualiser running on http://localhost:${PORT}`);
});
