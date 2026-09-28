/* KEFE background presets. */
(() => {
'use strict';
const state=window.state,media=window.kefeMedia,grid=document.querySelector('.background-choice-grid');if(!state||!media||!grid)return;
const status=document.getElementById('backgroundStatus'),colorInput=document.getElementById('backgroundColor'),colorValue=document.getElementById('backgroundColorValue'),presets=[...grid.querySelectorAll('[data-background-preset]')];
const defs={gradient:{label:'Soft Gradient',svg:`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><defs><linearGradient id="g"><stop stop-color="#241242"/><stop offset=".48" stop-color="#3a1f6b"/><stop offset="1" stop-color="#0b0518"/></linearGradient></defs><rect width="1080" height="1920" fill="url(#g)"/></svg>`},spotlight:{label:'Spotlight',svg:`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><defs><radialGradient id="g" cx="50%" cy="40%" r="70%"><stop stop-color="#9a5a1e"/><stop offset=".45" stop-color="#2c1608"/><stop offset="1" stop-color="#080402"/></radialGradient></defs><rect width="1080" height="1920" fill="url(#g)"/></svg>`},aurora:{label:'Aura Wash',svg:`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#04060d"/><stop offset=".4" stop-color="#0d2a24"/><stop offset=".62" stop-color="#123a2e"/><stop offset="1" stop-color="#04060d"/></linearGradient></defs><rect width="1080" height="1920" fill="url(#g)"/></svg>`},grid:{label:'Fine Grid',svg:`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><defs><pattern id="p" width="54" height="54" patternUnits="userSpaceOnUse"><path d="M54 0H0V54" fill="none" stroke="rgba(255,255,255,.09)" stroke-width="1"/></pattern></defs><rect width="1080" height="1920" fill="#050a0d"/><rect width="1080" height="1920" fill="url(#p)"/></svg>`},grain:{label:'Film Grain',svg:`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><defs><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch" result="t"/><feColorMatrix in="t" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .5 0"/></filter></defs><rect width="1080" height="1920" fill="#160e06"/><rect width="1080" height="1920" filter="url(#n)" opacity=".22"/></svg>`}};
const clear=()=>{if(media.video){media.video.pause();media.video.src='';media.video=null}media.videoFile=null;media.videoHasAudio=false;media.image=null};
const select=k=>presets.forEach(x=>x.classList.toggle('active-background',x.dataset.backgroundPreset===k)),redraw=()=>window.redrawCurrentPreviewFrame?.();
const choose=key=>{if(window.isExporting)return;clear();if(key==='solid'){state.background.type='solid';select('solid');if(status)status.textContent=`Colour background · ${state.background.solid.toUpperCase()}`;redraw();return}const def=defs[key];if(!def)return;const img=new Image();img.src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(def.svg)}`;img.onload=()=>{media.image=img;state.background.type='image';select(key);if(status)status.textContent=`${def.label} · ready`;redraw()}};
presets.forEach(x=>x.addEventListener('click',()=>choose(x.dataset.backgroundPreset)));colorInput?.addEventListener('input',()=>{clear();state.background.type='solid';state.background.solid=colorInput.value;if(colorValue)colorValue.textContent=colorInput.value.toUpperCase();select('solid');redraw()});select('solid');

const buildBackgroundPopover=()=>{
  if(!grid||grid.dataset.kefePopoverApplied==='1')return;
  const buttons=[...grid.querySelectorAll('[data-background-preset]')];
  if(!buttons.length)return;
  grid.dataset.kefePopoverApplied='1';
  grid.innerHTML='';
  const trigger=document.createElement('button');
  trigger.type='button';trigger.className='background-choice kefe-popover-trigger';
  trigger.setAttribute('popoverTarget','kefe-background-popover');
  trigger.textContent='Choose background';
  grid.appendChild(trigger);
  const menu=document.createElement('div');
  menu.id='kefe-background-popover';menu.setAttribute('popover','auto');menu.className='kefe-background-popover';
  menu.innerHTML='<span class="kefe-popover-active" aria-hidden="true"></span>';
  const subTrigger=document.createElement('button');
  subTrigger.type='button';subTrigger.className='kefe-popover-category';
  subTrigger.setAttribute('popoverTarget','kefe-background-presets-popover');
  subTrigger.textContent='Presets';
  menu.appendChild(subTrigger);
  const sub=document.createElement('div');
  sub.id='kefe-background-presets-popover';sub.setAttribute('popover','auto');sub.className='kefe-background-subpopover';
  buttons.forEach(b=>{b.classList.add('kefe-background-option');sub.appendChild(b);});
  menu.appendChild(sub);grid.appendChild(menu);
  const s=document.createElement('style');s.id='kefe-background-popover-css';s.textContent=[
    '#backgroundSection .background-choice-grid{display:block !important}',
    '#backgroundSection .kefe-popover-trigger{width:100%;min-height:44px;justify-content:flex-start;text-align:left}',
    '.kefe-background-popover,.kefe-background-subpopover{margin:0;padding:8px;min-width:220px;border:1px solid var(--line);border-radius:10px;background:var(--surface-2);color:var(--text);box-shadow:none}',
    '.kefe-background-popover > .kefe-popover-category{display:flex;width:100%;align-items:center;justify-content:space-between;padding:9px 10px;border:0;border-radius:7px;background:transparent;color:var(--text);font:600 12px "Inter Tight",sans-serif;text-align:left;cursor:pointer}',
    '.kefe-background-subpopover .kefe-background-option{width:100%;min-height:38px;justify-content:flex-start;text-align:left;border:0;border-radius:7px;background:transparent;color:var(--text);font:600 12px "Inter Tight",sans-serif;cursor:pointer}',
    '.kefe-background-subpopover .kefe-background-option:hover,.kefe-background-popover > .kefe-popover-category:hover{background:var(--surface-3)}',
    '.kefe-popover-active{display:block;height:2px;margin:0 4px 6px;background:var(--red);opacity:.85}'
  ].join('');document.head.appendChild(s);
};
buildBackgroundPopover();
const loadAurora=()=>{if(window.KefeAuroraFX||document.querySelector('script[data-kefe-aurora-fx]'))return;const script=document.createElement('script');script.src='./app/effects/aurora-fx.js?v=20260905-1';script.async=false;script.dataset.kefeAuroraFx='1';document.body.appendChild(script)};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loadAurora,{once:true});else loadAurora();
})();
