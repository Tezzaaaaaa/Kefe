# Getting KEFE live with memberships

The app now has a real backend: email/password accounts, a 7-day free trial
with full access, and a Stripe-powered Pro subscription. Free accounts (after
trial) are locked out of: Eternal, Aurora, Instagram Lyrics and Fade Up
effects, plus 1080p/Instagram/TikTok export presets. Everything else stays
free forever.

You need to do three things before it's genuinely live. Nothing below needs
coding — it's account setup and one deploy.

## 1. Create your Stripe product + get three values

1. Sign up / log in at https://dashboard.stripe.com
2. Products → Add product → name it "KEFE Pro", set your price (e.g.
   monthly recurring). Save it, then copy the **Price ID** (starts `price_`).
3. Developers → API keys → copy your **Secret key** (starts `sk_live_` once
   you're out of test mode, `sk_test_` while testing).
4. Developers → Webhooks → Add endpoint → URL =
   `https://YOURDOMAIN.com/api/billing/webhook` → select events
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted` → copy
   the **Signing secret** (starts `whsec_`).

## 2. Configure background removal

KEFE now includes a server-side foreground cutout powered by the remove.bg
Background Removal API. The API key is deliberately kept on the Node server;
it is never placed in frontend JavaScript.

Add this environment variable to the same Railway/Render service:

`REMOVE_BG_API_KEY=...`

The first 50 remove.bg API calls per month are currently free. The remove.bg
documentation also states that background removal moves to Leonardo.Ai on
December 1, 2026, so the KEFE provider boundary is isolated in
`server/remove-background.js` for future migration. See the official API docs:
https://www.remove.bg/api

## 3. Pick a host and deploy

Simplest options for a small Node app like this: **Railway** or **Render**
(both have a free/cheap tier, auto-deploy from GitHub, persistent disk for
the SQLite file). Steps are the same shape on either:

1. Push this folder to a GitHub repo.
2. Create a new Web Service on Railway/Render pointed at that repo.
3. Build command: `npm install`. Start command: `npm start`.
4. Add a persistent volume/disk mounted at `/app/data` (or wherever the app
   lives) — this is where the SQLite database file lives. Without it your
   users get wiped on every redeploy.
5. Set the environment variables (see `.env.example`): `JWT_SECRET`,
   `APP_URL` (your real domain, e.g. `https://kefe.app`), `STRIPE_SECRET_KEY`,
   `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, `TRIAL_DAYS` (optional,
   defaults to 7), and `REMOVE_BG_API_KEY`.
6. Deploy. Point your domain's DNS at the host.

## 4. Test it before telling anyone it's live

- Sign up on the live site with a real email.
- Use Stripe's test card `4242 4242 4242 4242`, any future date/CVC, to run a
  full checkout in test mode first if your Stripe account is still in test
  mode.
- Confirm the plan badge in the header flips to "Pro" within a few seconds
  (webhook-driven).
- In the Background section, choose a JPG/PNG/WebP foreground image and click
  **Remove background**. Confirm the transparent subject appears over the
  preview and remains present in the exported video.
- Switch Stripe to live mode and repeat with a real card once you're happy.

## Running it locally to check things first

```
cp .env.example .env      # fill in JWT_SECRET at minimum
npm install
npm start
```

Open http://localhost:3000 — sign-up/login/trial works immediately even
without Stripe configured. Checkout will return a friendly "billing not
configured" message until you add the three Stripe values. Background removal
will return a clear configuration error until `REMOVE_BG_API_KEY` is set.
