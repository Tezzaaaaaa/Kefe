/* KEFE background presets + landing home bootstrap. */
(() => {
'use strict';
const p=new URLSearchParams(document.currentScript?.src?.split('?')[1]||''),runtime=p.get('runtime')==='1';
if(!runtime){window.addEventListener('load',()=>{const s=document.createElement('script');s.src='./app/ui/web-threads.js?v=20260903-6';s.async=false;document.body.appendChild(s);const bridge=document.createElement('script');bridge.textContent='window.state = state;';document.body.appendChild(bridge);const runtimeScript=document.createElement('script');runtimeScript.src='./app/ui/background-presets.js?v=20260903-6&runtime=1';runtimeScript.async=false;document.body.appendChild(runtimeScript)},{once:true});return}

/* Landing home: Web Threads is page-only. */
if(!document.querySelector('.kefe-landing-home')&&window.KefeWebThreads){
  document.body.classList.add('kefe-has-landing');
  const landing=document.createElement('section');
  landing.className='kefe-landing-home';
  landing.setAttribute('aria-label','KEFE Visualiser home');
  const threads=window.KefeWebThreads.create({...window.KefeWebThreads.defaults});
  threads.canvas.classList.add('kefe-landing-threads');
  landing.appendChild(threads.canvas);
  const shade=document.createElement('div');shade.className='kefe-landing-shade';landing.appendChild(shade);
  const nav=document.createElement('div');nav.className='kefe-landing-nav';nav.innerHTML='<span>KEFE</span><button type="button" class="kefe-landing-signin">Sign in</button>';landing.appendChild(nav);
  const hero=document.createElement('div');hero.className='kefe-landing-hero';hero.innerHTML='<img src="./assets/branding/kefe-logo-full.svg" class="kefe-landing-logo" alt="KEFE Visualiser"><p>Create lyric videos that move with your music.</p><button type="button" class="kefe-landing-start">Get started</button>';landing.appendChild(hero);
  document.body.prepend(landing);
  const enter=()=>{document.body.classList.add('kefe-editor-entered');landing.classList.add('is-leaving');setTimeout(()=>{threads.destroy();landing.remove()},450)};
  landing.querySelector('.kefe-landing-start').addEventListener('click',enter);
  landing.querySelector('.kefe-landing-signin').addEventListener('click',()=>document.getElementById('accountBtn')?.click());
  window.kefeLandingEnter=enter;window.kefeLandingThreads=threads;
}

const state=window.state,media=window.kefeMedia,grid=document.querySelector('.background-choice-grid');
if(!state||!media||!grid)return;
const status=document.getElementById('backgroundStatus'),colorInput=document.getElementById('backgroundColor'),colorValue=document.getElementById('backgroundColorValue'),presets=[...grid.querySelectorAll('[data-background-preset]')];
const defs={gradient:{label:'Soft Gradient',svg:`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><defs><linearGradient id="g"><stop stop-color="#241242"/><stop offset=".48" stop-color="#3a1f6b"/><stop offset="1" stop-color="#0b0518"/></linearGradient></defs><rect width="1080" height="1920" fill="url(#g)"/></svg>`},spotlight:{label:'Spotlight',svg:`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><defs><radialGradient id="g" cx="50%" cy="40%" r="70%"><stop stop-color="#9a5a1e"/><stop offset=".45" stop-color="#2c1608"/><stop offset="1" stop-color="#080402"/></radialGradient></defs><rect width="1080" height="1920" fill="url(#g)"/></svg>`},aurora:{label:'Aurora Wash',svg:`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><rect width="1080" height="1920" fill="#04060d"/></svg>`},grid:{label:'Fine Grid',svg:`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><rect width="1080" height="1920" fill="#050a0d"/></svg>`},grain:{label:'Film Grain',svg:`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><rect width="1080" height="1920" fill="#160e06"/></svg>`}};
const clear=()=>{if(media.video){media.video.pause();media.video.src='';media.video=null}media.videoFile=null;media.videoHasAudio=false;media.image=null};
const select=k=>presets.forEach(x=>x.classList.toggle('active-background',x.dataset.backgroundPreset===k)),redraw=()=>window.redrawCurrentPreviewFrame?.();
const choose=key=>{if(window.isExporting)return;clear();if(key==='solid'){state.background.type='solid';select('solid');if(status)status.textContent=`Colour background · ${state.background.solid.toUpperCase()}`;redraw();return}const def=defs[key];if(!def)return;const img=new Image();img.src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(def.svg)}`;img.onload=()=>{media.image=img;state.background.type='image';select(key);if(status)status.textContent=`${def.label} · ready`;redraw()}};
presets.forEach(x=>x.addEventListener('click',()=>choose(x.dataset.backgroundPreset)));colorInput?.addEventListener('input',()=>{clear();state.background.type='solid';state.background.solid=colorInput.value;if(colorValue)colorValue.textContent=colorInput.value.toUpperCase();select('solid');redraw()});select('solid');
})();
