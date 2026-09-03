# Getting KEFE live with memberships

The app has a real backend: email/password accounts, a 7-day free trial
with full access, and a Stripe-powered Pro subscription. Free accounts (after
trial) are locked out of: Eternal, Aurora, Instagram Lyrics and Fade Up
effects, plus 1080p/Instagram/TikTok export presets. Everything else stays
free forever.

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

## 2. Configure the self-hosted background remover

KEFE's Background section uses one model only: **Lucida** (`egeorcun/lucida`).
The Node server proxies the browser request to a separate Lucida inference
service. No remove.bg API key is required and image data is not sent to
remove.bg.

Build the service from `background-remover/Dockerfile` and expose port `8756`.
Set the Node service's `LUCIDA_URL` to the internal/private URL of that
service, for example:

`LUCIDA_URL=http://lucida:8756`

For local development:

```bash
cd background-remover
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8756
```

Then run KEFE in another terminal with `LUCIDA_URL=http://127.0.0.1:8756`.
The first inference downloads the Lucida model weights; subsequent requests
reuse the loaded model. GPU hosts are recommended for production throughput.

Lucida's released v7 weights are the selected KEFE model. Its upstream
benchmark reports the lowest overall MAE among the tested models in its
203-image comparison, while documenting that other models can still win on
specific cases such as some hair, thin-structure, or complex-scene inputs.

## 3. Pick a host and deploy

KEFE now has two runtime services when server-side background removal is
enabled: the existing Node application and the Lucida inference service.
They can run as two services on Railway/Render or equivalent infrastructure.
Keep the Lucida service private; only the Node application needs public HTTP.

1. Push this repository to GitHub.
2. Deploy the Node application with build command `npm install` and start
   command `npm start`.
3. Deploy `background-remover/` using its Dockerfile and expose port `8756`
   internally.
4. Set `LUCIDA_URL` on the Node service to the private Lucida service URL.
5. Add the existing application variables from `.env.example`, including
   `JWT_SECRET`, `APP_URL`, Stripe settings, and `TRIAL_DAYS`.
6. Add persistent storage for the SQLite database as before.
7. Deploy both services and verify `/api/remove-background/health` from the
   Node service before testing the editor.

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
- Confirm the health endpoint reports `provider: lucida` and `ok: true`.
- Switch Stripe to live mode and repeat with a real card once you're happy.

## Running it locally to check things first

Terminal 1:

```bash
cd background-remover
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8756
```

Terminal 2:

```bash
cp .env.example .env
npm install
npm start
```

Open http://localhost:3000. Background removal is available once the Lucida
service is running. No third-party background-removal API key is needed.
