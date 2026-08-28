const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');
const { getEntitlement, newTrialEndDate } = require('./entitlements');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn('[auth] WARNING: JWT_SECRET is not set. Set it in your .env before going live.');
}
const COOKIE_NAME = 'kefe_session';
const isProd = process.env.NODE_ENV === 'production';

function signToken(userId) {
  return jwt.sign({ uid: userId }, JWT_SECRET || 'dev-insecure-secret', { expiresIn: '30d' });
}

function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

// Middleware: attaches req.user if a valid session cookie is present. Does not block.
function attachUser(req, res, next) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (!token) return next();
  try {
    const payload = jwt.verify(token, JWT_SECRET || 'dev-insecure-secret');
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.uid);
    if (user) req.user = user;
  } catch (err) {
    // invalid/expired token — treat as logged out
  }
  next();
}

// Middleware: requires a logged-in user.
function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not signed in' });
  next();
}

function publicUser(user) {
  const ent = getEntitlement(user);
  return {
    id: user.id,
    email: user.email,
    createdAt: user.created_at,
    plan: ent.plan,
    isPro: ent.isPro,
    trialEndsAt: ent.trialEndsAt,
    trialDaysLeft: ent.daysLeft,
    hasStripeCustomer: !!user.stripe_customer_id,
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/signup', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address' });
  if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'An account with that email already exists' });

  const hash = bcrypt.hashSync(password, 10);
  const trialEndsAt = newTrialEndDate();
  const info = db.prepare(
    'INSERT INTO users (email, password_hash, trial_ends_at, plan_status) VALUES (?, ?, ?, ?)'
  ).run(email.toLowerCase(), hash, trialEndsAt, 'trialing');

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  setSessionCookie(res, signToken(user.id));
  res.status(201).json({ user: publicUser(user) });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect email or password' });
  }

  setSessionCookie(res, signToken(user.id));
  res.json({ user: publicUser(user) });
});

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  if (!req.user) return res.json({ user: null });
  res.json({ user: publicUser(req.user) });
});

module.exports = { router, attachUser, requireAuth, publicUser };
