/* KEFE — consolidated UI fixes. */
(() => {
  'use strict';

  /* ---------- 1. Upload confirmation card ---------- */
  function ensureConfirmCss() {
    if (document.getElementById('kefe-fix-confirm-css')) return;
    const s = document.createElement('style');
    s.id = 'kefe-fix-confirm-css';
    s.textContent = [
      '.kefe-upload-confirmation{display:none;align-items:center;gap:12px;margin-top:10px;padding:10px;border:1px solid rgba(48,209,88,.72);border-radius:12px;background:linear-gradient(135deg,rgba(48,209,88,.16),rgba(48,209,88,.06));text-align:left}',
      '.kefe-upload-confirmation.is-visible{display:flex !important}',
      '.kefe-upload-thumb{width:58px;height:58px;flex:0 0 58px;border-radius:9px;background:var(--surface-3);display:flex;align-items:center;justify-content:center;color:#fff;font-size:28px;font-weight:700;overflow:hidden;background-position:center;background-size:cover}',
      '.kefe-upload-thumb.audio-thumb{background:linear-gradient(135deg,var(--red),#a8241d)}',
      '.kefe-upload-info{min-width:0;display:flex;flex-direction:column;gap:2px}',
      '.kefe-upload-check{display:flex;align-items:center;gap:6px;color:#30d158;font-size:12px;text-transform:uppercase;letter-spacing:.06em}',
      '.kefe-upload-check span{width:18px;height:18px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:#30d158;color:#07140a;font-size:12px;font-weight:800}',
      '.kefe-upload-name{font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:245px}',
      '.kefe-upload-meta{font-size:10.5px;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:245px}'
    ].join('\n');
    document.head.appendChild(s);
  }
  function forceConfirm(dropId) {
    const drop = document.getElementById(dropId);
    if (!drop) return null;
    let card = drop.querySelector('.kefe-upload-confirmation');
    if (!card) {
      card = document.createElement('div');
      card.className = 'kefe-upload-confirmation';
      card.innerHTML = '<div class="kefe-upload-thumb"></div><div class="kefe-upload-info"><div class="kefe-upload-check"><span>&#10003;</span><b>Uploaded</b></div><div class="kefe-upload-name"></div><div class="kefe-upload-meta"></div></div>';
      drop.appendChild(card);
    }
    return card;
  }
  function refreshConfirm() {
    const state = window.state || {};
    const media = window.kefeMedia || {};
    ensureConfirmCss();
    const af = state.audio && state.audio.file;
    const ar = Boolean(af && (state.audio.ready || state.audio.duration > 0));
    const ac = af ? forceConfirm('audioDrop') : null;
    if (ac) {
      ac.classList.toggle('is-visible', ar);
      const n = ac.querySelector('.kefe-upload-name');
      const m = ac.querySelector('.kefe-upload-meta');
      if (n) n.textContent = af.name || 'Audio loaded';
      if (m) m.textContent = [(state.audio.metadata||{}).title, (state.audio.metadata||{}).artist].filter(Boolean).join(' - ') || 'Audio ready';
    }
    const bf = media.videoFile;
    const hasBg = Boolean(media.video || media.image);
    const bc = hasBg ? forceConfirm('bgDrop') : null;
    if (bc) {
      bc.classList.add('is-visible');
      const n = bc.querySelector('.kefe-upload-name');
      const m = bc.querySelector('.kefe-upload-meta');
      if (n) n.textContent = (bf && bf.name) || (media.image ? 'Image loaded' : 'Background loaded');
      if (m) m.textContent = media.video ? 'Video ready' : media.image ? 'Image ready' : 'Ready';
    }
  }

  /* ---------- 2. Song combobox clicks ---------- */
  function patchComboboxes() {
    document.querySelectorAll('.kefe-song-combobox-list [role="option"]').forEach(function (opt) {
      if (opt.dataset.kefeFixed === '1') return;
      opt.dataset.kefeFixed = '1';
      opt.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      }, true);
    });
  }

  /* ---------- 3. Style section effect buttons ---------- */
  function patchEffectButtons() {
    if (document.getElementById('kefe-fix-fx-css')) return;
    const s = document.createElement('style');
    s.id = 'kefe-fix-fx-css';
    s.textContent = [
      '#lyricStyleBlock .effect-buttons{display:grid !important;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}',
      '#lyricStyleBlock .effect-buttons button{position:relative !important;isolation:isolate;overflow:hidden;min-height:64px;padding:12px 10px;white-space:normal !important;text-align:left;font-weight:600}',
      '#lyricStyleBlock .effect-buttons button::before{position:absolute !important;inset:0;border-radius:inherit;z-index:-2}',
      '#lyricStyleBlock .effect-buttons button::after{position:absolute !important;left:10px;right:10px;top:10px;height:18px;border-radius:6px;z-index:-1}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ---------- 4. Background section swatches ---------- */
  function patchBackgroundSwatches() {
    if (document.getElementById('kefe-fix-bg-css')) return;
    const s = document.createElement('style');
    s.id = 'kefe-fix-bg-css';
    s.textContent = [
      '#backgroundSection .background-choice-grid{display:grid !important;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}',
      '#backgroundSection .background-choice{display:flex !important;flex-direction:column;gap:6px;padding:8px;border:1px solid var(--line);border-radius:10px;background:var(--surface);cursor:pointer;color:var(--text);text-align:left;min-height:0}',
      '#backgroundSection .background-choice-preview{display:block !important;width:100% !important;height:56px !important;border-radius:7px;background:#0a0a0a;flex:0 0 auto}',
      '#backgroundSection .background-choice-label{display:block !important;font-size:11px;font-weight:600;color:var(--text-2);line-height:1.25}',
      '#backgroundSection .background-choice.active-background{border-color:var(--red);box-shadow:0 0 0 1px var(--red)}',
      '@media(max-width:560px){#backgroundSection .background-choice-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ---------- 5. Wizard step -> section visibility ----------
     Generate one explicit rule per (step, section) pair. No :not(), no
     reliance on .sidebar > — impossible for wizard CSS or inline styles
     from previous fixes to override. */
  function installWizardVisibility() {
    if (document.getElementById('kefe-wizard-visibility')) return;
    const STEPS = ['intro','source','lyrics','captions','style','background','preview','export'];
    const SECTIONS = ['audioSection','textSection','fxSection','backgroundSection','exportSection','wizardSection'];
    const KEEP = {
      intro: 'wizardSection', source: 'wizardSection', style: 'wizardSection', preview: 'wizardSection',
      lyrics: 'textSection', captions: 'textSection',
      background: 'backgroundSection', export: 'exportSection'
    };
    const rules = [];
    STEPS.forEach(function(step){
      const keep = KEEP[step];
      SECTIONS.forEach(function(id){
        if (id === keep) {
          rules.push('body.wizard-mode[data-wizard-step="' + step + '"] #' + id + '{display:block !important;flex:1 1 auto !important;min-height:0 !important;overflow-y:auto !important;padding:16px 16px 20px !important}');
        } else {
          rules.push('body.wizard-mode[data-wizard-step="' + step + '"] #' + id + '{display:none !important;visibility:hidden !important;position:absolute !important;left:-99999px !important;width:1px !important;height:1px !important;overflow:hidden !important}');
        }
      });
    });
    const css = document.createElement('style');
    css.id = 'kefe-wizard-visibility';
    css.textContent = rules.join('\n');
    document.head.appendChild(css);

    // Rescue: if a sidebar section got reparented somewhere weird, drag it home
    // and strip any inline styles previous fixes may have left on it.
    function rescue() {
      const sidebar = document.querySelector('.sidebar');
      if (!sidebar) return;
      SECTIONS.forEach(function(id){
        const el = document.getElementById(id);
        if (!el) return;
        if (el.parentElement !== sidebar) {
          console.log('[KEFE fix] rescuing #' + id + ' from', el.parentElement && (el.parentElement.id || el.parentElement.className));
          sidebar.appendChild(el);
        }
        el.style.removeProperty('display');
        el.style.removeProperty('visibility');
        el.style.removeProperty('position');
        el.style.removeProperty('left');
        el.style.removeProperty('width');
        el.style.removeProperty('height');
        el.style.removeProperty('overflow');
        el.style.removeProperty('flex');
        el.style.removeProperty('padding');
        el.style.removeProperty('min-height');
      });
    }
    rescue();
    setInterval(rescue, 200);
    console.log('[KEFE fix] wizard visibility rules installed');
  }

  function boot() {
    patchEffectButtons();
    patchBackgroundSwatches();
    ensureConfirmCss();
    refreshConfirm();
    patchComboboxes();
    installWizardVisibility();
    setInterval(refreshConfirm, 400);
    setInterval(patchComboboxes, 800);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

/* Hide the wizard's mini style-preview card. The main preview canvas on
   the right already reacts live to effect clicks, so the mini one is
   redundant. */
(function(){
  if (document.getElementById('kefe-hide-mini-preview')) return;
  var s = document.createElement('style');
  s.id = 'kefe-hide-mini-preview';
  s.textContent = '.wizard-style-preview{display:none !important}';
  document.head.appendChild(s);
})();

/* Force #backgroundSection to show ONLY on the 'background' wizard step.
   Inline !important so no other stylesheet can override it. */
(function(){
  function enforce() {
    var step = document.body.dataset.wizardStep;
    var bg = document.getElementById('backgroundSection');
    if (!bg || !step) return;
    var shouldShow = (step === 'background');
    bg.style.setProperty('display', shouldShow ? 'block' : 'none', 'important');
    bg.style.setProperty('visibility', shouldShow ? 'visible' : 'hidden', 'important');
    if (shouldShow) {
      bg.style.setProperty('flex', '1 1 auto', 'important');
      bg.style.setProperty('min-height', '0', 'important');
      bg.style.setProperty('overflow-y', 'auto', 'important');
      bg.style.setProperty('padding', '16px 16px 20px', 'important');
    }
  }
  setInterval(enforce, 60);
  ['click','keydown','change','input'].forEach(function(e){
    document.addEventListener(e, function(){
      setTimeout(enforce, 20);
      setTimeout(enforce, 150);
      setTimeout(enforce, 400);
    }, true);
  });
  enforce();
  console.log('[KEFE fix] background section visibility enforced');
})();
