/* KEFE Analysis Engine
 * Promise-based main-thread bridge to analysis-worker.js.
 */
(() => {
    'use strict';
    const WORKER_URL = './core/analysis-worker.js';
    let worker = null;
    let sequence = 0;
    const pending = new Map();

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

    window.kefeAnalysis = {
        version: 1,
        run,
        analyzeLyrics(text, duration = 0) { return run('lyrics', { text, duration }); },
        analyzeProject(payload = {}) { return run('project', payload); },
        terminate() { worker?.terminate(); worker = null; pending.clear(); }
    };

    window.dispatchEvent(new CustomEvent('kefe:analysis-ready', { detail: window.kefeAnalysis }));
})();
