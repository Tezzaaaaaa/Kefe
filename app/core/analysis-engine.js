/* KEFE Analysis Engine + Music Intelligence
 * Main-thread bridge to analysis-worker.js plus browser-local media intelligence.
 * No API keys required for LRCLIB reads. Audio stays local to the browser.
 */
(() => {
    'use strict';

    const WORKER_URL = './app/core/analysis-worker.js';
    const LRCLIB_BASE = 'https://lrclib.net/api';
    const LRCLIB_CLIENT = 'kefe-visualiser/2.0';
    const MAX_ANALYSIS_SECONDS = 1800;

    let worker = null;
    let sequence = 0;
    const pending = new Map();
    let audioContext = null;
    let activeAnalysis = 0;

    function ensureWorker() {
        if (worker) return worker;
        if (!('Worker' in window)) return null;
        worker = new Worker(WORKER_URL);
        worker.onmessage = event => {
            const { id, ok, result, error } = event.data || {};
            const task = pending.get(id);
            if (!task) return;
            pending.delete(id);
            ok ? task.resolve(result) : task.reject(new Error(error || 'Analysis failed'));
        };
        worker.onerror = error => {
            pending.forEach(task => task.reject(error instanceof Error ? error : new Error('Analysis worker failed')));
            pending.clear();
            worker?.terminate();
            worker = null;
        };
        return worker;
    }

    function run(type, payload = {}) {
        const activeWorker = ensureWorker();
        if (!activeWorker) return Promise.reject(new Error('Web Workers unavailable'));
        const id = ++sequence;
        return new Promise((resolve, reject) => {
            pending.set(id, { resolve, reject });
            activeWorker.postMessage({ id, type, payload });
        });
    }

    /* ---------- Canonical timeline ---------- */
    function normaliseWord(word, fallbackStart = 0, fallbackEnd = fallbackStart + 0.25) {
        const start = Number(word?.startMs ?? word?.fromMs ?? word?.timeMs ?? (Number(word?.time) * 1000));
        const end = Number(word?.endMs ?? word?.toMs ?? word?.endTimeMs ?? (Number(word?.endTime) * 1000));
        return {
            text: String(word?.text ?? '').trim(),
            startMs: Number.isFinite(start) ? start : fallbackStart,
            endMs: Number.isFinite(end) && end > start ? end : fallbackEnd
        };
    }

    function canonicalTimeline(lines, durationMs = 0) {
        const source = Array.isArray(lines) ? lines : [];
        const clean = source.map((line, index) => {
            const startMs = Math.max(0, Number(line?.startMs ?? line?.timeMs ?? (Number(line?.time) * 1000)) || 0);
            const next = source[index + 1];
            const nextStart = Number(next?.startMs ?? next?.timeMs ?? (Number(next?.time) * 1000));
            const fallbackEnd = Number.isFinite(nextStart) && nextStart > startMs ? nextStart : Math.min(durationMs || startMs + 3000, startMs + 5000);
            const rawWords = Array.isArray(line?.words) ? line.words : [];
            const words = rawWords.map((word, wi) => {
                const nextWord = rawWords[wi + 1];
                const ns = Number(nextWord?.startMs ?? nextWord?.fromMs ?? nextWord?.timeMs ?? (Number(nextWord?.time) * 1000));
                return normaliseWord(word, startMs, Number.isFinite(ns) && ns > startMs ? ns : fallbackEnd);
            }).filter(word => word.text);
            return {
                startMs,
                endMs: Math.max(startMs + 1, Number(line?.endMs) || fallbackEnd),
                text: String(line?.text ?? '').trim(),
                words,
                source: line?.source || 'kefe'
            };
        }).filter(line => line.text || line.words.length).sort((a, b) => a.startMs - b.startMs);

        for (let i = 0; i < clean.length; i++) {
            const next = clean[i + 1];
            if (next && clean[i].endMs > next.startMs) clean[i].endMs = next.startMs;
            clean[i].words = clean[i].words.map((word, wi) => {
                const nextWord = clean[i].words[wi + 1];
                const end = nextWord ? Math.min(word.endMs, nextWord.startMs) : word.endMs;
                return { ...word, endMs: Math.max(word.startMs + 1, end) };
            });
        }
        return { version: 2, durationMs: Number(durationMs) || 0, lines: clean };
    }

    function timelineToLrc(timeline) {
        const pad = n => String(Math.floor(n)).padStart(2, '0');
        return (timeline?.lines || []).map(line => {
            const ms = Math.max(0, Math.round(line.startMs));
            const min = Math.floor(ms / 60000);
            const sec = Math.floor((ms % 60000) / 1000);
            const hundredths = Math.floor((ms % 1000) / 10);
            return `[${pad(min)}:${pad(sec)}.${String(hundredths).padStart(2, '0')}]${line.text}`;
        }).join('\n');
    }

    /* ---------- LRCLIB ---------- */
    async function lrclibFetch(url, signal) {
        const response = await fetch(url, {
            signal,
            headers: {
                Accept: 'application/json',
                'X-User-Agent': LRCLIB_CLIENT
            }
        });
        if (!response.ok) {
            if (response.status === 404) return null;
            if (response.status === 429) throw new Error('Lyrics service is rate-limited; try again shortly.');
            throw new Error(`Lyrics service returned ${response.status}.`);
        }
        return response.json();
    }

    async function findSyncedLyrics({ artist = '', title = '', album = '', duration = 0, signal } = {}) {
        artist = String(artist).trim();
        title = String(title).trim();
        album = String(album).trim();
        if (!title && !artist) throw new Error('Add a song title or artist first.');

        const controller = signal ? null : new AbortController();
        const timeout = controller ? setTimeout(() => controller.abort(), 12000) : null;
        const fetchSignal = signal || controller.signal;
        try {
            const params = new URLSearchParams({ track_name: title, artist_name: artist });
            if (album) params.set('album_name', album);
            if (Number(duration) > 0) params.set('duration', String(Math.round(duration)));
            const exact = await lrclibFetch(`${LRCLIB_BASE}/get?${params}`, fetchSignal);
            if (exact?.syncedLyrics) return { ...exact, source: 'LRCLIB', match: 'exact' };

            const searchParams = new URLSearchParams();
            if (title) searchParams.set('track_name', title);
            if (artist) searchParams.set('artist_name', artist);
            const results = await lrclibFetch(`${LRCLIB_BASE}/search?${searchParams}`, fetchSignal);
            const candidates = Array.isArray(results) ? results : [];
            const scored = candidates.map(item => {
                let score = 0;
                if (String(item.trackName || '').toLowerCase() === title.toLowerCase()) score += 5;
                if (String(item.artistName || '').toLowerCase() === artist.toLowerCase()) score += 4;
                if (album && String(item.albumName || '').toLowerCase() === album.toLowerCase()) score += 2;
                if (item.syncedLyrics) score += 4;
                if (duration && item.duration) score += Math.max(0, 2 - Math.abs(Number(item.duration) - Number(duration)) / 20);
                return { item, score };
            }).sort((a, b) => b.score - a.score);
            const best = scored.find(x => x.item.syncedLyrics)?.item || scored[0]?.item;
            return best ? { ...best, source: 'LRCLIB', match: 'search' } : null;
        } finally {
            if (timeout) clearTimeout(timeout);
        }
    }

    /* ---------- Browser-local audio intelligence ---------- */
    function getAudioContext() {
        if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
        return audioContext;
    }

    function rms(samples) {
        let sum = 0;
        for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
        return Math.sqrt(sum / Math.max(1, samples.length));
    }

    function spectralFlux(prev, current) {
        if (!prev) return 0;
        let sum = 0;
        const length = Math.min(prev.length, current.length);
        for (let i = 0; i < length; i++) sum += Math.max(0, current[i] - prev[i]);
        return sum / Math.max(1, length);
    }

    function analyseBuffer(buffer, onProgress) {
        const duration = Math.min(buffer.duration, MAX_ANALYSIS_SECONDS);
        const sampleRate = buffer.sampleRate;
        const mono = new Float32Array(Math.floor(duration * sampleRate));
        const channels = buffer.numberOfChannels;
        for (let c = 0; c < channels; c++) {
            const data = buffer.getChannelData(c);
            const limit = Math.min(mono.length, data.length);
            for (let i = 0; i < limit; i++) mono[i] += data[i] / channels;
        }

        const frameSize = Math.max(1024, Math.round(sampleRate * 0.04644));
        const hop = Math.max(512, Math.round(sampleRate * 0.02322));
        const frameCount = Math.max(1, Math.floor((mono.length - frameSize) / hop));
        const energies = [];
        const flux = [];
        const bands = [];
        let prevSpectrum = null;

        const fftSize = 2048;
        const offline = new OfflineAudioContext(1, fftSize, sampleRate);
        const analyser = offline.createAnalyser();
        analyser.fftSize = fftSize;
        const spectrum = new Float32Array(analyser.frequencyBinCount);
        // Deterministic time-domain spectral proxy: band energies + zero crossing.
        for (let f = 0; f < frameCount; f++) {
            const start = f * hop;
            const frame = mono.subarray(start, Math.min(start + frameSize, mono.length));
            const energy = rms(frame);
            let bass = 0, mids = 0, treble = 0, crossings = 0;
            let prev = frame[0] || 0;
            for (let i = 0; i < frame.length; i++) {
                const v = frame[i];
                if ((v >= 0) !== (prev >= 0)) crossings++;
                prev = v;
                const t = i / Math.max(1, frame.length - 1);
                if (t < 0.18) bass += v * v;
                else if (t < 0.62) mids += v * v;
                else treble += v * v;
            }
            const proxy = new Float32Array(128);
            const step = Math.max(1, Math.floor(frame.length / proxy.length));
            for (let i = 0; i < proxy.length; i++) {
                let s = 0;
                for (let j = i * step; j < Math.min(frame.length, (i + 1) * step); j++) s += Math.abs(frame[j]);
                proxy[i] = s / step;
            }
            const fl = spectralFlux(prevSpectrum, proxy);
            prevSpectrum = proxy;
            energies.push(energy);
            flux.push(fl);
            bands.push({ bass: Math.sqrt(bass / Math.max(1, frame.length)), mids: Math.sqrt(mids / Math.max(1, frame.length)), treble: Math.sqrt(treble / Math.max(1, frame.length)), zeroCrossingRate: crossings / Math.max(1, frame.length) });
            if (f % 100 === 0) onProgress?.(f / frameCount);
        }

        const mean = values => values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
        const meanFlux = mean(flux);
        const variance = mean(flux.map(v => (v - meanFlux) ** 2));
        const threshold = meanFlux + Math.sqrt(variance) * 1.35;
        const peaks = [];
        const minGap = Math.max(2, Math.round(0.24 / (hop / sampleRate)));
        let lastPeak = -Infinity;
        for (let i = 1; i < flux.length - 1; i++) {
            if (flux[i] < threshold || flux[i] < flux[i - 1] || flux[i] < flux[i + 1]) continue;
            if (i - lastPeak < minGap) continue;
            peaks.push({ time: i * hop / sampleRate, strength: flux[i] });
            lastPeak = i;
        }

        const intervals = [];
        for (let i = 1; i < peaks.length; i++) {
            const delta = peaks[i].time - peaks[i - 1].time;
            if (delta >= 0.25 && delta <= 2) intervals.push(delta);
        }
        let bpm = 0;
        if (intervals.length) {
            const sorted = intervals.slice().sort((a, b) => a - b);
            const median = sorted[Math.floor(sorted.length / 2)];
            bpm = 60 / median;
            while (bpm < 70) bpm *= 2;
            while (bpm > 180) bpm /= 2;
            bpm = Math.round(bpm * 10) / 10;
        }

        return {
            version: 1,
            duration,
            sampleRate,
            bpm,
            firstBeat: peaks[0]?.time ?? null,
            beats: peaks.map(p => p.time),
            onsetPeaks: peaks,
            frameHopMs: hop / sampleRate * 1000,
            energy: energies,
            flux,
            bands,
            summary: {
                averageRms: mean(energies),
                averageFlux: meanFlux,
                peakRms: Math.max(0, ...energies),
                dynamicRange: Math.max(0, ...energies) - Math.min(...energies)
            }
        };
    }

    async function analyseAudioFile(file, onProgress) {
        const token = ++activeAnalysis;
        if (!(file instanceof Blob)) throw new Error('Audio file required.');
        const arrayBuffer = await file.arrayBuffer();
        const buffer = await getAudioContext().decodeAudioData(arrayBuffer.slice(0));
        if (token !== activeAnalysis) throw new Error('Analysis superseded.');
        const result = analyseBuffer(buffer, onProgress);
        result.fileName = file.name;
        result.mimeType = file.type;
        return result;
    }

    /* ---------- Deterministic frame clock ---------- */
    function createFrameClock({ fps = 30, duration = 0 } = {}) {
        const rate = Math.max(1, Number(fps) || 30);
        const frameDurationMs = 1000 / rate;
        return {
            fps: rate,
            duration,
            frameCount: Math.max(0, Math.ceil(duration * rate)),
            timeForFrame(frame) { return Math.max(0, Number(frame) || 0) * frameDurationMs / 1000; },
            frameForTime(time) { return Math.max(0, Math.round((Number(time) || 0) * rate)); },
            msForFrame(frame) { return Math.round(this.timeForFrame(frame) * 1000); }
        };
    }

    /* ---------- Lightweight metadata inference ---------- */
    function inferMetadataFromFilename(name = '') {
        let base = String(name).split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
        base = base.replace(/^\d+\s*[-._]\s*/, '').trim();
        const parts = base.split(/\s+[–—-]\s+/);
        if (parts.length >= 2) return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim(), album: '' };
        return { artist: '', title: base, album: '' };
    }

    function parseLrcText(text) {
        const lines = [];
        String(text || '').split(/\r?\n/).forEach(raw => {
            const tags = [...raw.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
            const lyric = raw.replace(/\[[^\]]+\]/g, '').trim();
            if (!tags.length || !lyric) return;
            tags.forEach(tag => {
                const fraction = tag[3] ? Number(`0.${String(tag[3]).padEnd(3, '0')}`) : 0;
                lines.push({ time: Number(tag[1]) * 60 + Number(tag[2]) + fraction, text: lyric, source: 'LRCLIB' });
            });
        });
        lines.sort((a, b) => a.time - b.time);
        return lines.map((line, i) => ({ ...line, endTime: lines[i + 1]?.time ?? line.time + 3 })).filter(line => line.text);
    }

    function emit(name, detail) {
        window.dispatchEvent(new CustomEvent(name, { detail }));
    }

    /* ---------- UI integration ---------- */
    function ensureIntelligencePanel() {
        const section = document.getElementById('audioSection');
        if (!section || document.getElementById('kefeIntelligencePanel')) return;
        const panel = document.createElement('div');
        panel.id = 'kefeIntelligencePanel';
        panel.className = 'sub-block kefe-intelligence-panel';
        panel.innerHTML = `
            <div class="sub-heading">Music intelligence</div>
            <div class="kefe-intel-grid">
              <div><span>BPM</span><strong id="kefeBpm">—</strong></div>
              <div><span>Beats</span><strong id="kefeBeatCount">—</strong></div>
              <div><span>Energy</span><strong id="kefeEnergy">—</strong></div>
            </div>
            <div class="kefe-intel-progress"><span id="kefeIntelProgress"></span></div>
            <div id="kefeIntelStatus" class="sub-hint">Analysis runs locally in your browser.</div>`;
        section.appendChild(panel);
    }

    function updateIntelUI(result) {
        ensureIntelligencePanel();
        const bpm = document.getElementById('kefeBpm');
        const beats = document.getElementById('kefeBeatCount');
        const energy = document.getElementById('kefeEnergy');
        const status = document.getElementById('kefeIntelStatus');
        const progress = document.getElementById('kefeIntelProgress');
        if (bpm) bpm.textContent = result.bpm ? `${result.bpm}` : '—';
        if (beats) beats.textContent = `${result.beats?.length || 0}`;
        if (energy) energy.textContent = result.summary ? `${Math.round(result.summary.averageRms * 1000)}/1000` : '—';
        if (progress) progress.style.width = '100%';
        if (status) status.textContent = result.bpm ? `Ready — ${result.bpm} BPM detected.` : 'Ready — no reliable beat grid detected.';
    }

    async function handleAudioFile(file) {
        if (!file) return;
        ensureIntelligencePanel();
        const status = document.getElementById('kefeIntelStatus');
        const progress = document.getElementById('kefeIntelProgress');
        if (status) status.textContent = 'Analysing rhythm, energy and beat structure…';
        if (progress) progress.style.width = '0%';
        try {
            const result = await analyseAudioFile(file, value => { if (progress) progress.style.width = `${Math.round(value * 100)}%`; });
            updateIntelUI(result);
            emit('kefe:audio-analysis-ready', result);
        } catch (error) {
            if (status) status.textContent = `Analysis unavailable: ${error.message}`;
            emit('kefe:audio-analysis-error', error);
        }
    }

    function installUI() {
        ensureIntelligencePanel();
        const input = document.getElementById('audioInput');
        input?.addEventListener('change', () => handleAudioFile(input.files?.[0]), { passive: true });

        const findButton = document.getElementById('findLyricsBtn');
        findButton?.addEventListener('click', async event => {
            event.preventDefault();
            event.stopImmediatePropagation();
            const title = document.getElementById('metaTitle')?.value.trim() || '';
            const artist = document.getElementById('metaArtist')?.value.trim() || '';
            const album = document.getElementById('metaAlbum')?.value.trim() || '';
            const audioInput = document.getElementById('audioInput');
            const file = audioInput?.files?.[0];
            const inferred = !title && !artist && file ? inferMetadataFromFilename(file.name) : null;
            const query = { title: title || inferred?.title || '', artist: artist || inferred?.artist || '', album: album || inferred?.album || '', duration: 0 };
            const status = document.getElementById('lyricsStatus');
            if (status) status.textContent = 'Searching LRCLIB for synced lyrics…';
            try {
                const result = await findSyncedLyrics(query);
                if (!result?.syncedLyrics) throw new Error('No synced lyrics found.');
                const lines = parseLrcText(result.syncedLyrics);
                const timeline = canonicalTimeline(lines, Number(result.duration || 0) * 1000);
                window.kefeLyricsResolverResult = { ...result, timeline };
                emit('kefe:lyrics-resolved', window.kefeLyricsResolverResult);
                if (status) status.textContent = `Found synced lyrics via LRCLIB — ${timeline.lines.length} lines.`;
                // Feed the existing editor so the current renderer/export path stays authoritative.
                const textarea = document.getElementById('lyricsText');
                if (textarea) textarea.value = result.syncedLyrics;
                const saveButton = document.getElementById('saveLyrics');
                saveButton?.click();
            } catch (error) {
                if (status) status.textContent = `Lyrics lookup failed: ${error.message}`;
                emit('kefe:lyrics-error', error);
            }
        }, true);
    }

    const api = {
        version: 2,
        run,
        analyzeLyrics(text, duration = 0) { return run('lyrics', { text, duration }); },
        analyzeProject(payload = {}) { return run('project', payload); },
        canonicalTimeline,
        timelineToLrc,
        findSyncedLyrics,
        analyseAudioFile,
        createFrameClock,
        inferMetadataFromFilename,
        terminate() { worker?.terminate(); worker = null; pending.clear(); }
    };

    window.kefeAnalysis = api;
    window.kefeMusic = { version: 1, analyseAudioFile, createFrameClock };
    window.kefeLyrics = { version: 1, findSyncedLyrics, canonicalTimeline, timelineToLrc };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installUI, { once: true });
    else installUI();
    window.dispatchEvent(new CustomEvent('kefe:analysis-ready', { detail: api }));
})();
