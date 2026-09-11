/* KEFE Lyric Video pathway — cohesive workflow polish and timing editor. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const q = (sel, root = document) => root.querySelector(sel);
  const qa = (sel, root = document) => [...root.querySelectorAll(sel)];
  let editorOpen = false;
  let activeRow = -1;

  const css = `
    #lyricsEditor .modal-content { width:min(1100px,96vw); max-height:92vh; }
    #lyricsEditor .modal-body { overflow:auto; }
    .kefe-lyric-editor { display:grid; gap:14px; }
    .kefe-lyric-toolbar { display:flex; flex-wrap:wrap; gap:8px; align-items:center; padding:10px; border:1px solid var(--line); border-radius:12px; background:var(--surface-2); }
    .kefe-lyric-toolbar .kefe-editor-readout { margin-left:auto; color:var(--text-2); font-size:12px; font-variant-numeric:tabular-nums; }
    .kefe-live-panel { display:grid; grid-template-columns:1fr auto; gap:10px; align-items:center; padding:12px; border:1px solid var(--line); border-radius:12px; background:var(--surface); }
    .kefe-live-panel strong { display:block; font-size:13px; }
    .kefe-live-panel span { display:block; margin-top:3px; color:var(--text-2); font-size:11px; }
    .kefe-live-actions { display:flex; flex-wrap:wrap; gap:7px; justify-content:flex-end; }
    .kefe-live-actions button { white-space:nowrap; }
    .kefe-lyric-list { display:grid; gap:6px; }
    .kefe-lyric-row { display:grid; grid-template-columns:78px minmax(0,1fr) auto; gap:8px; align-items:center; padding:7px; border:1px solid var(--line); border-radius:10px; background:var(--surface); transition:border-color .15s, background .15s; }
    .kefe-lyric-row.is-active { border-color:var(--text); background:var(--surface-2); }
    .kefe-lyric-time, .kefe-lyric-text { width:100%; box-sizing:border-box; }
    .kefe-lyric-time { font-variant-numeric:tabular-nums; }
    .kefe-lyric-actions { display:flex; gap:5px; }
    .kefe-lyric-actions button { min-width:32px; padding:7px 8px; }
    .kefe-lyric-empty { padding:24px; border:1px dashed var(--line-strong); border-radius:12px; text-align:center; color:var(--text-2); }
    .kefe-lyric-help { color:var(--text-2); font-size:11px; line-height:1.5; }
    .wizard-source-confirm { display:flex; align-items:center; gap:9px; margin-top:10px; padding:10px 12px; border:1px solid rgba(36,150,80,.35); border-radius:10px; background:rgba(36,150,80,.08); color:var(--text); font-size:12px; }
    .wizard-source-confirm[hidden] { display:none; }
    .wizard-source-confirm .check { width:20px; height:20px; border-radius:50%; display:grid; place-items:center; background:#2f9e5b; color:#fff; font-weight:800; }
    .wizard-metadata-warning { margin-top:10px; padding:11px 12px; border:1px solid rgba(200,120,20,.35); border-radius:10px; background:rgba(200,120,20,.08); color:var(--text); font-size:12px; line-height:1.45; }
    .wizard-metadata-warning strong { display:block; margin-bottom:3px; }
    .wizard-metadata-warning[hidden] { display:none; }
    .wizard-style-preview { min-height:420px; border-radius:18px; overflow:hidden; border:1px solid var(--line); box-shadow:0 18px 55px rgba(0,0,0,.16); }
    .wizard-all-effect-grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
    .wizard-all-effect-grid .wizard-effect-choice { min-height:116px; text-align:left; border-radius:14px; }
    .wizard-all-effect-grid .wizard-effect-demo { min-height:68px; border-radius:9px; }
    .wizard-all-effect-grid .wizard-effect-copy { padding-top:8px; }
    .wizard-all-effect-grid .wizard-effect-copy strong { font-size:13px; }
    .wizard-all-effect-grid .wizard-effect-copy small { color:var(--text-3); }
    .kefe-preview-checks { display:grid; gap:7px; margin:14px 0; }
    .kefe-preview-check { display:flex; justify-content:space-between; gap:12px; padding:10px 12px; border:1px solid var(--line); border-radius:10px; font-size:12px; }
    .kefe-preview-check span:last-child { font-weight:700; }
    .kefe-preview-check.ok span:last-child { color:#2f9e5b; }
    .kefe-preview-check.warn span:last-child { color:#b36b00; }
    .kefe-preview-actions { display:flex; flex-wrap:wrap; gap:8px; }
    @media (max-width:700px) { .wizard-all-effect-grid { grid-template-columns:1fr; } .kefe-lyric-row { grid-template-columns:72px minmax(0,1fr); } .kefe-lyric-actions { grid-column:1/-1; } .kefe-live-panel { grid-template-columns:1fr; } .kefe-live-actions { justify-content:flex-start; } }
  `;

  function installCss() {
    if ($('kefeLyricPathwayCSS')) return;
    const s = document.createElement('style'); s.id = 'kefeLyricPathwayCSS'; s.textContent = css; document.head.appendChild(s);
  }

  function sourceReady() {
    const st = window.state;
    return Boolean(st?.audio?.file && st.audio.ready && Number(st.audio.duration) > 0);
  }

  function metadataComplete() {
    return Boolean($('metaArtist')?.value.trim() && $('metaTitle')?.value.trim());
  }

  function metadataWarning() {
    const lyricsPanel = $('lyricsPanel');
    if (!lyricsPanel) return;
    let box = $('kefeMetadataWarning');
    if (!box) {
      box = document.createElement('div'); box.id = 'kefeMetadataWarning'; box.className = 'wizard-metadata-warning';
      lyricsPanel.insertBefore(box, lyricsPanel.firstChild);
    }
    const complete = metadataComplete();
    box.hidden = complete;
    box.innerHTML = '<strong>Song details needed</strong>Artist and Title are required to search for the correct synced lyrics. Album is optional. Fill them in above, then use “Find lyrics automatically”.';
    const find = $('findLyricsBtn');
    if (find) find.disabled = !complete || Boolean(window.isExporting);
  }

  function refreshSourceConfirmation() {
    if (document.body.dataset.wizardStep !== 'source') return;
    const panel = $('wizardSection'); if (!panel) return;
    let confirm = q('.wizard-source-confirm', panel);
    if (!confirm) {
      confirm = document.createElement('div'); confirm.className = 'wizard-source-confirm'; confirm.hidden = true;
      confirm.innerHTML = '<span class="check">✓</span><span class="copy"></span>';
      const action = q('.wizard-source-action', panel); action?.after(confirm);
    }
    const copy = q('.copy', confirm);
    if (window.kefeWizardSource === 'uploaded' && sourceReady()) {
      confirm.hidden = false;
      const name = window.state.audio.file?.name || 'Audio file';
      if (copy) copy.textContent = `${name} loaded and ready. This audio is the master sync source.`;
    } else confirm.hidden = true;
  }

  function currentLines() { return Array.isArray(window.state?.lyrics?.lines) ? window.state.lyrics.lines : []; }
  function setPlayhead(time) { window.state.playback.currentTime = Math.max(0, Number(time) || 0); window.redrawCurrentPreviewFrame?.(); }

  function renderEditorRows() {
    const list = $('kefeLyricList'); if (!list) return;
    const lines = currentLines();
    list.replaceChildren();
    if (!lines.length) {
      const empty = document.createElement('div'); empty.className='kefe-lyric-empty'; empty.textContent='No timed lyrics yet. Upload an LRC, find lyrics automatically, or paste timed LRC below.'; list.appendChild(empty); return;
    }
    lines.forEach((line, i) => {
      const row = document.createElement('div'); row.className='kefe-lyric-row'; row.dataset.index=String(i);
      const time = document.createElement('input'); time.className='kefe-lyric-time'; time.type='text'; time.inputMode='decimal'; time.value=formatTimeInput(line.time); time.setAttribute('aria-label',`Line ${i+1} time`);
      const text = document.createElement('input'); text.className='kefe-lyric-text'; text.type='text'; text.value=String(line.text||''); text.setAttribute('aria-label',`Line ${i+1} lyrics`);
      const actions=document.createElement('div'); actions.className='kefe-lyric-actions';
      const play=document.createElement('button'); play.type='button'; play.textContent='▶'; play.title='Play from this line'; play.addEventListener('click',()=>{ setPlayhead(Number(line.time)||0); const mode=window.state.audioSource?.master; if(mode==='uploaded') window.document.getElementById('playBtn')?.click(); });
      const set=document.createElement('button'); set.type='button'; set.textContent='Set'; set.title='Set this line to the current playhead'; set.addEventListener('click',()=>{ line.time=Math.max(0,Number(window.state.playback.currentTime)||0); sortLines(); renderEditorRows(); markEditorDirty(); });
      const del=document.createElement('button'); del.type='button'; del.textContent='×'; del.title='Delete line'; del.addEventListener('click',()=>{ lines.splice(i,1); sortLines(); renderEditorRows(); markEditorDirty(); });
      actions.append(play,set,del);
      time.addEventListener('change',()=>{ const parsed=parseTimeInput(time.value); if(parsed==null){time.value=formatTimeInput(line.time);return;} line.time=parsed; sortLines(); renderEditorRows(); markEditorDirty(); });
      text.addEventListener('input',()=>{ line.text=text.value; markEditorDirty(); });
      row.append(time,text,actions); list.appendChild(row);
    });
    highlightActiveRow();
  }

  function formatTimeInput(v) { const n=Math.max(0,Number(v)||0); const m=Math.floor(n/60), s=(n%60).toFixed(2).padStart(5,'0'); return `${String(m).padStart(2,'0')}:${s}`; }
  function parseTimeInput(raw) { const s=String(raw||'').trim(); if(/^\d+(?:\.\d+)?$/.test(s)) return Number(s); const m=s.match(/^(\d{1,3}):([0-5]?\d)(?:[.:](\d{1,3}))?$/); if(!m) return null; return Number(m[1])*60+Number(m[2])+(m[3]?Number(`0.${m[3]}`):0); }
  function sortLines(){ const lines=currentLines(); lines.sort((a,b)=>(Number(a.time)||0)-(Number(b.time)||0)); for(let i=0;i<lines.length;i++) lines[i].endTime=i<lines.length-1?Number(lines[i+1].time):Math.max(Number(lines[i].time)+0.5,Number(lines[i].endTime)||Number(lines[i].time)+5); }
  function markEditorDirty(){ $('editorStatus').textContent='Unsaved timing/text changes'; $('editorStatus').className='status'; window.dispatchEvent(new Event('kefe:lyric-editor-change')); window.redrawCurrentPreviewFrame?.(); }

  function buildEditor() {
    const modal=$('lyricsEditor'), body=q('.modal-body',modal); if(!modal||!body||$('kefeLyricEditor')) return;
    const existingTextarea=$('lyricsText');
    const editor=document.createElement('div'); editor.id='kefeLyricEditor'; editor.className='kefe-lyric-editor';
    editor.innerHTML=`
      <div class="kefe-lyric-toolbar">
        <button type="button" id="kefeAddLine" class="file-button">Add line</button>
        <button type="button" id="kefeNudgeAllEarlier" class="file-button">−0.1s all</button>
        <button type="button" id="kefeNudgeAllLater" class="file-button">+0.1s all</button>
        <button type="button" id="kefeJumpPlayhead" class="file-button">Jump to playhead</button>
        <span class="kefe-editor-readout" id="kefeEditorReadout">Playhead 0:00.00</span>
      </div>
      <div class="kefe-live-panel">
        <div><strong>Live timing</strong><span>Play the song, then use “Set” on the line that should start at the current moment. The active line follows the playhead while you work.</span></div>
        <div class="kefe-live-actions"><button type="button" id="kefeSetActive" class="primary">Set active line</button><button type="button" id="kefePlayPause" class="file-button">Play / pause</button></div>
      </div>
      <div class="kefe-lyric-list" id="kefeLyricList"></div>
      <div class="kefe-lyric-help">Timing accepts MM:SS.xx or seconds. Changes are applied to the same lyric state used by Preview and Export. The original LRC text area remains available below as an advanced fallback.</div>`;
    body.insertBefore(editor, body.firstChild);
    existingTextarea?.setAttribute('aria-label','Advanced LRC source');
    existingTextarea?.setAttribute('rows','8');

    $('kefeAddLine').addEventListener('click',()=>{ const lines=currentLines(); const last=lines[lines.length-1]; const start=last?Math.max(0,Number(last.time)+Math.max(.5,Number(last.endTime)-Number(last.time)||3)):Number(window.state.playback.currentTime)||0; lines.push({time:start,endTime:start+3,text:''}); sortLines(); renderEditorRows(); markEditorDirty(); });
    $('kefeNudgeAllEarlier').addEventListener('click',()=>nudgeAll(-.1));
    $('kefeNudgeAllLater').addEventListener('click',()=>nudgeAll(.1));
    $('kefeJumpPlayhead').addEventListener('click',()=>setPlayhead(Number(window.state.playback.currentTime)||0));
    $('kefeSetActive').addEventListener('click',()=>{ const lines=currentLines(); const t=Number(window.state.playback.currentTime)||0; let idx=-1; for(let i=0;i<lines.length;i++){if(Number(lines[i].time)<=t)idx=i;else break;} if(idx<0)idx=0; if(lines[idx]){lines[idx].time=t;sortLines();renderEditorRows();activeRow=idx;markEditorDirty();} });
    $('kefePlayPause').addEventListener('click',()=>$('playBtn')?.click());
    renderEditorRows();
  }

  function nudgeAll(delta){ currentLines().forEach(l=>{l.time=Math.max(0,(Number(l.time)||0)+delta); if(Number.isFinite(Number(l.endTime)))l.endTime=Math.max(l.time,Number(l.endTime)+delta);}); sortLines(); renderEditorRows(); markEditorDirty(); }

  function openEditor(){ if(window.isExporting)return; buildEditor(); editorOpen=true; $('lyricsEditor').classList.remove('hidden'); renderEditorRows(); highlightActiveRow(); }
  function closeEditor(){ editorOpen=false; $('lyricsEditor')?.classList.add('hidden'); }
  function highlightActiveRow(){ if(!editorOpen)return; const t=Number(window.state?.playback?.currentTime)||0; let idx=-1; const lines=currentLines(); for(let i=0;i<lines.length;i++){if(Number(lines[i].time)<=t)idx=i;else break;} activeRow=idx; qa('.kefe-lyric-row').forEach((r,i)=>r.classList.toggle('is-active',i===idx)); const readout=$('kefeEditorReadout'); if(readout)readout.textContent=`Playhead ${formatTimeInput(t)}`; }

  function wireEditorOverride(){
    document.addEventListener('click',e=>{ const b=e.target.closest('#editLyricsBtn'); if(!b)return; e.preventDefault(); e.stopImmediatePropagation(); openEditor(); },true);
    document.addEventListener('click',e=>{ if(e.target.closest('#closeEditor,#cancelEditor')){ if(editorOpen)closeEditor(); } });
  }

  function enhancePreview(){
    if(document.body.dataset.wizardStep!=='preview')return;
    const panel=$('wizardSection'); if(!panel||$('kefePreviewChecks'))return;
    const checks=document.createElement('div'); checks.id='kefePreviewChecks'; checks.className='kefe-preview-checks'; panel.appendChild(checks);
    const actions=document.createElement('div'); actions.className='kefe-preview-actions';
    const play=document.createElement('button'); play.type='button'; play.className='primary'; play.textContent='Play preview'; play.onclick=()=>$('playBtn')?.click();
    const full=document.createElement('button'); full.type='button'; full.className='file-button'; full.textContent='Full screen'; full.onclick=()=>document.querySelector('.preview')?.requestFullscreen?.().catch(()=>{});
    actions.append(play,full); panel.appendChild(actions);
    const refresh=()=>{ const st=window.state||{}; const rows=[['Audio',sourceReady(),sourceReady()?'Ready':'Missing'],['Song details',metadataComplete(),metadataComplete()?'Ready':'Artist + Title required'],['Lyrics',Boolean(st.lyrics?.lines?.length),st.lyrics?.lines?.length?`${st.lyrics.lines.length} lines`:'Missing'],['Timing',Boolean(st.lyrics?.lines?.length),st.lyrics?.lines?.length?'Check playback before export':'Missing']]; checks.replaceChildren(...rows.map(([label,ok,text])=>{const d=document.createElement('div');d.className='kefe-preview-check '+(ok?'ok':'warn');d.innerHTML=`<span>${label}</span><span>${text}</span>`;return d;})); };
    refresh();
  }

  function syncStep(){
    const step=document.body.dataset.wizardStep;
    if(step==='lyrics') metadataWarning();
    if(step==='source') refreshSourceConfirmation();
    if(step==='preview') enhancePreview();
    if(editorOpen) highlightActiveRow();
  }

  function start(){
    installCss();
    wireEditorOverride();
    const observer=new MutationObserver(()=>syncStep()); observer.observe(document.body,{attributes:true,childList:true,subtree:true,attributeFilter:['data-wizard-step','class','value']});
    setInterval(()=>{syncStep(); if(editorOpen)highlightActiveRow();},180);
    document.addEventListener('input',e=>{if(['metaArtist','metaTitle'].includes(e.target?.id))metadataWarning();});
    syncStep();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
