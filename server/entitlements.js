const TRIAL_DAYS = parseInt(process.env.TRIAL_DAYS || '7', 10);

/**
 * Computes the effective plan for a user row from the database.
 * Returns { plan: 'free' | 'trial' | 'pro', isPro, trialEndsAt, daysLeft }
 */
function getEntitlement(user) {
  const now = new Date();

  // Active paid subscription always wins.
  if (user.plan_status === 'active' && user.stripe_subscription_id) {
    return { plan: 'pro', isPro: true, trialEndsAt: null, daysLeft: null };
  }

  // Trialing — check if still within the trial window.
  if (user.trial_ends_at) {
    const trialEnd = new Date(user.trial_ends_at);
    if (trialEnd > now) {
      const daysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
      return { plan: 'trial', isPro: true, trialEndsAt: user.trial_ends_at, daysLeft };
    }
  }

  return { plan: 'free', isPro: false, trialEndsAt: null, daysLeft: null };
}

function newTrialEndDate() {
  const d = new Date();
  d.setDate(d.getDate() + TRIAL_DAYS);
  return d.toISOString();
}

module.exports = { getEntitlement, newTrialEndDate, TRIAL_DAYS };
