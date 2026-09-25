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

async function exportVideoFFmpeg({ state, media, config, renderFrame, buildFilename, signal, onProgress }) {
    const master = resolveMasterInfo(state, media);
    const duration = master.duration;
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('Master duration is unavailable (load an audio file or a video with audio)');
    if (!config?.width || !config?.height || !config?.fps) throw new Error('Export configuration is invalid');
    if (typeof renderFrame !== 'function') throw new Error('Export renderer is not connected');

    const target = document.createElement('canvas');
    target.width = config.width;
    target.height = config.height;
    const ctx = target.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Could not create export canvas');

    const quality = getQualityPreset(window.kefeExportQuality || 'medium');
    const totalFrames = Math.max(1, Math.ceil(duration * config.fps));
    let progressHandler = null;
    const progress = makeProgressReporter(onProgress);

    try {
        // Single-pass render: encode every frame in one ffmpeg invocation.
        // Write frames as JPEGs and immediately release the previous
        // frame from the FFmpeg in-memory FS. Peak memory drops from
        // "totalFrames × frameSize" to roughly "one frame".
        const frameNames = [];
        let bytesSinceYield = 0;
        for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
            checkAbort(signal);
            const time = frameIndex / config.fps;
            await seekVideo(media?.video, time, signal);
            await renderFrame(ctx, config.width, config.height, time);
            const frameName = `kefe-frame-${String(frameIndex).padStart(6, '0')}.jpg`;
            const bytes = await canvasToJpeg(target);
            await ffmpeg.writeFile(frameName, bytes);
            frameNames.push(frameName);
            bytesSinceYield += bytes.byteLength;
            // Yield to the browser every ~20MB so GC can run and the UI
            // stays responsive. Long single-pass loops without yields
            // trip iOS and Firefox watchdog timers.
            if (bytesSinceYield > 20 * 1024 * 1024) {
                bytesSinceYield = 0;
                await new Promise(r => setTimeout(r, 0));
            }
            progress(5 + ((frameIndex + 1) / totalFrames) * 70, `Rendering frame ${frameIndex + 1} of ${totalFrames}`);
        }

        progress(76, 'Encoding video…');
        await execChecked(ffmpeg, [
            '-framerate', String(config.fps),
            '-start_number', '0',
            '-i', 'kefe-frame-%06d.jpg',
            '-frames:v', String(totalFrames),
            '-an',
            '-c:v', 'libx264',
            '-preset', 'veryfast',
            '-crf', String(quality.crf),
            '-pix_fmt', 'yuv420p',
            '-r', String(config.fps),
            '-g', String(config.fps * 2),
            '-keyint_min', String(config.fps * 2),
            '-sc_threshold', '0',
            '-fflags', '+genpts',
            '-movflags', '+faststart',
            '-f', 'mp4',
            '-y', 'kefe-video.mp4'
        ], 'video encode');

        // Release all frame JPEGs from the WASM FS before muxing.
        for (const name of frameNames) {
            try { await ffmpeg.deleteFile(name); } catch (_) {}
        }
        frameNames.length = 0;

        // Give the browser a chance to GC before the mux allocates the
        // final MP4 buffer.
        await new Promise(r => setTimeout(r, 100));

        // Recycle the encoder before the mux. A fresh WASM heap on the
        // mux step is what fixed the "Aborted()" failure in testing
        // for similar exports on other KEFE builds.
        releaseEncoder(ffmpeg);
        progress(88, 'Loading muxer…');
        ffmpeg = await loadEncoderResilient(message => progress(88, message));

        checkAbort(signal);
        // Reuse whichever engine instance is still alive from the last
        // segment batch instead of releasing it and booting yet another one —
        // muxing doesn't need a clean heap, and this saves one more full
        // wasm boot on every export.
        if (!ffmpeg) {
            progress(81, 'Loading final muxer…');
            ffmpeg = await loadEncoderResilient(message => progress(81, message));
        } else {
            progress(81, 'Joining segments…');
        }

        const hasAudio = Boolean(master.file);
        let audioName = null;
        if (hasAudio) {
            audioName = 'kefe-audio.bin';
            await ffmpeg.writeFile(audioName, new Uint8Array(await master.file.arrayBuffer()));
        }
        const concatInputName = 'kefe-video.mp4';

        progress(82, 'Joining rendered video');
        const outputName = 'kefe-final.mp4';
        progressHandler = ({ progress: ffProgress }) => { if (Number.isFinite(ffProgress)) progress(82 + Math.max(0, Math.min(1, ffProgress)) * 18, 'Finalising MP4'); };
        ffmpeg.on('progress', progressHandler);
        try {
            const muxArgs = [
                '-probesize', '50M',
                '-analyzeduration', '10M',
                '-fflags', '+genpts',
                '-i', concatInputName
            ];
            if (audioName) muxArgs.push(
                '-probesize', '50M',
                '-analyzeduration', '10M',
                '-fflags', '+genpts',
                '-i', audioName
            );
            muxArgs.push('-map', '0:v:0');
            if (audioName) {
                muxArgs.push('-map', '1:a:0', '-c:a', 'aac', '-b:a', quality.audioBitrate, '-af', 'aresample=async=1:first_pts=0');
            } else {
                muxArgs.push('-an');
            }
            muxArgs.push('-c:v', 'copy', '-t', duration.toFixed(3), '-max_muxing_queue_size', '4096', '-movflags', '+faststart', '-y', outputName);
            await execChecked(ffmpeg, muxArgs, 'final MP4');
        } finally {
            ffmpeg.off('progress', progressHandler);
            progressHandler = null;
        }

        checkAbort(signal);

        // Free WASM heap before reading the output. On Firefox/Zen and
        // long exports, readFile allocates a JS buffer the size of the
        // MP4; without deleting the inputs first the WASM heap and the
        // JS heap together exceed the browser's memory ceiling and
        // ffmpeg exits with code 1 right at the finish line.
        try { await ffmpeg.deleteFile(concatInputName); } catch (_) {}
        if (audioName) { try { await ffmpeg.deleteFile(audioName); } catch (_) {} }
        try { await ffmpeg.deleteFile('kefe-frame-00000.jpg'); } catch (_) {}

        progress(90, 'Reading final MP4…');
        const data = await ffmpeg.readFile(outputName);
        if (!data?.byteLength || data.byteLength < 1024) throw new Error('FFmpeg produced an empty MP4');
        progress(100, 'Export complete');
        return { blob: new Blob([data], { type: 'video/mp4' }), filename: buildFilename?.() || 'KEFE Visualiser.mp4' };
    } finally {
        if (progressHandler && ffmpeg) { try { ffmpeg.off('progress', progressHandler); } catch {} }
        if (ffmpeg) releaseEncoder(ffmpeg);
}


/*
 * Default production exporter:
 * WebCodecs + Mediabunny uses the browser's native H.264 encoder where
 * available, with hardware acceleration preferred. FFmpeg.wasm remains the
 * compatibility fallback for browsers/devices that cannot provide the
 * required WebCodecs path.
 */
async function exportVideoMediaRecorder({ state, media, config, renderFrame, buildFilename, signal, onProgress }) {
    // Real-time MediaRecorder capture: VP9 in a WebM container. Firefox
    // cannot encode H.264 via WebCodecs, so this is the fallback for
    // Gecko-based browsers. Recording is real-time — a 3-minute song
    // takes 3 minutes to export — but never hits the WASM memory ceiling
    // the FFmpeg path does.
    const master = resolveMasterInfo(state, media);
    const duration = master.duration;
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('Master duration is unavailable');
    if (typeof renderFrame !== 'function') throw new Error('Export renderer is not connected');

    const target = document.createElement('canvas');
    target.width = config.width;
    target.height = config.height;
    const ctx = target.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Could not create export canvas');

    const fps = config.fps || 30;
    const stream = target.captureStream(fps);

    try {
        const mode = state?.audioSource?.master || 'uploaded';
        const audioEl = mode === 'video' ? media?.video : window.kefeAudioElement;
        if (audioEl) {
            const AC = window.AudioContext || window.webkitAudioContext;
            const actx = new AC();
            const src = actx.createMediaElementSource(audioEl);
            const dest = actx.createMediaStreamDestination();
            src.connect(dest);
            src.connect(actx.destination);
            dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
            if (actx.state === 'suspended') await actx.resume().catch(() => {});
        }
    } catch (e) {
        console.warn('[KEFE] MediaRecorder audio attach failed, video only:', e);
    }

    const mimeCandidates = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp8',
        'video/webm'
    ];
    const mime = mimeCandidates.find(m => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m));
    if (!mime) throw new Error('MediaRecorder has no supported WebM codec in this browser');

    const chunks = [];
    const recorder = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond: Math.max(2_000_000, config.videoBitrate || 4_000_000)
    });
    recorder.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };

    const stopped = new Promise((resolve, reject) => {
        recorder.onstop = () => resolve();
        recorder.onerror = e => reject(e.error || new Error('MediaRecorder error'));
        signal?.addEventListener('abort', () => { try { recorder.stop(); } catch (_) {} reject(abortError()); }, { once: true });
    });

    recorder.start(1000);

    const totalFrames = Math.max(1, Math.ceil(duration * fps));
    const frameIntervalMs = 1000 / fps;
    const startWall = performance.now();

    try {
        for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
            checkAbort(signal);
            const time = frameIndex / fps;
            await renderFrame(ctx, config.width, config.height, time);
            const targetWall = startWall + (frameIndex + 1) * frameIntervalMs;
            const wait = targetWall - performance.now();
            if (wait > 0) await new Promise(r => setTimeout(r, wait));
            const percent = 5 + ((frameIndex + 1) / totalFrames) * 90;
            onProgress?.({ percent, message: `Recording frame ${frameIndex + 1} of ${totalFrames}` });
        }
    } finally {
        try { recorder.stop(); } catch (_) {}
    }

    await stopped;
    if (!chunks.length) throw new Error('MediaRecorder produced no data');

    onProgress?.({ percent: 98, message: 'Finalising WebM…' });
    const blob = new Blob(chunks, { type: mime.split(';')[0] });
    const baseName = (buildFilename?.() || 'KEFE Visualiser.mp4').replace(/\.mp4$/i, '.webm');

    onProgress?.({ percent: 100, message: 'Export complete' });
    return { blob, filename: baseName };
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
