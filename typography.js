/* KEFE Visualiser — canonical typography system */
(() => {
  'use strict';
  const scale = { ratio: 1.25, micro: 10, caption: 12.5, label: 15.625, body: 19.53125, bodyLarge: 24.414, title: 30.518, display: 38.147, displayXL: 47.684 };
  const families = { ui: 'Open Sans', apple: 'Open Sans', brat: 'Archivo Narrow', eternal: 'Homemade Apple', aurora: 'Bricolage Grotesque', typewriter: 'Courier Prime', instagram: 'Inter Tight', fadeup: 'Momo Trust Display', kinetic: 'Open Sans', liquid: 'Bricolage Grotesque', lightfield: 'Open Sans', mixedmedia: 'Open Sans' };
  const effects = {
    apple: { family: families.apple, weight: 700, min: 42, max: 150, lineHeight: 1.08, tracking: -.020, align: 'center', case: 'none', opticalScale: 1.00 },
    brat: { family: families.brat, weight: 700, min: 36, max: 150, lineHeight: .94, tracking: -.055, align: 'center', case: 'none', opticalScale: 1.04 },
    eternal: { family: families.eternal, weight: 400, min: 34, max: 150, lineHeight: 1, tracking: .004, align: 'left', case: 'none', opticalScale: .98 },
    aurora: { family: families.aurora, weight: 500, min: 38, max: 150, lineHeight: 1.05, tracking: -.006, align: 'center', case: 'none', opticalScale: 1.00 },
    typewriter: { family: families.typewriter, weight: 400, min: 32, max: 140, lineHeight: 1.02, tracking: .020, align: 'center', case: 'none', opticalScale: .98 },
    instagram: { family: families.instagram, weight: 800, min: 48, max: 150, lineHeight: .78, tracking: -.035, align: 'center', case: 'upper', opticalScale: 1.00 },
    fadeup: { family: families.fadeup, weight: 400, min: 34, max: 150, lineHeight: 1.08, tracking: -.006, align: 'center', case: 'none', opticalScale: .98 },
    kinetic: { family: families.kinetic, weight: 800, min: 38, max: 156, lineHeight: 1.0, tracking: -.018, align: 'center', case: 'none', opticalScale: 1.00 },
    liquid: { family: families.liquid, weight: 500, min: 38, max: 150, lineHeight: 1.0, tracking: -.010, align: 'center', case: 'none', opticalScale: 1.00 },
    lightfield: { family: families.lightfield, weight: 700, min: 42, max: 150, lineHeight: 1.0, tracking: -.020, align: 'center', case: 'none', opticalScale: 1.00 },
    mixedmedia: { family: families.mixedmedia, weight: 800, min: 34, max: 150, lineHeight: 1.0, tracking: .012, align: 'center', case: 'none', opticalScale: 1.00 }
  };
  const fontFaces = [
    '400 1em "Open Sans"', '700 1em "Open Sans"', '800 1em "Open Sans"',
    '700 1em "Archivo Narrow"', '400 1em "Homemade Apple"',
    '400 1em "Courier Prime"', '700 1em "Courier Prime"',
    '800 1em "Inter Tight"', '400 1em "Momo Trust Display"',
    '500 1em "Bricolage Grotesque"'
  ];
  const ready = (async () => {
    if (!document.fonts?.ready) return true;
    const results = await Promise.all(fontFaces.map(face => document.fonts.load(face).then(() => true).catch(() => false)));
    if (results.some(ok => !ok)) console.warn('KEFE: one or more effect fonts failed to load', fontFaces.filter((_, i) => !results[i]));
    return results.every(Boolean);
  })();
  window.KEFE_TYPE = Object.freeze({ scale, families, effects, ready });
  window.kefeTypographyReady = ready;

  const guarded = new WeakSet();
  function guard(button) {
    if (!button || guarded.has(button)) return;
    guarded.add(button);
    button.addEventListener('click', event => {
      if (button.dataset.kefeFontsReady === '1') return;
      event.preventDefault(); event.stopImmediatePropagation(); button.disabled = true;
      ready.finally(() => { button.disabled = false; button.dataset.kefeFontsReady = '1'; button.click(); });
    }, true);
  }
  function installGuards() { ['exportBtn', 'exportBottom', 'confirmExport'].forEach(id => guard(document.getElementById(id))); }
  const redraw = () => { try { window.redrawCurrentPreviewFrame?.(); } catch (_) {} };
  window.addEventListener('kefe:fonts-ready', redraw);

  const premium = [
    ['kinetic','Kinetic','Intelligent cinematic typography'],
    ['liquid','Liquid','Fluid, morphing letterform motion'],
    ['lightfield','Lightfield','Typography integrated with light and depth']
  ];

  function ensureKineticDefaults() {
    const s=window.state?.style; if(!s)return;
    if(s.kineticEnergy==null)s.kineticEnergy=.72;
    if(s.kineticHierarchy==null)s.kineticHierarchy=.78;
    if(s.kineticMotion==null)s.kineticMotion=.68;
    if(s.kineticDensity==null)s.kineticDensity=.55;
    if(s.kineticGlow==null)s.kineticGlow=.18;
  }

  function installKineticControls(controls) {
    controls.innerHTML='';
    const wrap=document.createElement('div'); wrap.className='premium-controls';
    const fields=[
      ['kineticEnergy','Impact',.15,1,.01,'How strongly the composition responds to lyric timing'],
      ['kineticHierarchy','Hierarchy',0,1,.01,'How strongly important words rise above the line'],
      ['kineticMotion','Motion',0,1,.01,'Amount of spatial travel and physical movement'],
      ['kineticDensity','Density',0,1,.01,'How tightly words compose and wrap'],
      ['kineticGlow','Glow',0,1,.01,'Very restrained active-word light']
    ];
    fields.forEach(([key,label,min,max,step,title])=>{
      const row=document.createElement('label');row.className='premium-control';row.title=title;
      const top=document.createElement('span');top.className='premium-control-heading';
      const name=document.createElement('span');name.textContent=label;
      const value=document.createElement('output');value.textContent=Math.round(Number(window.state.style[key])*100)+'%';
      top.append(name,value);
      const input=document.createElement('input');input.type='range';input.min=min;input.max=max;input.step=step;input.value=window.state.style[key];input.dataset.kefeControl=key;
      input.addEventListener('input',()=>{window.state.style[key]=Number(input.value);value.textContent=Math.round(Number(input.value)*100)+'%';redraw();});
      row.append(top,input);wrap.append(row);
    });
    const reset=document.createElement('button');reset.type='button';reset.className='secondary premium-reset';reset.textContent='Reset Kinetic';
    reset.addEventListener('click',()=>{window.state.style.kineticEnergy=.72;window.state.style.kineticHierarchy=.78;window.state.style.kineticMotion=.68;window.state.style.kineticDensity=.55;window.state.style.kineticGlow=.18;installKineticControls(controls);redraw();});
    wrap.append(reset);controls.append(wrap);
  }

  function installPremiumEffects() {
    const section=document.getElementById('effectSection'), controls=document.getElementById('effectControls'); if(!section||!controls)return;
    const buttons=section.querySelector('.effect-buttons'); if(!buttons)return;
    premium.forEach(([name,label,description])=>{
      if(buttons.querySelector(`[data-effect="${name}"]`))return;
      const b=document.createElement('button');b.type='button';b.dataset.effect=name;b.textContent=label;b.title=description;buttons.appendChild(b);
    });
    if(!document.getElementById('premiumEffectNote')){
      const note=document.createElement('div');note.id='premiumEffectNote';note.className='effect-label';note.textContent='Premium systems · Kinetic, Liquid and Lightfield';controls.before(note);
    }
    const setActive=name=>{
      window.state.style.effect=name; buttons.querySelectorAll('[data-effect]').forEach(b=>b.classList.toggle('active-effect',b.dataset.effect===name));
      const label=document.getElementById('effectLabel'); if(label)label.textContent=premium.find(x=>x[0]===name)?.[2]||label.textContent;
      if(name==='kinetic'){ensureKineticDefaults();installKineticControls(controls);} else controls.innerHTML='<div class="premium-controls-placeholder">Premium controls for this system will be added after Kinetic is locked.</div>';
      redraw();
    };
    buttons.querySelectorAll('[data-effect]').forEach(b=>{
      if(b.dataset.kefePremiumBound==='1')return;b.dataset.kefePremiumBound='1';b.addEventListener('click',()=>setActive(b.dataset.effect));
    });
    if(!window.KEFE_PREMIUM_EFFECTS_LOADING){
      window.KEFE_PREMIUM_EFFECTS_LOADING=true;
      ['kinetic','liquid','lightfield'].forEach(name=>{const script=document.createElement('script');script.src=`./effects/${name}.js`;script.async=false;document.body.appendChild(script);});
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{installGuards();installPremiumEffects();},{once:true}); else {installGuards();installPremiumEffects();}
  ready.then(()=>window.dispatchEvent(new CustomEvent('kefe:fonts-ready')));
})();
