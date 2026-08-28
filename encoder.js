const FF_VERSION = '0.12.15';
const CORE_VERSION = '0.12.10';
const LOAD_TIMEOUT_MS = 30000;

const FFMPEG_MODULE_URL = `https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@${FF_VERSION}/dist/esm/index.js`;
const LOCAL_WORKER_URL = new URL('../vendor/ffmpeg/worker.js', import.meta.url).href;
const CORE_JS_URL = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/esm/ffmpeg-core.js`;
const CORE_WASM_URL = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/esm/ffmpeg-core.wasm`;

let encoderPromise = null;

// The FFmpeg JS module and the ~25MB core/wasm binaries are the same bytes no
// matter how many times we spin up a fresh FFmpeg() instance across export
// segments — cache them once per page session (module scope) instead of
// re-downloading from the CDN for every 4-second segment. A long export used
// to re-fetch these assets 20-100+ times, which was the single biggest cause
// of slow exports. A fresh FFmpeg() instance + .load() still happens on every
// segment (below) so the periodic WASM-memory reset that keeps long exports
// from running out of heap is preserved — only the network fetch is cached.
let moduleCache = null, modulePromise = null;
let assetsCache = null, assetsPromise = null;

function encoderFailure(stage, operation, error, details = {}) {
    const e = new Error(`[${stage}] encoder.${operation}: ${error?.message || String(error)}`);
    e.name = 'ExportDiagnosticError'; e.code = `EXPORT_${stage}`; e.stage = stage; e.module = 'encoder'; e.operation = operation; e.details = details; e.cause = error; return e;
}
function withTimeout(promise, ms, details, operation) {
    let timer;
    const timeoutPromise = new Promise((_, reject) => { timer = setTimeout(() => reject(encoderFailure('ENCODER_TIMEOUT', operation, new Error(`FFmpeg ${operation} timed out after ${ms / 1000}s`), details)), ms); });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}
async function fetchBlobURL(url, mime, label) {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), LOAD_TIMEOUT_MS);
    try { const response = await fetch(url, { signal: controller.signal }); if (!response.ok) throw new Error(`HTTP ${response.status}`); const blob = await response.blob(); if (!blob.size) throw new Error('empty response'); return URL.createObjectURL(new Blob([blob], { type: mime })); }
    catch (error) { if (error?.name === 'AbortError') throw encoderFailure('ENCODER_TIMEOUT', label, new Error(`Timed out loading ${label}`), { url }); throw encoderFailure('ENCODER_ASSET', label, error, { url }); }
    finally { clearTimeout(timer); }
}
function getFFmpegModule() {
    if (moduleCache) return Promise.resolve(moduleCache);
    if (!modulePromise) modulePromise = import(FFMPEG_MODULE_URL).then(m => { moduleCache = m; modulePromise = null; return m; }).catch(e => { modulePromise = null; throw e; });
    return modulePromise;
}
function getCoreAssets() {
    if (assetsCache) return Promise.resolve(assetsCache);
    if (!assetsPromise) {
        assetsPromise = Promise.all([
            fetchBlobURL(CORE_JS_URL, 'text/javascript', 'ffmpeg-core'),
            fetchBlobURL(CORE_WASM_URL, 'application/wasm', 'ffmpeg-wasm')
        ]).then(([coreURL, wasmURL]) => { assetsCache = { coreURL, wasmURL }; assetsPromise = null; return assetsCache; })
          .catch(e => { assetsPromise = null; throw e; });
    }
    return assetsPromise;
}
function invalidateCoreAssets() {
    if (assetsCache) { try { URL.revokeObjectURL(assetsCache.coreURL); } catch {} try { URL.revokeObjectURL(assetsCache.wasmURL); } catch {} }
    assetsCache = null; assetsPromise = null;
}
export async function loadEncoder(onStatus) {
    if (encoderPromise) return encoderPromise;
    encoderPromise = (async () => {
        let ffmpeg = null;
        const details = { source: 'jsdelivr-ffmpeg', ffmpeg: FF_VERSION, core: CORE_VERSION, workerURL: LOCAL_WORKER_URL, coreURL: CORE_JS_URL, wasmURL: CORE_WASM_URL };
        try {
            onStatus?.('Loading FFmpeg engine…');
            const module = await withTimeout(getFFmpegModule(), LOAD_TIMEOUT_MS, details, 'module-load');
            const FFmpeg = module?.FFmpeg; if (typeof FFmpeg !== 'function') throw new Error('FFmpeg constructor was not found');
            onStatus?.('Loading FFmpeg core…');
            const { coreURL, wasmURL } = await withTimeout(getCoreAssets(), LOAD_TIMEOUT_MS, details, 'core-assets');
            ffmpeg = new FFmpeg(); ffmpeg.on('log', data => console.debug('[KEFE FFmpeg]', data?.message || data)); ffmpeg.on('error', error => console.error('[KEFE FFmpeg error]', error));
            onStatus?.('Starting FFmpeg…');
            await withTimeout(ffmpeg.load({ classWorkerURL: LOCAL_WORKER_URL, coreURL, wasmURL }), LOAD_TIMEOUT_MS, details, 'load');
            console.info('[KEFE] FFmpeg runtime loaded', details);
            return ffmpeg;
        } catch (error) {
            encoderPromise = null;
            try { ffmpeg?.terminate?.(); } catch {}
            // Only the module/core-asset fetch itself failing means the cached
            // bytes might be bad; a downstream ffmpeg.load()/runtime error
            // doesn't implicate the cache, so leave it intact for the retry.
            if (error?.stage === 'ENCODER_ASSET' || error?.operation === 'core-assets' || error?.operation === 'module-load') invalidateCoreAssets();
            throw error?.name === 'ExportDiagnosticError' ? error : encoderFailure('ENCODER_LOAD', 'load', error, details);
        }
    })();
    return encoderPromise;
}
export function releaseEncoder(encoder) {
    if (encoderPromise) encoderPromise = null;
    // Only tear down this FFmpeg instance's worker/WASM memory. The cached
    // module + core/wasm blob URLs are intentionally kept alive so the next
    // segment (or the next export) can reuse them instead of re-downloading.
    try { encoder?.terminate?.(); } catch {}
}
export const ENCODER_VERSIONS = Object.freeze({ ffmpeg: FF_VERSION, core: CORE_VERSION });
