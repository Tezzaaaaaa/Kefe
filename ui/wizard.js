/* KEFE guided creation workflow. */
(() => {
    'use strict';
    const $ = id => document.getElementById(id);
    const body = document.body;
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar || $('wizardSection')) return;
    const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pad = n => String(n).padStart(2, '0');
    body.classList.add('wizard-mode');

    /* Background media picker: in wizard mode the editor drop-zone must not
       double-activate its <label> and the drop-zone click handler. */
    const backgroundDrop = $('bgDrop');
    const backgroundInput = $('backgroundInput');
    if (backgroundDrop && backgroundInput) {
        backgroundDrop.addEventListener('click', event => {
            if (!body.classList.contains('wizard-mode') || event.target === backgroundInput) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            backgroundInput.click();
        }, true);
    }

    const previewEl = document.querySelector('.preview');
    if (previewEl) {
        previewEl.id = 'previewSection';
        previewEl.classList.add('preview-collapsed');
        const toggleBar = document.createElement('button');
        toggleBar.type = 'button'; toggleBar.className = 'preview-toggle'; toggleBar.setAttribute('aria-label', 'Toggle preview');
        toggleBar.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 10h20" stroke="currentColor" stroke-width="1.5" fill="none"/></svg><span>Preview</span>';
        toggleBar.addEventListener('click', () => { const open = previewEl.classList.toggle('preview-expanded'); previewEl.classList.toggle('preview-collapsed', !open); toggleBar.setAttribute('aria-pressed', String(open)); });
        sidebar.appendChild(toggleBar);
    }

    const PATHS = { lyric:['intro','source','text','fx','background','preview','review'], visualiser:['intro','source','fx','background','preview','review'], captioned:['intro','source','captionsgen','captionsreview','fx','background','preview','review'], custom:['intro','source','text','fx','background','preview','review'] };
    const PATH_LABELS = { lyric:'Lyric Video', visualiser:'Visualiser', captioned:'Captioned Video', custom:'Custom' };
    const PATH_HINTS = { lyric:'Synced lyrics with expressive motion.', visualiser:'Audio-reactive visuals without lyrics.', captioned:'Timed captions for spoken audio or video.', custom:'Build your own combination from scratch.' };
    const STEP_TITLES = { intro:'What are you making?', source:'Choose your source', text:'Lyrics & Captions', fx:'Visual FX', background:'Background', preview:'Preview', review:'Export Review', captionsgen:'Generate Captions', captionsreview:'Caption Review' };
    const CHOICE_ICONS = {
        lyric:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 11h16M4 16h10"/><circle cx="18.2" cy="17.4" r="2.6"/><path d="M20.8 17.4V8.2l-2.6.9"/></svg>',
        visualiser:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4"/></svg>',
        captioned:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M10.5 10.5a2.5 2.5 0 1 0 0 3M17 10.5a2.5 2.5 0 1 0 0 3"/></svg>',
        custom:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h9M5 17h12"/><circle cx="18.6" cy="12" r="2.1"/></svg>'
    };
    const SOURCE_ICONS = {
        uploaded:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M8 8l4-4 4 4M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/></svg>',
        media:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m10 9 5 3-5 3z"/></svg>',
        none:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h10M4 17h16"/><path d="m17 10 4 4m0-4-4 4"/></svg>'
    };
    const wizard = { path:'lyric', index:0, choice:null, source:null };
    function stepsFor(){ return (PATHS[wizard.path]||PATHS.lyric).filter(s=>s!=='captionsgen'||Boolean($('captionGenSection'))).filter(s=>s!=='captionsreview'||Boolean($('captionReviewSection'))); }
    function fxSectionId(){ const el=$('visualFxSection')||$('fxSection'); return el?el.id:null; }
    function targetsForStep(step){ if(step==='source'){if(wizard.source==='uploaded')return['audioSection'];if(wizard.source==='media')return['backgroundSection'];return[];} if(step==='text')return['textSection']; if(step==='fx')return[fxSectionId()].filter(Boolean); if(step==='background')return['backgroundSection']; if(step==='captionsgen')return['captionGenSection']; if(step==='captionsreview')return['captionReviewSection']; return[]; }
    const panel=document.createElement('div'); panel.className='section wizard-panel'; panel.id='wizardSection'; sidebar.insertBefore(panel,sidebar.firstChild);
    const nav=document.createElement('div'); nav.className='wizard-nav'; nav.id='wizardNav'; nav.innerHTML='<button type="button" id="wizardBackBtn" class="wizard-back" disabled>Back</button><div class="wizard-progress-wrap"><div id="wizardProgress" class="wizard-progress">01 / 08</div><button type="button" id="wizardSkipBtn" class="wizard-skip">Skip setup</button></div><button type="button" id="wizardNextBtn" class="primary wizard-next">Next</button>'; sidebar.appendChild(nav);
    const stepHeading=document.createElement('div'); stepHeading.className='wizard-step-heading'; let fadeTimer=null;
    function hasLoadedAudio(){const a=window.state?.audio;return Boolean(a&&(a.file||a.ready||a.duration>0));}
    function sourceReady(){if(!wizard.source)return false;if(wizard.source==='none')return true;const m=window.kefeMedia||{};if(wizard.source==='uploaded')return hasLoadedAudio()||Boolean(m.videoFile);if(wizard.source==='media')return Boolean(m.image||m.video||m.videoFile);return true;}
    function lyricsReady(){if(window.state?.lyrics?.lines?.length)return true;const t=$('lyricsText');return Boolean(t&&t.value.trim());}
    function captionsReady(){if(window.kefeCaptionGen?.isBusy?.())return false;return Boolean(window.state?.captions?.lines?.length);}
    function nextEnabled(step){if(step==='intro')return Boolean(wizard.choice);if(step==='source')return sourceReady();if(step==='text')return lyricsReady();if(step==='captionsgen'||step==='captionsreview')return captionsReady();return true;}
    let refreshQueued=false; function refreshNextState(){if(refreshQueued)return;refreshQueued=true;setTimeout(()=>{refreshQueued=false;const step=stepsFor()[wizard.index];const b=$('wizardNextBtn');if(step&&b)b.disabled=!nextEnabled(step);},0);}
    function applyStep(){const steps=stepsFor();const step=steps[wizard.index]||'preview';body.dataset.wizardStep=step;if((step==='preview'||step==='review')&&previewEl){previewEl.classList.remove('preview-collapsed');previewEl.classList.add('preview-expanded');}if(step==='captionsreview'&&window.kefeCaptionGen)window.kefeCaptionGen.refreshReview();if(step==='captionsgen'&&window.kefeCaptionGen)window.kefeCaptionGen.syncGenerateButton();document.querySelectorAll('.wizard-current').forEach(el=>el.classList.remove('wizard-current'));body.classList.toggle('wizard-src-audio',step==='source'&&wizard.source==='uploaded');body.classList.toggle('wizard-src-media',step==='source'&&wizard.source==='media');const targetIds=targetsForStep(step);let firstTarget=null;if(targetIds.length){targetIds.forEach(id=>{const el=$(id);if(el){el.classList.add('wizard-current');if(!firstTarget)firstTarget=el;}});panel.innerHTML='';}else{renderPanel(step);firstTarget=panel;}panel.classList.toggle('wizard-current',!targetIds.length);if(firstTarget&&firstTarget!==panel){stepHeading.textContent=STEP_TITLES[step]||'';if(step==='source'&&wizard.source){const change=document.createElement('button');change.type='button';change.className='wizard-change-source';change.textContent='Change';change.addEventListener('click',()=>{wizard.source=null;applyStep();});stepHeading.appendChild(change);}firstTarget.prepend(stepHeading);}else stepHeading.remove();$('wizardProgress').textContent=`${pad(wizard.index+1)} / ${pad(steps.length)}`;$('wizardBackBtn').disabled=wizard.index===0;const next=$('wizardNextBtn');next.textContent=step==='preview'?'Export Review':'Next';next.disabled=!nextEnabled(step);if(firstTarget){firstTarget.setAttribute('tabindex','-1');firstTarget.focus({preventScroll:true});}}
    function renderPanel(step){if(step==='intro')return renderIntro();if(step==='source')return renderSource();if(step==='preview')return renderPreview();panel.innerHTML='';}
    function renderIntro(){panel.innerHTML='<p class="wizard-panel-kicker">01 · Start</p><h3 class="wizard-panel-title">What are you making?</h3><p class="wizard-panel-hint">Choose a format. KEFE will tailor the workflow to it.</p><div class="wizard-choices">'+['lyric','visualiser','captioned','custom'].map(k=>`<button type="button" class="wizard-choice${wizard.choice===k?' selected':''}" data-choice="${k}"><span class="wizard-choice-visual"><span class="wizard-choice-icon">${CHOICE_ICONS[k]}</span><span class="wizard-choice-lines"></span></span><span class="wizard-choice-copy"><strong>${PATH_LABELS[k]}</strong><span>${PATH_HINTS[k]}</span></span></button>`).join('')+'</div>';panel.querySelectorAll('[data-choice]').forEach(btn=>btn.addEventListener('click',()=>{const c=btn.dataset.choice;if(wizard.choice!==c)wizard.source=null;wizard.choice=c;wizard.path=c;wizard.index=Math.min(wizard.index,PATHS[c].length-1);if(typeof window.kefeSetProjectType==='function')window.kefeSetProjectType(c);panel.querySelectorAll('.wizard-choice').forEach(x=>x.classList.toggle('selected',x.dataset.choice===c));$('wizardNextBtn').disabled=false;}));}
    function renderSource(){const isCaptioned=wizard.choice==='captioned';const options=isCaptioned?[['uploaded','Voice recording or music','Upload the audio you want to caption.'],['media','Video clip','Use the video’s soundtrack.']]:[['uploaded','Your track','Upload the audio you want to use.'],['media','Video clip','Use the video’s soundtrack.'],['none','No audio','Create silent visuals.']];panel.innerHTML=`<p class="wizard-panel-kicker">02 · Source</p><h3 class="wizard-panel-title">Where does your sound come from?</h3><p class="wizard-panel-hint">Pick one. The relevant controls appear next.</p><div class="wizard-choices wizard-source-choices">${options.map(([v,l,h])=>`<button type="button" class="wizard-choice${wizard.source===v?' selected':''}" data-source="${v}"><span class="wizard-choice-visual"><span class="wizard-choice-icon">${SOURCE_ICONS[v]}</span><span class="wizard-choice-lines"></span></span><span class="wizard-choice-copy"><strong>${l}</strong><span>${h}</span></span></button>`).join('')}</div>`;panel.querySelectorAll('[data-source]').forEach(btn=>btn.addEventListener('click',()=>applySourceChoice(btn.dataset.source)));}
    function applySourceChoice(source){wizard.source=source;window.kefeWizardSource=source;const st=window.state;if(typeof window.applyMasterSelection==='function'){try{if(source==='none')window.applyMasterSelection('none',{userInitiated:true,silent:true});if(source==='uploaded')window.applyMasterSelection('uploaded',{userInitiated:false,silent:true});if(source==='media'){if(st?.audioSource)st.audioSource.userChosen=false;const m=window.kefeMedia||{};if(m.video&&m.videoFile&&m.videoHasAudio)window.applyMasterSelection('video',{userInitiated:false,silent:true});}}catch(e){}}applyStep();}
    function renderPreview(){const st=window.state||{};const media=window.kefeMedia||{};const labels={uploaded:'Uploaded audio',video:'Background video audio',none:'No audio (muted)'};const rows=[['Project',PATH_LABELS[wizard.choice]||'—'],['Audio source',labels[st.audioSource?.master]||'Uploaded audio']];rows.push(wizard.choice==='visualiser'?['Timed text','None — clean visuals']:['Lyric effect',st.style?.effect||'Apple']);rows.push(['Visual FX',st.style?.visualFx&&st.style.visualFx!=='none'?st.style.visualFx:'Off'],['Background',media.image?'Image background':media.video?'Video background':`Solid ${st.background?.solid||'#0A0A0A'}`],['Title intro',st.style?.titleCardEnabled===false?'Off':'On']);if(wizard.choice==='captioned')rows.splice(3,0,['Captions',st.captions?.lines?.length?`${st.captions.lines.length} segments`:'Not generated']);panel.innerHTML='<p class="wizard-panel-kicker">Preview</p><h3 class="wizard-panel-title">Check your setup</h3><p class="wizard-panel-hint">Everything can still be changed before export.</p><div class="wizard-summary">'+rows.map(([k,v])=>`<div class="wizard-summary-row"><span>${k}</span><strong>${v}</strong></div>`).join('')+'</div><button type="button" id="wizardPlayBtn" class="primary full-width">Play preview</button>';$('wizardPlayBtn').addEventListener('click',()=>{$('playBtn')?.click();});}
    function finishWizard(){clearTimeout(fadeTimer);sidebar.classList.remove('wizard-fading');stepHeading.remove();nav.remove();panel.remove();document.querySelectorAll('.wizard-current').forEach(el=>el.classList.remove('wizard-current'));body.classList.remove('wizard-mode','wizard-src-audio','wizard-src-media');delete body.dataset.wizardStep;document.querySelectorAll('.section-nav-link').forEach(link=>link.classList.toggle('active',link.dataset.nav==='export'));document.querySelectorAll('.sidebar .section').forEach(s=>s.classList.toggle('active',s.id==='exportSection'));$('exportSection')?.scrollIntoView({block:'start',behavior:reducedMotion?'auto':'smooth'});}
    function goTo(index){const steps=stepsFor();if(index<0||index>=steps.length)return;if(index===wizard.index){applyStep();return;}wizard.index=index;if(reducedMotion){applyStep();return;}sidebar.classList.add('wizard-fading');clearTimeout(fadeTimer);fadeTimer=setTimeout(()=>{applyStep();sidebar.classList.remove('wizard-fading');},150);}
    $('wizardBackBtn').addEventListener('click',()=>goTo(wizard.index-1));$('wizardNextBtn').addEventListener('click',()=>{const step=stepsFor()[wizard.index];if(!nextEnabled(step))return;if(step==='preview'){finishWizard();return;}goTo(wizard.index+1);});$('wizardSkipBtn').addEventListener('click',finishWizard);
    new MutationObserver(refreshNextState).observe(sidebar,{childList:true,subtree:true,characterData:true});sidebar.addEventListener('input',refreshNextState);sidebar.addEventListener('change',refreshNextState);sidebar.addEventListener('click',refreshNextState);applyStep();
})();
