/* KEFE Caption Generator — reliability-first automatic speech captions.
   Captions are deliberately separate from lyrics. The generator transcribes the
   loaded media audio, validates the transcript/timing, segments it for reading,
   and feeds the result into KEFE's existing caption renderer.

   Transcription providers are pluggable via window.kefeTranscription:
   - auto: best-available engine with validation/fallback.
   - local-whisper: Whisper in-browser via transformers.js.
   - server: POSTs extracted audio to /api/transcribe (key stays server-side).

   Important: automatic speech recognition can never be literally fail-proof.
   KEFE therefore fails safely: it validates output, rejects unusable results,
   preserves word timing, and exposes a review pass instead of silently claiming
   uncertain speech is correct. */
(() => {
    'use strict';
    if (window.kefeCaptionGen) return;
    const $ = id => document.getElementById(id);
    const state = window.state;
    if (!state) return;

    const CAPTION_MAX_BLOCKS = 2000;
    const MIN_WORDS_FOR_VALID_TRANSCRIPT = 1;

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
        timerStartedAt = performance.now(); progressFraction = 0; progressSamples = 0;
        const el = $('captionGenTimer');
        if (el) { el.hidden = false; el.classList.add('running'); }
        renderTimer(); clearInterval(timerInterval); timerInterval = setInterval(renderTimer, 500);
    }
    function stopCaptionTimer() {
        clearInterval(timerInterval); timerInterval = null;
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
            const ctx = new AudioCtx();
            decoded = await ctx.decodeAudioData(await file.arrayBuffer());
            await ctx.close().catch(() => {});
        } catch (e) {
            throw new Error("Could not decode this file's audio track — try MP3/WAV/M4A, or a video with a standard audio track.");
        }
        const rate = 16000;
        const length = Math.max(1, Math.ceil(decoded.duration * rate));
        const offline = new OfflineCtx(1, length, rate);
        const src = offline.createBufferSource();
        src.buffer = decoded; src.connect(offline.destination); src.start();
        const rendered = await offline.startRendering();
        return { float32: rendered.getChannelData(0), duration: decoded.duration };
    }

    const registry = {
        providers: new Map(),
        defaultId: 'auto',
        register(provider) {
            if (provider && provider.id && typeof provider.transcribe === 'function') this.providers.set(provider.id, provider);
        },
        get(id) { return this.providers.get(id) || this.providers.get(this.defaultId) || null; },
        list() { return [...this.providers.values()]; }
    };
    window.kefeTranscription = registry;

    function cleanWord(w) {
        return { text: String(w?.text || '').replace(/\s+/g, ' ').trim(), start: Number(w?.start), end: Number(w?.end) };
    }

    function sanitiseWords(words) {
        const out = [];
        for (const raw of (words || [])) {
            const w = cleanWord(raw);
            if (!w.text || !Number.isFinite(w.start) || w.start < 0) continue;
            w.end = Number.isFinite(w.end) && w.end > w.start ? w.end : w.start + 0.4;
            if (out.length && w.start < out[out.length - 1].start) continue;
            if (out.length && w.start === out[out.length - 1].start && w.text === out[out.length - 1].text) continue;
            out.push(w);
        }
        return out;
    }

    function validateTranscript(result, duration) {
        const words = sanitiseWords(result?.words);
        const segments = result?.segments || [];
        const issues = [];
        if (words.length < MIN_WORDS_FOR_VALID_TRANSCRIPT && !segments.length) issues.push('no timed speech returned');
        if (duration > 0 && words.some(w => w.start > duration + 2)) issues.push('timestamps exceed media duration');
        let suspicious = 0;
        for (let i = 1; i < words.length; i++) {
            const gap = words[i].start - words[i - 1].end;
            if (gap < -0.15) issues.push('overlapping word timestamps');
            if (gap > 45) suspicious++;
        }
        if (suspicious > 2) issues.push('large unexplained timing gaps');
        return { ok: issues.length === 0, issues, words };
    }

    function buildSegmentsFromWords(words) {
        const clean = sanitiseWords(words);
        const MAX_CHARS = 56, MAX_DUR = 4.2, GAP_BREAK = 0.7;
        const segments = [];
        let cur = null;
        for (const word of clean) {
            const gap = cur ? word.start - cur.end : 0;
            const chars = cur ? cur.text.length + 1 + word.text.length : word.text.length;
            const dur = cur ? word.end - cur.start : word.end - word.start;
            const closesSentence = cur && /[.!?…]$/.test(cur.text);
            if (cur && (chars > MAX_CHARS || dur > MAX_DUR || gap > GAP_BREAK || (closesSentence && chars > 24))) {
                segments.push(cur); cur = null;
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
            .map(s => ({ text: String(s?.text || '').replace(/\s+/g, ' ').trim(), time: Math.max(0, Number(s?.start) || 0), endTime: Number.isFinite(Number(s?.end)) ? Number(s.end) : (Number(s?.start) || 0) + 3 }))
            .filter(s => s.text)
            .sort((a, b) => a.time - b.time)
            .filter((s, i, arr) => i === 0 || !(s.text === arr[i - 1].text && Math.abs(s.time - arr[i - 1].time) < 0.15));
    }

    registry.register({
        id: 'local-whisper',
        label: 'Local — Whisper in browser',
        async transcribe(ctx) {
            const { onStatus, onProgress, audio, options } = ctx;
            onStatus('Loading the speech model — first use downloads it and then the browser caches it…');
            onProgress(3);
            let mod;
            try { mod = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js'); }
            catch (e) { throw new Error('Could not load the local speech model. Try again with an internet connection, or use the KEFE server engine.'); }
            try { mod.env.allowLocalModels = false; } catch (e) {}
            const modelId = options?.model || 'Xenova/whisper-base.en';
            const asr = await mod.pipeline('automatic-speech-recognition', modelId, {
                quantized: true,
                progress_callback: p => { if (p && p.status === 'progress' && Number.isFinite(p.progress)) onProgress(Math.min(88, 3 + p.progress * 0.85)); }
            });
            onStatus('Transcribing speech locally — accuracy-first mode…'); onProgress(5);
            let chunksDone = 0;
            const estimatedChunks = Math.max(1, Math.round(audio.duration / 30));
            const output = await asr(audio.float32, {
                chunk_length_s: 30,
                stride_length_s: 5,
                return_timestamps: 'word',
                chunk_callback: () => { chunksDone++; onProgress(Math.min(96, 5 + (chunksDone / estimatedChunks) * 91)); }
            });
            const words = sanitiseWords((output?.chunks || []).map(c => ({ text: c.text, start: Number(c.timestamp?.[0]), end: Number(c.timestamp?.[1]) })));
            if (!words.length) throw new Error('No speech was detected in this source. Try the other engine, or check that the source actually contains speech.');
            return { words, engine: modelId };
        }
    });

    function audioToWavBlob(audio) {
        const samples = audio?.float32;
        if (!samples || !samples.length) throw new Error('Could not prepare the audio track for transcription.');
        const rate = 16000;
        const buffer = new ArrayBuffer(44 + samples.length * 2);
        const view = new DataView(buffer);
        const write = (offset, text) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };
        write(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true); write(8, 'WAVE');
        write(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
        view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
        write(36, 'data'); view.setUint32(40, samples.length * 2, true);
        for (let i = 0; i < samples.length; i++) { const v = Math.max(-1, Math.min(1, samples[i])); view.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true); }
        return new Blob([buffer], { type: 'audio/wav' });
    }

    registry.register({
        id: 'server',
        label: 'KEFE server — accuracy mode',
        async transcribe(ctx) {
            const { onStatus, onProgress, audio } = ctx;
            const file = audioToWavBlob(audio);
            onStatus('Sending the extracted audio track to the transcription server…'); onProgress(25);
            const res = await fetch('/api/transcribe', { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: file });
            let data = null; try { data = await res.json(); } catch (e) {}
            if (!res.ok) throw new Error(data?.error || `Transcription server error (${res.status}).`);
            onProgress(85);
            if (Array.isArray(data?.words) && data.words.length) {
                const words = sanitiseWords(data.words.map(w => ({ text: w.word ?? w.text, start: Number(w.start), end: Number(w.end ?? (Number(w.start) + Number(w.duration || 0))) })));
                if (words.length) return { words, engine: 'server' };
            }
            if (Array.isArray(data?.segments) && data.segments.length) return { segments: data.segments, engine: 'server' };
            throw new Error('The server did not return timed transcript data.');
        }
    });

    registry.register({
        id: 'auto',
        label: 'KEFE Auto — best available',
        async transcribe(ctx) {
            const { onStatus, onProgress, audio, options } = ctx;
            const attempts = ['server', 'local-whisper'];
            const errors = [];
            for (const id of attempts) {
                const provider = registry.providers.get(id);
                if (!provider) continue;
                try {
                    onStatus(id === 'server' ? 'Trying KEFE accuracy transcription…' : 'Falling back to local Whisper…');
                    const result = await provider.transcribe(ctx);
                    const check = validateTranscript(result, audio.duration);
                    if (check.ok) return result;
                    errors.push(`${provider.label}: ${check.issues.join(', ')}`);
                } catch (e) {
                    errors.push(`${provider.label}: ${e?.message || 'failed'}`);
                }
            }
            throw new Error(`Automatic captioning could not produce a reliable timed transcript. ${errors.length ? errors.join(' · ') : 'No transcription engine is available.'}`);
        }
    });

    const textSection = $('textSection');
    if (!textSection || $('captionGenSection')) return;
    const genSection = document.createElement('div');
    genSection.className = 'section'; genSection.id = 'captionGenSection';
    genSection.innerHTML = [
        '<h3><span class="section-index">AI</span>Caption Generator</h3>',
        '<p class="caption-gen-lede">Automatic speech captions are generated from your loaded media. KEFE validates the transcript and timing before putting it into the editor.</p>',
        '<div class="control-row compact"><label for="captionGenProvider">Transcription engine</label><select id="captionGenProvider"></select></div>',
        '<div class="control-row compact" id="captionModelRow"><label for="captionGenModel">Local model</label><select id="captionGenModel"><option value="Xenova/whisper-base.en">Whisper Base · English · accuracy-first</option><option value="Xenova/whisper-tiny.en">Whisper Tiny · English · faster</option></select></div>',
        '<button type="button" id="captionGenBtn" class="primary full-width">Generate Captions</button>',
        '<progress id="captionGenProgress" max="100" value="0" hidden></progress>',
        '<div id="captionGenTimer" class="caption-timer" hidden><span class="caption-timer-dot" aria-hidden="true"></span><span id="captionGenTimerText" aria-live="polite"></span></div>',
        '<div id="captionGenStatus" class="status">Load an audio or video source first, then generate.</div>'
    ].join('');
    const reviewSection = document.createElement('div');
    reviewSection.className = 'section'; reviewSection.id = 'captionReviewSection';
    reviewSection.innerHTML = [
        '<h3><span class="section-index">AI</span>Caption Review</h3>',
        '<div id="captionReviewSummary" class="status">No captions yet — generate them in the Caption Generator.</div>',
        '<div id="captionReviewRows" class="caption-review-rows"></div>',
        '<div class="compact-actions"><button type="button" id="captionRegenBtn">Regenerate</button><button type="button" id="captionOpenEditorBtn">Edit in Captions Editor</button></div>',
        '<div class="status">Review the words before export. Click a timestamp to jump the preview there.</div>'
    ].join('');
    textSection.insertAdjacentElement('afterend', reviewSection);
    textSection.insertAdjacentElement('afterend', genSection);

    const providerSelect = $('captionGenProvider');
    registry.list().forEach(p => { const opt = document.createElement('option'); opt.value = p.id; opt.textContent = p.label; providerSelect.appendChild(opt); });
    providerSelect.value = registry.defaultId;
    const syncModelRow = () => { $('captionModelRow').hidden = providerSelect.value !== 'local-whisper'; };
    providerSelect.addEventListener('change', syncModelRow); syncModelRow();

    function applyGeneratedCaptions(lines, meta = {}) {
        state.captions.lines = lines.slice(0, CAPTION_MAX_BLOCKS);
        state.captions.mode = 'captions';
        state.captions.meta = { engine: meta.engine || 'unknown', generatedAt: new Date().toISOString(), reviewRequired: true };
        if (typeof window.applyTextMode === 'function') window.applyTextMode('captions');
        if (typeof window.markSectionTouched === 'function') window.markSectionTouched('text');
        if (typeof window.readiness === 'function') window.readiness();
        if (typeof window.redrawCurrentPreviewFrame === 'function') window.redrawCurrentPreviewFrame();
        const cs = $('captionsStatus'); if (cs) cs.textContent = `${state.captions.lines.length} caption${state.captions.lines.length === 1 ? '' : 's'} generated — review before export`;
        renderReview();
    }

    function renderReview() {
        const summary = $('captionReviewSummary'), rows = $('captionReviewRows');
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
            input.addEventListener('change', () => { line.text = input.value; state.captions.meta = { ...(state.captions.meta || {}), reviewRequired: false, edited: true }; if (typeof window.redrawCurrentPreviewFrame === 'function') window.redrawCurrentPreviewFrame(); });
            row.append(time, input); rows.appendChild(row);
        });
    }

    async function generate() {
        if (window.isExporting) return;
        const file = resolveSourceFile();
        if (!file) { setStatus('Load an audio or video source first.', 'error'); return; }
        const provider = registry.get(providerSelect.value);
        if (!provider) { setStatus('No transcription engine is available.', 'error'); return; }
        const btn = $('captionGenBtn'); if (btn) btn.disabled = true;
        startCaptionTimer();
        try {
            setStatus('Preparing the media audio…');
            const audio = await decodeToMono16k(file);
            const result = await provider.transcribe({ file, audio, options: { model: $('captionGenModel')?.value }, onStatus: setStatus, onProgress: setProgress });
            const check = validateTranscript(result, audio.duration);
            if (!check.ok) throw new Error(`Transcript validation failed: ${check.issues.join(', ')}.`);
            const lines = check.words.length ? buildSegmentsFromWords(check.words) : normaliseTimedSegments(result?.segments);
            if (!lines.length) throw new Error('The transcription engine returned no usable captions.');
            applyGeneratedCaptions(lines, { engine: result.engine || provider.label });
            setProgress(100);
            setStatus(`Generated ${lines.length} timed captions. Review the wording before export.`, 'success');
        } catch (error) {
            console.error('[KEFE caption generator]', error);
            setStatus(error?.message || 'Caption generation failed safely — no partial captions were applied.', 'error');
        } finally {
            stopCaptionTimer(); if (btn) btn.disabled = false;
        }
    }

    $('captionGenBtn')?.addEventListener('click', generate);
    $('captionRegenBtn')?.addEventListener('click', generate);
    $('captionOpenEditorBtn')?.addEventListener('click', () => $('textSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    renderReview();
    window.kefeCaptionGen = { generate, renderReview, registry, validateTranscript };
})();
