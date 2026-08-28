import { loadEncoder, releaseEncoder } from './encoder.js';

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

export function getExportConfig(preset = '720p', aspect = '9:16') {
    const presets = { '1080p': { size: 1080, fps: 30 }, '720p': { size: 720, fps: 30 }, '480p': { size: 480, fps: 24 }, instagram: { size: 1080, fps: 30, forceVertical: true }, tiktok: { size: 1080, fps: 30, forceVertical: true } };
    const selected = presets[preset] || presets['720p'];
    const selectedAspect = selected.forceVertical ? '9:16' : aspect;
    const [a, b] = selectedAspect.split(':').map(Number);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) throw new Error('Invalid export aspect ratio');
    const size = selected.size;
    if (selectedAspect === '16:9') return { width: Math.round(size * 16 / 9), height: size, fps: selected.fps };
    if (selectedAspect === '1:1') return { width: size, height: size, fps: selected.fps };
    return { width: size, height: Math.round(size * b / a), fps: selected.fps };
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
        let textEnd = 0;
        const lines = state?.lyrics?.lines || [];
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

export async function exportVideo({ state, media, config, renderFrame, buildFilename, signal, onProgress }) {
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

    const totalFrames = Math.max(1, Math.ceil(duration * config.fps));
    const framesPerSegment = Math.max(config.fps * 2, Math.round(config.fps * 4));
    const segmentChunks = [];
    let combinedSegmentBytes = 0;
    let ffmpeg = null;
    let progressHandler = null;
    const progress = makeProgressReporter(onProgress);

    try {
        const segmentCount = Math.ceil(totalFrames / framesPerSegment);
        for (let segment = 0; segment < segmentCount; segment++) {
            checkAbort(signal);
            progress(4 + (segment / segmentCount) * 66, `Loading encoder for segment ${segment + 1} of ${segmentCount}…`);
            ffmpeg = await loadEncoder(message => progress(4 + (segment / segmentCount) * 66, message));

            const firstFrame = segment * framesPerSegment;
            const frameCount = Math.min(framesPerSegment, totalFrames - firstFrame);
            const frameNames = [];
            try {
                for (let local = 0; local < frameCount; local++) {
                    checkAbort(signal);
                    const frameIndex = firstFrame + local;
                    const time = frameIndex / config.fps;
                    await seekVideo(media?.video, time, signal);
                    await renderFrame(ctx, config.width, config.height, time);
                    const frameName = `kefe-frame-${String(local).padStart(5, '0')}.jpg`;
                    await ffmpeg.writeFile(frameName, await canvasToJpeg(target));
                    frameNames.push(frameName);
                    progress(5 + ((frameIndex + 1) / totalFrames) * 65, `Rendering frame ${frameIndex + 1} of ${totalFrames}`);
                }

                const segmentName = `kefe-segment-${String(segment).padStart(4, '0')}.ts`;
                progress(5 + ((firstFrame + frameCount) / totalFrames) * 65, `Encoding segment ${segment + 1} of ${segmentCount}…`);
                await execChecked(ffmpeg, ['-framerate', String(config.fps), '-start_number', '0', '-i', 'kefe-frame-%05d.jpg', '-frames:v', String(frameCount), '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(config.fps), '-g', String(config.fps * 2), '-keyint_min', String(config.fps * 2), '-sc_threshold', '0', '-f', 'mpegts', '-y', segmentName], `segment ${segment + 1}`);
                const segmentData = new Uint8Array(await ffmpeg.readFile(segmentName));
                if (!segmentData.byteLength) throw new Error(`FFmpeg produced an empty segment ${segment + 1}`);
                segmentChunks.push(segmentData);
                combinedSegmentBytes += segmentData.byteLength;
                progress(5 + ((firstFrame + frameCount) / totalFrames) * 65, `Encoded segment ${segment + 1} of ${segmentCount}`);
            } finally {
                for (const frameName of frameNames) { try { await ffmpeg.deleteFile(frameName); } catch {} }
                try { await ffmpeg.deleteFile(`kefe-segment-${String(segment).padStart(4, '0')}.ts`); } catch {}
                releaseEncoder(ffmpeg);
                ffmpeg = null;
            }
        }

        checkAbort(signal);
        if (!combinedSegmentBytes) throw new Error('No video segments were produced');

        progress(81, 'Loading final muxer…');
        ffmpeg = await loadEncoder(message => progress(81, message));

        const combinedTs = new Uint8Array(combinedSegmentBytes);

        // The master audio source decides what is muxed — preview and export share the same selection.
        const hasAudio = Boolean(master.file);
        let audioName = null;
        if (hasAudio) {
            const extMatch = /\\.([a-z0-9]+)$/i.exec(master.filename || '');
            const ext = (extMatch ? extMatch[1] : master.mode === 'video' ? 'mp4' : 'audio').toLowerCase();
            audioName = `kefe-audio.${ext}`;
            await ffmpeg.writeFile(audioName, new Uint8Array(await master.file.arrayBuffer()));
        }

        let offset = 0;
        for (const chunk of segmentChunks) { combinedTs.set(chunk, offset); offset += chunk.byteLength; }
        segmentChunks.length = 0;
        const concatInputName = 'kefe-video.ts';
        await ffmpeg.writeFile(concatInputName, combinedTs);

        progress(82, 'Joining rendered video');
        const outputName = 'kefe-final.mp4';
        progressHandler = ({ progress: ffProgress }) => { if (Number.isFinite(ffProgress)) progress(82 + Math.max(0, Math.min(1, ffProgress)) * 18, 'Finalising MP4'); };
        ffmpeg.on('progress', progressHandler);
        try {
            const muxArgs = ['-i', concatInputName];
            if (audioName) muxArgs.push('-i', audioName);
            muxArgs.push('-map', '0:v:0');
            if (audioName) {
                muxArgs.push('-map', '1:a:0', '-c:a', 'aac', '-b:a', '192k', '-af', 'aresample=async=1:first_pts=0');
            } else {
                muxArgs.push('-an');
            }
            muxArgs.push('-c:v', 'copy', '-t', duration.toFixed(3), '-movflags', '+faststart', '-y', outputName);
            await execChecked(ffmpeg, muxArgs, 'final MP4');
        } finally {
            ffmpeg.off('progress', progressHandler);
            progressHandler = null;
        }

        checkAbort(signal);
        const data = await ffmpeg.readFile(outputName);
        if (!data?.byteLength || data.byteLength < 1024) throw new Error('FFmpeg produced an empty MP4');
        progress(100, 'Export complete');
        return { blob: new Blob([data], { type: 'video/mp4' }), filename: buildFilename?.() || 'KEFE Visualiser.mp4' };
    } finally {
        if (progressHandler && ffmpeg) { try { ffmpeg.off('progress', progressHandler); } catch {} }
        if (ffmpeg) releaseEncoder(ffmpeg);
        segmentChunks.length = 0;
    }
}
