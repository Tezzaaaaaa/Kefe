import { getQualityPreset, getExportConfig } from './config.js';
export { getExportConfig };
import { loadEncoder, releaseEncoder } from './encoder.js';
import { canUseWebCodecsExport, exportVideoWebCodecs } from './webcodecs.js';

function abortError() { return new DOMException('Export cancelled', 'AbortError'); }
function checkAbort(signal) { if (signal?.aborted) throw abortError(); }
function timeout(ms, message) { return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)); }

async function seekVideo(video, time, signal) {
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
    checkAbort(signal);
    const duration = video.duration;
    const target = ((time % duration) + duration) % duration;
    if (Math.abs(video.currentTime - target) < 0.002 && video.readyState >= 2 && !video.seeking) return;
    await Promise.race([
        new Promise((resolve, reject) => {
            let settled = false;
            const cleanup = () => { video.removeEventListener('seeked', done); video.removeEventListener('error', failed); signal?.removeEventListener('abort', cancelled); };
            const finish = fn => { if (settled) return; settled = true; cleanup(); fn(); };
            const done = () => finish(resolve);
            const failed = () => finish(() => reject(new Error('Background video seek failed')));
            const cancelled = () => finish(() => reject(abortError()));
            video.addEventListener('seeked', done, { once: true });
            video.addEventListener('error', failed, { once: true });
            signal?.addEventListener('abort', cancelled, { once: true });
            try { video.currentTime = target; } catch (error) { finish(() => reject(error)); }
        }),
        timeout(10000, `Background video seek timed out at ${target.toFixed(3)}s`)
    ]);
}

async function canvasToJpeg(canvas) {
    const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not encode rendered frame')), 'image/jpeg', 0.92));
    return new Uint8Array(await blob.arrayBuffer());
}

async function execChecked(ffmpeg, args, label) {
    const code = await ffmpeg.exec(args);
    if (Number(code) !== 0) throw new Error(`FFmpeg ${label} failed with exit code ${code}`);
    return code;
}

function makeProgressReporter(onProgress) {
    let high = 0;
    return (value, message) => {
        const clamped = Math.max(0, Math.min(100, value));
        high = Math.max(high, clamped);
        onProgress?.({ percent: high, message });
    };
}


export function resolveMasterInfo(state, media) {
    const mode = state?.audioSource?.master || 'uploaded';
    if (mode === 'video') {
        const duration = Number(media?.video?.duration);
        const file = media?.videoFile || null;
        return { mode, file, duration: Number.isFinite(duration) && duration > 0 ? duration : 0, filename: file?.name || 'background' };
    }
    if (mode === 'none') {
        const vd = Number(media?.video?.duration) || 0;
        const ad = Number(state?.audio?.duration) || 0;
        // For a muted composition, the timeline should at least cover the timed text (mirrors preview logic).
        // A Visualiser never carries timed text, so it contributes nothing here.
        let textEnd = 0;
        const lines = state?.projectType === 'visualiser' ? [] : (state?.lyrics?.lines || []);
        const lastLine = lines[lines.length - 1];
        if (lastLine) {
            const t = Number(lastLine.time);
            const e = Number(lastLine.endTime);
            textEnd = Number.isFinite(e) ? e : (Number.isFinite(t) ? t + 3 : 0);
        }
        return { mode, file: null, duration: Math.max(vd, ad, textEnd + 1, 1), filename: null };
    }
    const duration = Number(state?.audio?.duration);
    return { mode, file: state?.audio?.file || null, duration: Number.isFinite(duration) && duration > 0 ? duration : 0, filename: state?.audio?.file?.name || 'audio' };
}

// How many 4-second segments to encode per FFmpeg engine boot before we
// tear it down and start a fresh one. FFmpeg-wasm's heap doesn't get fully
// reclaimed between operations within one instance, so long exports still
// need a periodic reset to avoid running out of memory (especially on
// mobile Safari) — but resetting *every* segment was the dominant cost in
// every export: each boot re-instantiates/compiles the ~25MB wasm binary,
// which typically costs 1-5+ seconds on its own, before a single frame is
// encoded. Batching several segments per boot cuts that overhead by 5-12x
// while keeping the same memory safety valve, tuned tighter for higher
// resolutions since those hold more decoded frame data in memory per segment.

async function loadEncoderResilient(onStatus) {
    try { return await loadEncoder(onStatus); }
    catch (firstError) {
        // A single failed boot (e.g. a transient CDN hiccup) used to kill the
        // whole export. Give it one more try before treating it as fatal.
        try { return await loadEncoder(onStatus); }
        catch { throw firstError; }
    }
}

export async function exportVideo(options) {
    const { config, signal, onProgress } = options || {};

    if (signal?.aborted) throw abortError();

    let webCodecsAvailable = false;

    try {
        webCodecsAvailable = await canUseWebCodecsExport(config);
    } catch {
        webCodecsAvailable = false;
    }

    if (webCodecsAvailable) {
        try {
            onProgress?.({
                percent: 1,
                message: 'Preparing native WebCodecs export…'
            });

            const result =
                await exportVideoWebCodecs(options);

            console.info('[KEFE] WebCodecs/Mediabunny export completed');
            return result;
        } catch (error) {
            if (error?.name === 'AbortError') {
                throw error;
            }

            console.warn(
                '[KEFE] WebCodecs export unavailable; falling back to FFmpeg.wasm:',
                error
            );

            onProgress?.({
                percent: 2,
                message: 'Switching to compatibility exporter…'
            });
        }
    }

    onProgress?.({
        percent: 3,
        message: 'Preparing MediaRecorder export…'
    });

    const result =
        await exportVideoMediaRecorder(options);

    console.info('[KEFE] MediaRecorder (VP9/WebM) export completed');
    return result;
}
