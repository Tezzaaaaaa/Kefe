/* KEFE — adjusted Prism landing compatibility loader. */
(() => {
  'use strict';
  const init = () => {
    if (!window.KefePrism || document.querySelector('.kefe-landing-home')) return;
    window.KefeWebThreads = window.KefePrism;
    const landing = document.createElement('section');
    landing.className = 'kefe-landing-home';
    landing.setAttribute('aria-label', 'KEFE Visualiser home');
    const prism = window.KefePrism.create({ ...window.KefePrism.defaults });
    prism.canvas.classList.add('kefe-landing-threads');
    landing.appendChild(prism.canvas);
    const shade = document.createElement('div');
    shade.className = 'kefe-landing-shade';
    landing.appendChild(shade);
    const nav = document.createElement('div');
    nav.className = 'kefe-landing-nav';
    nav.innerHTML = '<span>KEFE</span><button type="button" class="kefe-landing-signin">Sign in</button>';
    landing.appendChild(nav);
    const hero = document.createElement('div');
    hero.className = 'kefe-landing-hero';
    hero.innerHTML = '<img src="./assets/branding/kefe-logo-light.svg" class="kefe-landing-logo" alt="KEFE Visualiser"><p>Bring your content to life with lyrics, captions, and visualisers.</p><button type="button" class="kefe-landing-start">Get started</button>';
    landing.appendChild(hero);
    document.body.prepend(landing);
    document.body.classList.add('kefe-has-landing');
    prism.refresh();
    const enter = () => {
      document.body.classList.add('kefe-editor-entered');
      landing.classList.add('is-leaving');
      setTimeout(() => { prism.destroy(); landing.remove(); }, 450);
    };
    landing.querySelector('.kefe-landing-start').addEventListener('click', enter);
    landing.querySelector('.kefe-landing-signin').addEventListener('click', () => document.getElementById('accountBtn')?.click());
    window.kefeLandingEnter = enter;
    window.kefeLandingPrism = prism;
    window.dispatchEvent(new CustomEvent('kefe-prism-ready'));
  };
  const script = document.createElement('script');
  script.src = './app/ui/prism.js?v=20260905-2';
  script.async = false;
  script.onload = init;
  script.onerror = () => console.error('KEFE Prism failed to load.');
  (document.currentScript?.after(script)) || document.head.appendChild(script);
})();
