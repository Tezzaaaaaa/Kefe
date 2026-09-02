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

    /* The remainder of this engine is unchanged: timeline normalisation,
       LRCLIB lookup, browser-local audio intelligence and frame-clock helpers. */
