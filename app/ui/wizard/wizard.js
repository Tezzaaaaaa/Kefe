/* KEFE — single guided lyric-video wizard. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const sidebar = document.querySelector('.sidebar');
  const preview = document.querySelector('.preview');
  if (!sidebar || sidebar.dataset.kefeWizard === '1') return;
  sidebar.dataset.kefeWizard = '1';
  document.querySelector('[aria-label="Text mode"]')?.remove();
  $('captionsPanel')?.remove();
  document.querySelector('.theme-control')?.remove();
  document.querySelectorAll('link[href*="auth-ui"], link[href*="caption-generator"], link[href*="theme-cycle"], script[src*="auth-ui"], script[src*="caption-generator"], script[src*="music-intelligence"], script[src*="theme-cycle"]').forEach(node => node.remove());
  const steps = [
    { id: 'intro', label: 'Start', target: null }, { id: 'source', label: 'Media', target: 'audioSection' },
    { id: 'lyrics', label: 'Lyrics', target: 'textSection' }, { id: 'style', label: 'Style', target: 'textSection' },
    { id: 'background', label: 'Background', target: 'backgroundSection' }, { id: 'preview', label: 'Preview', target: null },
    { id: 'export', label: 'Export', target: 'exportSection' }
  ];
  const lyricEffectCopy = {
    apple: 'Focused, polished lyric stack', brat: 'Bold kinetic typewriter', eternal: 'Handwritten flowing lyric cycle', aurora: 'Colour-shifting glow',
    pulse: 'Rhythmic scale and glow', typewriter: 'Character-by-character reveal', instagram: 'Bold social-style lyric stack', fadeup: 'Soft word-by-word rise',
    storyfade: 'Cinematic line-by-line fade', decrypt: 'Scrambled characters resolve', blur: 'Blurred words sharpen into focus', shiny: 'Diagonal light sweep', scrolllines: 'Editorial multi-line horizontal motion',
    rise: 'Soft upward lift', slide: 'Smooth lateral glide', drop: 'Controlled downward arrival', drift: 'Gentle diagonal float'
  };
  const lyricEffects = Object.keys(lyricEffectCopy);
  let index = 0;
  const panel = document.createElement('div'); panel.className = 'section wizard-panel'; panel.id = 'wizardSection'; sidebar.insertBefore(panel, sidebar.firstChild);
  const nav = document.createElement('div'); nav.className = 'wizard-nav'; nav.innerHTML = '<button type="button" id="wizardBackBtn" class="wizard-back">Back</button><div class="wizard-progress-wrap"><div id="wizardProgress" class="wizard-progress"></div><span id="wizardStepLabel" class="wizard-step-label"></span></div><button type="button" id="wizardNextBtn" class="primary wizard-next">Next</button>'; sidebar.insertBefore(nav, sidebar.children[1] || null);
  const back = $('wizardBackBtn'), next = $('wizardNextBtn');
  function audioReady() { const audio = window.state?.audio; return Boolean(audio && (audio.file || audio.ready || audio.duration > 0)); }
  function lyricsReady() { return Boolean(window.state?.lyrics?.lines?.length || $('lyricsText')?.value.trim()); }
  function ensureRenderer(src, key, dataAttr) { if (window.kefeEffects?.[key] || document.querySelector(`script[${dataAttr}]`)) return; const script = document.createElement('script'); script.src = src; script.setAttribute(dataAttr, 'true'); document.head.appendChild(script); }
  function buildLyricEffects() {
    if (document.body.dataset.wizardStep !== 'style') return;
    const block = $('lyricStyleBlock'), host = $('wizardStyleMount'); if (!block || !host) return;
    ensureRenderer('./app/effects/scroll-lines.js', 'scrolllines', 'data-kefe-scroll-lines');
    ensureRenderer('./app/effects/motion.js', 'rise', 'data-kefe-motion-effects');
    ensureRenderer('./app/effects/story-fade.js', 'storyfade', 'data-kefe-story-fade');
    const effectButtons = block.querySelector('.effect-buttons');
    const source = [...(effectButtons?.querySelectorAll('[data-effect]') || [])];
    for (const name of ['scrolllines','rise','slide','drop','drift','storyfade']) {
      if (source.some(button => button.dataset.effect === name)) continue;
      const button = document.createElement('button'); button.type='button'; button.className='segmented-btn'; button.dataset.effect=name; button.textContent=name==='storyfade'?'Story Fade':name[0].toUpperCase()+name.slice(1); button.title=lyricEffectCopy[name]; button.addEventListener('click',()=>window.setEffect?.(name)); effectButtons?.appendChild(button);
    }
    const usable = [...(effectButtons?.querySelectorAll('[data-effect]') || [])].filter(button => lyricEffects.includes(button.dataset.effect));
    if (!usable.length) return;
    let grid = $('kefeLyricStyleGrid');
    if (!grid) { grid=document.createElement('div'); grid.id='kefeLyricStyleGrid'; grid.className='wizard-all-effect-grid'; grid.setAttribute('role','group'); grid.setAttribute('aria-label','Lyric video styles'); host.appendChild(grid); }
    const names=usable.map(button=>button.dataset.effect);
    if (grid.dataset.names !== names.join('|')) {
      grid.dataset.names=names.join('|'); grid.replaceChildren();
      usable.forEach(sourceButton=>{ const name=sourceButton.dataset.effect, button=document.createElement('button'); button.type='button'; button.className='wizard-effect-choice'; button.dataset.wizardEffect=name; button.setAttribute('aria-pressed','false'); const demo=document.createElement('span'); demo.className='wizard-effect-demo'; demo.dataset.effect=name; const line=document.createElement('span'); line.className='wizard-effect-demo-line'; line.textContent='LYRICS'; demo.appendChild(line); const copy=document.createElement('span'); copy.className='wizard-effect-copy'; const title=document.createElement('strong'); title.textContent=sourceButton.textContent.trim(); const hint=document.createElement('small'); hint.textContent=lyricEffectCopy[name]||'Lyric animation'; copy.append(title,hint); button.append(demo,copy); button.addEventListener('click',()=>sourceButton.click()); grid.appendChild(button); });
    }
    syncLyricEffects(grid);
  }
  function syncLyricEffects(grid=$('kefeLyricStyleGrid')) { if (!grid) return; const current=window.state?.style?.effect||'apple'; grid.querySelectorAll('[data-wizard-effect]').forEach(button=>{const active=button.dataset.wizardEffect===current; button.classList.toggle('selected',active); button.setAttribute('aria-pressed',active?'true':'false');}); }
  function setSectionVisibility(step) { sidebar.querySelectorAll(':scope > .section').forEach(section=>{if(section.id!=='wizardSection')section.hidden=true;}); if(step.target)$(step.target)?.removeAttribute('hidden'); if(step.id==='preview')preview?.removeAttribute('hidden');else if(preview)preview.hidden=true; const style=$('lyricStyleBlock'),lyrics=$('lyricsPanel'); if(step.id==='style'){if(style){style.hidden=false;panel.appendChild(style);}}else{if(style&&lyrics&&!lyrics.contains(style))lyrics.appendChild(style);if(style)style.hidden=step.id!=='lyrics';} }
  function valid(step) { if(step.id==='source')return audioReady(); if(step.id==='lyrics')return lyricsReady(); return true; }
  function render() { const step=steps[index]; document.body.dataset.wizardStep=step.id; panel.innerHTML=''; if(step.id==='intro'){panel.innerHTML='<p class="wizard-panel-kicker">KEFE</p><h3 class="wizard-panel-title">Lyric Video</h3><p class="wizard-panel-hint">Create a synced lyric video from your media, lyrics, style and background.</p><button type="button" id="startLyricVideo" class="primary wizard-start">Start Lyric Video</button>';$('startLyricVideo').onclick=()=>{index=1;render();};} else if(step.id==='source')panel.innerHTML='<p class="wizard-panel-kicker">01 · Media</p><h3 class="wizard-panel-title">Add your media</h3><p class="wizard-panel-hint">Upload the audio or video that will drive the project. Song details appear with the media when available.</p>'; else if(step.id==='lyrics')panel.innerHTML='<p class="wizard-panel-kicker">02 · Lyrics</p><h3 class="wizard-panel-title">Add and sync your lyrics</h3><p class="wizard-panel-hint">Use song details to find synced lyrics automatically, upload an LRC file, or edit and time the lyrics manually.</p>'; else if(step.id==='style')panel.innerHTML='<p class="wizard-panel-kicker">03 · Style</p><h3 class="wizard-panel-title">Choose your lyric style</h3><p class="wizard-panel-hint">Pick the lyric treatment used by the live project preview.</p><div id="wizardStyleMount" class="wizard-style-mount"></div>'; else if(step.id==='background')panel.innerHTML='<p class="wizard-panel-kicker">04 · Background</p><h3 class="wizard-panel-title">Choose your background</h3><p class="wizard-panel-hint">Use a preset or your own image/video. Background settings stay separate from lyric style.</p>'; else if(step.id==='preview')panel.innerHTML='<p class="wizard-panel-kicker">05 · Preview</p><h3 class="wizard-panel-title">Preview the finished project</h3><p class="wizard-panel-hint">Play through the actual project before exporting.</p>'; else if(step.id==='export')panel.innerHTML='<p class="wizard-panel-kicker">06 · Export</p><h3 class="wizard-panel-title">Export your lyric video</h3><p class="wizard-panel-hint">Export the same project shown in Preview.</p>'; $('wizardProgress').textContent=`${String(index+1).padStart(2,'0')} / 06`;$('wizardStepLabel').textContent=step.label;back.disabled=index===0;next.textContent=index===steps.length-1?'Done':'Next';next.disabled=step.id==='intro'||!valid(step);setSectionVisibility(step);buildLyricEffects();syncLyricEffects();window.dispatchEvent(new CustomEvent('kefe:wizard-step',{detail:{step:step.id,index}})); }
  back.onclick=()=>{if(index>0){index-=1;render();}}; next.onclick=()=>{if(!valid(steps[index]))return;if(index<steps.length-1)index+=1;else return;render();}; document.addEventListener('change',event=>{if(steps[index].id==='source'||steps[index].id==='lyrics')next.disabled=!valid(steps[index]);if(steps[index].id==='style'&&event.target.closest('#lyricStyleBlock'))syncLyricEffects();},true); document.addEventListener('input',()=>{if(steps[index].id==='source'||steps[index].id==='lyrics')next.disabled=!valid(steps[index]);},true); render();
})();
