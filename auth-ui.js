// KEFE membership: auth modal, upgrade modal, and free/pro gating.
// Additive module — does not modify app.js. Loaded after registry.js and
// before effect-app-fx.js so gating is in place before effects wire up.
(() => {
  const PREMIUM_EFFECTS = ['eternal', 'aurora', 'instagram', 'fadeup'];
  const PREMIUM_EXPORT_PRESETS = ['1080p', 'instagram', 'tiktok'];

  let entitlement = { plan: 'free', isPro: false, trialDaysLeft: null };
  let currentUser = null;

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    let data = {};
    try { data = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    return data;
  }

  function toast(msg) {
    const el = document.getElementById('toast');
    if (!el) return alert(msg);
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 3000);
  }

  // ---------- Header account widget ----------
  function buildHeaderWidget() {
    const actions = document.querySelector('.header-actions');
    if (!actions || document.getElementById('accountWidget')) return;
    const widget = document.createElement('div');
    widget.id = 'accountWidget';
    widget.className = 'account-widget';
    widget.innerHTML = `
      <button id="planBadge" type="button" class="plan-badge">Free</button>
      <button id="accountBtn" type="button" class="icon-button" aria-label="Account" title="Account">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c1.2-3.6 4-5.4 7-5.4s5.8 1.8 7 5.4"/></svg>
      </button>`;
    actions.prepend(widget);
    document.getElementById('planBadge').addEventListener('click', () => {
      if (!currentUser) return openAuthModal('login');
      if (!entitlement.isPro) return openUpgradeModal();
      openAccountModal();
    });
    document.getElementById('accountBtn').addEventListener('click', () => {
      currentUser ? openAccountModal() : openAuthModal('signup');
    });
  }

  function refreshHeaderWidget() {
    const badge = document.getElementById('planBadge');
    if (!badge) return;
    if (!currentUser) {
      badge.textContent = 'Sign in';
    } else if (entitlement.plan === 'pro') {
      badge.textContent = 'Pro';
    } else if (entitlement.plan === 'trial') {
      badge.textContent = `Trial · ${entitlement.trialDaysLeft}d left`;
    } else {
      badge.textContent = 'Upgrade';
    }
    badge.classList.toggle('is-pro', entitlement.isPro);
  }

  // ---------- Modals ----------
  function el(tag, cls, html) {
    const n = document.createElement('div');
    n.className = cls;
    if (html) n.innerHTML = html;
    return n;
  }

  function openModal(contentHtml, id) {
    closeModal();
    const overlay = el('div', 'modal kefe-auth-modal');
    overlay.id = id;
    overlay.innerHTML = `<div class="modal-content">${contentHtml}</div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    return overlay;
  }

  function closeModal() {
    document.querySelectorAll('.kefe-auth-modal').forEach((m) => m.remove());
  }

  function openAuthModal(mode = 'login') {
    const isLogin = mode === 'login';
    const overlay = openModal(`
      <div class="modal-header"><h3>${isLogin ? 'Sign in' : 'Create your account'}</h3><button class="close-btn" data-close>×</button></div>
      <div class="modal-body">
        <form id="authForm" class="auth-form">
          <input type="email" id="authEmail" placeholder="Email" autocomplete="email" required>
          <input type="password" id="authPassword" placeholder="Password (min 8 characters)" autocomplete="${isLogin ? 'current-password' : 'new-password'}" minlength="8" required>
          <div id="authError" class="auth-error" hidden></div>
          <button type="submit" class="primary full-width">${isLogin ? 'Sign in' : 'Start free trial'}</button>
        </form>
        ${!isLogin ? '<p class="auth-subtext">7-day free trial, full access. No card required to start.</p>' : ''}
        <p class="auth-switch">${isLogin ? "New here?" : 'Already have an account?'} <a href="#" id="authSwitch">${isLogin ? 'Create an account' : 'Sign in'}</a></p>
      </div>
    `, 'kefeAuthModal');

    overlay.querySelector('[data-close]').addEventListener('click', closeModal);
    overlay.querySelector('#authSwitch').addEventListener('click', (e) => {
      e.preventDefault();
      openAuthModal(isLogin ? 'signup' : 'login');
    });
    overlay.querySelector('#authForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = overlay.querySelector('#authEmail').value.trim();
      const password = overlay.querySelector('#authPassword').value;
      const errBox = overlay.querySelector('#authError');
      errBox.hidden = true;
      try {
        const data = await api(`/api/auth/${isLogin ? 'login' : 'signup'}`, { method: 'POST', body: { email, password } });
        currentUser = data.user;
        entitlement = { plan: data.user.plan, isPro: data.user.isPro, trialDaysLeft: data.user.trialDaysLeft };
        closeModal();
        refreshHeaderWidget();
        applyGating();
        toast(isLogin ? `Welcome back` : `Trial started — enjoy full access for ${data.user.trialDaysLeft ?? 7} days`);
      } catch (err) {
        errBox.textContent = err.message;
        errBox.hidden = false;
      }
    });
  }

  function openAccountModal() {
    const planLine = entitlement.plan === 'pro'
      ? 'Pro — thanks for subscribing.'
      : entitlement.plan === 'trial'
        ? `Free trial — ${entitlement.trialDaysLeft} day${entitlement.trialDaysLeft === 1 ? '' : 's'} left.`
        : 'Free plan.';
    const overlay = openModal(`
      <div class="modal-header"><h3>Account</h3><button class="close-btn" data-close>×</button></div>
      <div class="modal-body">
        <p>${currentUser.email}</p>
        <p class="auth-subtext">${planLine}</p>
        ${entitlement.plan !== 'pro' ? '<button id="upgradeFromAccount" class="primary full-width">Upgrade to Pro</button>' : '<button id="manageBilling" class="primary full-width">Manage billing</button>'}
        <button id="logoutBtn" class="full-width">Sign out</button>
      </div>
    `, 'kefeAccountModal');
    overlay.querySelector('[data-close]').addEventListener('click', closeModal);
    overlay.querySelector('#logoutBtn').addEventListener('click', async () => {
      await api('/api/auth/logout', { method: 'POST' });
      currentUser = null;
      entitlement = { plan: 'free', isPro: false, trialDaysLeft: null };
      closeModal();
      refreshHeaderWidget();
      applyGating();
      toast('Signed out');
    });
    const upgradeBtn = overlay.querySelector('#upgradeFromAccount');
    if (upgradeBtn) upgradeBtn.addEventListener('click', () => { closeModal(); openUpgradeModal(); });
    const manageBtn = overlay.querySelector('#manageBilling');
    if (manageBtn) manageBtn.addEventListener('click', async () => {
      try {
        const data = await api('/api/billing/create-portal-session', { method: 'POST' });
        window.location.href = data.url;
      } catch (err) {
        toast(err.message);
      }
    });
  }

  function openUpgradeModal() {
    const overlay = openModal(`
      <div class="modal-header"><h3>Upgrade to Pro</h3><button class="close-btn" data-close>×</button></div>
      <div class="modal-body">
        <ul class="upgrade-list">
          <li>All lyric effects — Eternal, Aurora, Instagram Lyrics, Fade Up</li>
          <li>1080p export + Instagram/TikTok presets</li>
          <li>Priority support for new effects</li>
        </ul>
        <button id="startCheckout" class="primary full-width">Continue to checkout</button>
      </div>
    `, 'kefeUpgradeModal');
    overlay.querySelector('[data-close]').addEventListener('click', closeModal);
    overlay.querySelector('#startCheckout').addEventListener('click', async () => {
      if (!currentUser) { closeModal(); return openAuthModal('signup'); }
      try {
        const data = await api('/api/billing/create-checkout-session', { method: 'POST' });
        window.location.href = data.url;
      } catch (err) {
        toast(err.message);
      }
    });
  }

  // ---------- Gating ----------
  function applyGating() {
    // Effect buttons
    document.querySelectorAll('[data-effect]').forEach((btn) => {
      const locked = PREMIUM_EFFECTS.includes(btn.dataset.effect) && !entitlement.isPro;
      btn.classList.toggle('locked-premium', locked);
      if (locked && !btn.querySelector('.lock-badge')) {
        const badge = document.createElement('span');
        badge.className = 'lock-badge';
        badge.textContent = '🔒';
        btn.appendChild(badge);
      } else if (!locked) {
        const badge = btn.querySelector('.lock-badge');
        if (badge) badge.remove();
      }
    });

    // Export preset options
    const presetSelect = document.getElementById('exportPreset');
    if (presetSelect) {
      Array.from(presetSelect.options).forEach((opt) => {
        const locked = PREMIUM_EXPORT_PRESETS.includes(opt.value) && !entitlement.isPro;
        if (locked && !opt.textContent.includes('Pro')) opt.textContent += ' (Pro)';
        if (!locked) opt.textContent = opt.textContent.replace(' (Pro)', '');
      });
    }
  }

  // Capture-phase interceptor so a locked effect never reaches app.js's own
  // click handler on the same button.
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-effect]');
    if (btn && btn.classList.contains('locked-premium')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      openUpgradeModal();
    }
  }, true);

  document.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'exportPreset') {
      const opt = e.target.selectedOptions[0];
      if (opt && PREMIUM_EXPORT_PRESETS.includes(opt.value) && !entitlement.isPro) {
        e.stopImmediatePropagation();
        e.target.value = '720p';
        openUpgradeModal();
      }
    }
  }, true);

  // ---------- Boot ----------
  async function boot() {
    buildHeaderWidget();
    try {
      const data = await api('/api/auth/me');
      if (data.user) {
        currentUser = data.user;
        entitlement = { plan: data.user.plan, isPro: data.user.isPro, trialDaysLeft: data.user.trialDaysLeft };
      }
    } catch (err) {
      // not signed in / server not reachable yet — default to free/logged-out
    }
    refreshHeaderWidget();
    applyGating();

    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
      toast('Payment received — Pro features unlocking shortly.');
      // Subscription activation lands via webhook; re-check shortly after redirect.
      setTimeout(async () => {
        try {
          const data = await api('/api/auth/me');
          if (data.user) {
            currentUser = data.user;
            entitlement = { plan: data.user.plan, isPro: data.user.isPro, trialDaysLeft: data.user.trialDaysLeft };
            refreshHeaderWidget();
            applyGating();
          }
        } catch (e) { /* ignore */ }
      }, 2500);
      history.replaceState({}, '', window.location.pathname);
    } else if (params.get('checkout') === 'cancelled') {
      history.replaceState({}, '', window.location.pathname);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
