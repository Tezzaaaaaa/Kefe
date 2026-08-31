/* KEFE Caption Generator — automatic speech-to-timed-captions.
   Transcribes the master audio/video source and feeds the result into KEFE's
   EXISTING caption system (state.captions.lines + applyTextMode), so rendering,
   effects, preview, export and project save/load behave exactly as with native
   timed text. No second renderer, no duplicated upload controls.

   Transcription providers are pluggable via window.kefeTranscription:
   - local-whisper: Whisper running fully in-browser via transformers.js (WASM).
   - server: POSTs to this site's /api/transcribe (key lives only server-side). */
(() => {
    'use strict';
    if (window.kefeCaptionGen) return;
    const $ = id => document.getElementById(id);
    const state = window.state;
    if (!state) return;

    const CAPTION_MAX_BLOCKS = 2000;

    function fmtShort(t) {
        const v = Math.max(0, Number(t) || 0);
        const m = Math.floor(v / 60);
        const s = (v % 60).toFixed(1);
        return `${m}:${s.padStart(4, '0')}`;
    }
    function setStatus(message, kind) {
        const el = $('captionGenStatus');
        if (!el) return;
        el.textContent = message;
        el.className = 'status' + (kind ? ' ' + kind : '');
    }
    function setProgress(pct) {
        const bar = $('captionGenProgress');
        if (!bar) return;
        if (pct === null) { bar.hidden = true; bar.removeAttribute('value'); return; }
        bar.hidden = false;
        bar.value = Math.max(0, Math.min(100, pct));
        const f = Math.max(0, Math.min(1, pct / 100));
        if (f > progressFraction + 0.005) { progressFraction = f; progressSamples++; }
    }

    let timerInterval = null;
    let timerStartedAt = 0;
    let progressFraction = 0;
    let progressSamples = 0;
    function fmtClock(seconds) {
        const v = Math.max(0, Math.floor(seconds));
        return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
    }
    function elapsedSeconds() { return (performance.now() - timerStartedAt) / 1000; }
    function renderTimer() {
        const el = $('captionGenTimerText');
        if (!el) return;
        const elapsed = elapsedSeconds();
        const canEstimate = progressSamples >= 2 && progressFraction >= 0.06 && progressFraction <= 0.94;
        el.textContent = canEstimate
            ? `Generating captions… Elapsed ${fmtClock(elapsed)} · Est. remaining ${fmtClock(elapsed * (1 - progressFraction) / progressFraction)}`
            : `Generating captions… Elapsed ${fmtClock(elapsed)}`;
    }
    function startCaptionTimer() {
        timerStartedAt = performance.now();
        progressFraction = 0;
        progressSamples = 0;
        const el = $('captionGenTimer');
        if (el) { el.hidden = false; el.classList.add('running'); }
        renderTimer();
        clearInterval(timerInterval);
        timerInterval = setInterval(renderTimer, 500);
    }
    function stopCaptionTimer() {
        clearInterval(timerInterval);
        timerInterval = null;
        const el = $('captionGenTimer');
        if (!el) return;
        el.classList.remove('running');
        const text = $('captionGenTimerText');
        if (text) text.textContent = `Finished in ${fmtClock(elapsedSeconds())}`;
        setTimeout(() => { if (el && !el.classList.contains('running')) el.hidden = true; }, 4000);
    }

    function resolveSourceFile() {
        const media = window.kefeMedia || {};
        const mode = state.audioSource?.master || 'uploaded';
        if (mode === 'video') return media.videoFile || state.audio.file || null;
        return state.audio.file || media.videoFile || null;
    }

    async function decodeToMono16k(file) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        if (!AudioCtx || !OfflineCtx) throw new Error('This browser cannot decode audio.');
        let decoded;
        try {
            decoded = await new AudioCtx().decodeAudioData(await file.arrayBuffer());
        } catch (e) {
            throw new Error('Could not decode this file\'s audio track — try MP3/WAV/M4A, or a video with a standard audio track.');
        }
        const rate = 16000;
        const length = Math.max(1, Math.ceil(decoded.duration * rate));
        const offline = new OfflineCtx(1, length, rate);
        const src = offline.createBufferSource();
        src.buffer = decoded;
        src.connect(offline.destination);
        src.start();
        const rendered = await offline.startRendering();
        return { float32: rendered.getChannelData(0), duration: decoded.duration };
    }

    const registry = {
        providers: new Map(),
        defaultId: 'local-whisper',
        register(provider) {
            if (provider && provider.id && typeof provider.transcribe === 'function') this.providers.set(provider.id, provider);
        },
        get(id) { return this.providers.get(id) || this.providers.get(this.defaultId) || null; },
        list() { return [...this.providers.values()]; }
    };
    window.kefeTranscription = registry;

    function buildSegmentsFromWords(words) {
        const clean = (words || [])
            .map(w => ({ text: String(w.text || '').trim(), start: Number(w.start), end: Number(w.end) }))
            .filter(w => w.text && Number.isFinite(w.start) && w.start >= 0)
            .map(w => ({ ...w, end: (Number.isFinite(w.end) && w.end > w.start) ? w.end : w.start + 0.4 }))
            .sort((a, b) => a.start - b.start);
        const MAX_CHARS = 56, MAX_DUR = 4.2, GAP_BREAK = 0.7;
        const segments = [];
        let cur = null;
        for (const word of clean) {
            const gap = cur ? word.start - cur.end : 0;
            const chars = cur ? cur.text.length + 1 + word.text.length : word.text.length;
            const dur = cur ? word.end - cur.start : word.end - word.start;
            const closesSentence = cur && /[.!?…]$/.test(cur.text);
            if (cur && (chars > MAX_CHARS || dur > MAX_DUR || gap > GAP_BREAK || (closesSentence && chars > 24))) {
                segments.push(cur);
                cur = null;
            }
            if (!cur) cur = { text: '', start: word.start, end: word.end, words: [] };
            cur.text = cur.text ? `${cur.text} ${word.text}` : word.text;
            cur.end = Math.max(cur.end, word.end);
            cur.words.push({ text: word.text, time: word.start, endTime: word.end });
        }
        if (cur) segments.push(cur);
        return segments.map(s => ({ text: s.text, time: Math.max(0, s.start - 0.05), endTime: s.end + 0.25, words: s.words }));
    }

    function normaliseTimedSegments(list) {
        return (list || [])
            .map(s => ({ text: String(s?.text || '').trim(), time: Math.max(0, Number(s?.start) || 0), endTime: Number.isFinite(Number(s?.end)) ? Number(s.end) : (Number(s?.start) || 0) + 3 }))
            .filter(s => s.text)
            .sort((a, b) => a.time - b.time);
    }

    registry.register({
        id: 'local-whisper',
        label: 'Local — in-browser Whisper (private)',
        async transcribe(ctx) {
            const { onStatus, onProgress, audio, options } = ctx;
            onStatus('Loading the speech model — first use downloads it (40–80 MB), then it is cached by the browser…');
            onProgress(3);
            let mod;
            try { mod = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js'); }
            catch (e) { throw new Error('Could not load the local speech model (an internet connection is needed the first time). Try the KEFE server provider instead.'); }
            try { mod.env.allowLocalModels = false; } catch (e) {}
            const modelId = options?.model || 'Xenova/whisper-tiny.en';
            const asr = await mod.pipeline('automatic-speech-recognition', modelId, {
                quantized: true,
                progress_callback: p => { if (p && p.status === 'progress' && Number.isFinite(p.progress)) onProgress(Math.min(90, 3 + p.progress * 0.85)); }
            });
            onStatus('Transcribing speech locally — this can take a while on long recordings…');
            onProgress(5);
            let chunksDone = 0;
            const estimatedChunks = Math.max(1, Math.round(audio.duration / 30));
            const output = await asr(audio.float32, {
                chunk_length_s: 30,
                stride_length_s: 5,
                return_timestamps: 'word',
                chunk_callback: () => { chunksDone++; onProgress(Math.min(96, 5 + (chunksDone / estimatedChunks) * 91)); }
            });
            const words = (output?.chunks || [])
                .map(c => ({ text: c.text, start: Number(c.timestamp?.[0]), end: Number(c.timestamp?.[1]) }))
                .filter(w => w.text && Number.isFinite(w.start) && w.start >= 0);
            if (!words.length) throw new Error('No speech was detected in this source. Try the other engine, or check that the source actually contains speech.');
            return { words };
        }
    });

    registry.register({
        id: 'server',
        label: 'KEFE server API',
        async transcribe(ctx) {
            const { file, onStatus, onProgress } = ctx;
            onStatus('Sending audio to the transcription server…');
            onProgress(25);
            const res = await fetch('/api/transcribe', { method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
            let data = null;
            try { data = await res.json(); } catch (e) {}
            if (!res.ok) throw new Error(data?.error || `Transcription server error (${res.status}).`);
            onProgress(85);
            if (Array.isArray(data?.words) && data.words.length) {
                const words = data.words.map(w => ({ text: String(w.word ?? w.text ?? '').trim(), start: Number(w.start), end: Number(w.end ?? (Number(w.start) + Number(w.duration || 0))) })).filter(w => w.text && Number.isFinite(w.start) && w.start >= 0);
                if (words.length) return { words };
            }
            if (Array.isArray(data?.segments) && data.segments.length) {
                const segments = data.segments.map(s => ({ text: String(s.text || '').trim(), start: Number(s.start), end: Number(s.end) })).filter(s => s.text && Number.isFinite(s.start));
                if (segments.length) return { segments };
            }
            throw new Error('The server did not return timed transcript data.');
        }
    });

    const textSection = $('textSection');
    if (!textSection || $('captionGenSection')) return;
    const genSection = document.createElement('div');
    genSection.className = 'section';
    genSection.id = 'captionGenSection';
    genSection.innerHTML = ['<h3><span class="section-index">AI</span>Caption Generator</h3>','<p class="caption-gen-lede">Transcribes the speech in your loaded audio or video into timed captions, then renders them with KEFE\'s dedicated caption style — a conventional subtitle look, separate from the lyric effects.</p>','<div class="control-row compact"><label for="captionGenProvider">Transcription engine</label>','<select id="captionGenProvider"></select></div>','<div class="control-row compact" id="captionModelRow"><label for="captionGenModel">Local model</label>','<select id="captionGenModel"><option value="Xenova/whisper-tiny.en">Whisper Tiny · English · fast</option><option value="Xenova/whisper-base.en">Whisper Base · English · more accurate</option></select></div>','<button type="button" id="captionGenBtn" class="primary full-width">Generate Captions</button>','<progress id="captionGenProgress" max="100" value="0" hidden></progress>','<div id="captionGenTimer" class="caption-timer" hidden><span class="caption-timer-dot" aria-hidden="true"></span><span id="captionGenTimerText" aria-live="polite"></span></div>','<div id="captionGenStatus" class="status">Load an audio or video source first, then generate.</div>'].join('');
    const reviewSection = document.createElement('div');
    reviewSection.className = 'section';
    reviewSection.id = 'captionReviewSection';
    reviewSection.innerHTML = ['<h3><span class="section-index">AI</span>Caption Review</h3>','<div id="captionReviewSummary" class="status">No captions yet — generate them in the Caption Generator.</div>','<div id="captionReviewRows" class="caption-review-rows"></div>','<div class="compact-actions">','<button type="button" id="captionRegenBtn">Regenerate</button>','<button type="button" id="captionOpenEditorBtn">Edit in Captions Editor</button>','</div>','<div class="status">Click a timestamp to jump the preview there. Fine timing edits live in the captions editor.</div>'].join('');
    textSection.insertAdjacentElement('afterend', reviewSection);
    textSection.insertAdjacentElement('afterend', genSection);
    const providerSelect = $('captionGenProvider');
    registry.list().forEach(p => { const opt = document.createElement('option'); opt.value = p.id; opt.textContent = p.label; providerSelect.appendChild(opt); });
    providerSelect.value = registry.defaultId;
    const syncModelRow = () => { $('captionModelRow').hidden = providerSelect.value !== 'local-whisper'; };
    providerSelect.addEventListener('change', syncModelRow);
    syncModelRow();

    function applyGeneratedCaptions(lines) {
        state.captions.lines = lines.slice(0, CAPTION_MAX_BLOCKS);
        state.captions.mode = 'captions';
        if (typeof window.applyTextMode === 'function') window.applyTextMode('captions');
        if (typeof window.markSectionTouched === 'function') window.markSectionTouched('text');
        if (typeof window.readiness === 'function') window.readiness();
        if (typeof window.redrawCurrentPreviewFrame === 'function') window.redrawCurrentPreviewFrame();
        const cs = $('captionsStatus');
        if (cs) cs.textContent = `${state.captions.lines.length} caption${state.captions.lines.length === 1 ? '' : 's'} generated`;
        renderReview();
    }

    function renderReview() {
        const summary = $('captionReviewSummary');
        const rows = $('captionReviewRows');
        if (!rows) return;
        rows.innerHTML = '';
        const lines = state.captions?.lines || [];
        if (!lines.length) { if (summary) summary.textContent = 'No captions yet — generate them in the Caption Generator.'; return; }
        if (summary) summary.textContent = `${lines.length} caption${lines.length === 1 ? '' : 's'} ready for review.`;
        lines.forEach((line, index) => {
            const row = document.createElement('div'); row.className = 'caption-review-row';
            const time = document.createElement('button'); time.type = 'button'; time.className = 'caption-review-time'; time.textContent = fmtShort(line.time); time.title = `Jump to ${fmtShort(line.time)}`;
            time.addEventListener('click', () => { const t = Math.max(0, Number(line.time) || 0); if (typeof window.seekPreview === 'function') window.seekPreview(t); else if (window.audio?.el) window.audio.el.currentTime = t; });
            const input = document.createElement('input'); input.type = 'text'; input.value = line.text || ''; input.setAttribute('aria-label', `Caption ${index + 1}`);
            input.addEventListener('change', () => { line.text = input.value; if (typeof window.redrawCurrentPreviewFrame === 'function') window.redrawCurrentPreviewFrame(); });
            row.append(time, input); rows.appendChild(row);
        });
    }

    async function generate() {
        if (window.isExporting) return;
        const file = resolveSourceFile();
        if (!file) { setStatus('Load an audio or video source first.', 'error'); return; }
        const provider = registry.get(providerSelect.value);
        if (!provider) { setStatus('No transcription engine is available.', 'error'); return; }
        const btn = $('captionGenBtn');
        if (btn) btn.disabled = true;
        startCaptionTimer();
        try {
            const audio = await decodeToMono16k(file);
            const result = await provider.transcribe({ file, audio, options: { model: $('captionGenModel')?.value }, onStatus: setStatus, onProgress: setProgress });
            const lines = result?.words?.length ? buildSegmentsFromWords(result.words) : normaliseTimedSegments(result?.segments);
            if (!lines.length) throw new Error('The transcription engine returned no usable captions.');
            applyGeneratedCaptions(lines);
            setProgress(100);
            setStatus(`Generated ${lines.length} timed caption${lines.length === 1 ? '' : 's'}.`, 'success');
        } catch (error) {
            console.error('[KEFE caption generator]', error);
            setStatus(error?.message || 'Caption generation failed.', 'error');
        } finally {
            stopCaptionTimer();
            if (btn) btn.disabled = false;
        }
    }

    $('captionGenBtn')?.addEventListener('click', generate);
    $('captionRegenBtn')?.addEventListener('click', generate);
    $('captionOpenEditorBtn')?.addEventListener('click', () => document.getElementById('textSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    renderReview();
    window.kefeCaptionGen = { generate, renderReview, registry };
})();
