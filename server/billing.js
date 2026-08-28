const express = require('express');
const db = require('./db');
const { requireAuth } = require('./auth');

function buildRouter() {
  const router = express.Router();

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  if (!stripeKey || !priceId) {
    console.warn('[billing] STRIPE_SECRET_KEY / STRIPE_PRICE_ID not set — billing routes will return 501 until configured.');
  }

  const stripe = stripeKey ? require('stripe')(stripeKey) : null;

  function requireStripeConfigured(req, res, next) {
    if (!stripe || !priceId) {
      return res.status(501).json({ error: 'Billing is not configured yet. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID.' });
    }
    next();
  }

  // Create (or reuse) a Stripe Customer for this user.
  async function ensureCustomer(user) {
    if (user.stripe_customer_id) return user.stripe_customer_id;
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { kefe_user_id: String(user.id) },
    });
    db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').run(customer.id, user.id);
    return customer.id;
  }

  router.post('/create-checkout-session', requireAuth, requireStripeConfigured, async (req, res) => {
    try {
      const customerId = await ensureCustomer(req.user);
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        allow_promotion_codes: true,
        success_url: `${appUrl}/?checkout=success`,
        cancel_url: `${appUrl}/?checkout=cancelled`,
        metadata: { kefe_user_id: String(req.user.id) },
        subscription_data: {
          metadata: { kefe_user_id: String(req.user.id) },
        },
      });
      res.json({ url: session.url });
    } catch (err) {
      console.error('[billing] checkout session error', err);
      res.status(500).json({ error: 'Could not start checkout. Try again shortly.' });
    }
  });

  router.post('/create-portal-session', requireAuth, requireStripeConfigured, async (req, res) => {
    try {
      if (!req.user.stripe_customer_id) {
        return res.status(400).json({ error: 'No billing account yet — subscribe first.' });
      }
      const session = await stripe.billingPortal.sessions.create({
        customer: req.user.stripe_customer_id,
        return_url: `${appUrl}/`,
      });
      res.json({ url: session.url });
    } catch (err) {
      console.error('[billing] portal session error', err);
      res.status(500).json({ error: 'Could not open billing portal.' });
    }
  });

  // Webhook — mounted with express.raw() body parsing (see server/index.js).
  router.post('/webhook', requireStripeConfigured, async (req, res) => {
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], webhookSecret);
    } catch (err) {
      console.error('[billing] webhook signature verification failed', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          const userId = session.metadata && session.metadata.kefe_user_id;
          if (userId && session.subscription) {
            db.prepare(
              'UPDATE users SET stripe_subscription_id = ?, plan_status = ? WHERE id = ?'
            ).run(session.subscription, 'active', userId);
          }
          break;
        }
        case 'customer.subscription.updated':
        case 'customer.subscription.created': {
          const sub = event.data.object;
          const userId = sub.metadata && sub.metadata.kefe_user_id;
          const status = ['active', 'trialing'].includes(sub.status) ? 'active' : sub.status;
          const periodEnd = sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null;
          if (userId) {
            db.prepare(
              'UPDATE users SET stripe_subscription_id = ?, plan_status = ?, stripe_current_period_end = ? WHERE id = ?'
            ).run(sub.id, status, periodEnd, userId);
          } else {
            db.prepare(
              'UPDATE users SET plan_status = ?, stripe_current_period_end = ? WHERE stripe_subscription_id = ?'
            ).run(status, periodEnd, sub.id);
          }
          break;
        }
        case 'customer.subscription.deleted': {
          const sub = event.data.object;
          db.prepare(
            "UPDATE users SET plan_status = 'free' WHERE stripe_subscription_id = ?"
          ).run(sub.id);
          break;
        }
        default:
          break;
      }
      res.json({ received: true });
    } catch (err) {
      console.error('[billing] webhook handler error', err);
      res.status(500).json({ error: 'Webhook handler failed' });
    }
  });

  return router;
}

module.exports = buildRouter;
