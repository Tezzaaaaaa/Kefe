const MEDIABUNNY_URL = 'https://cdn.jsdelivr.net/npm/mediabunny@1.58.1/+esm';

let mediabunnyPromise = null;

function abortError() {
    return new DOMException('Export cancelled', 'AbortError');
}

function checkAbort(signal) {
    if (signal?.aborted) throw abortError();
}

function bitrateForQuality(quality) {
    const raw = String(quality?.videoBitrate || '').toLowerCase();
    const value = Number.parseFloat(raw.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(value) || value <= 0) return 3_000_000;
    if (raw.includes('m')) return Math.round(value * 1_000_000);
    if (raw.includes('k')) return Math.round(value * 1_000);
    return Math.round(value);
}

function audioBitrateForQuality(quality) {
    const raw = String(quality?.audioBitrate || '').toLowerCase();
    const value = Number.parseFloat(raw.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(value) || value <= 0) return 128_000;
    if (raw.includes('m')) return Math.round(value * 1_000_000);
    if (raw.includes('k')) return Math.round(value * 1_000);
    return Math.round(value);
}

async function loadMediabunny() {
    if (!mediabunnyPromise) {
        mediabunnyPromise = import(MEDIABUNNY_URL).catch(error => {
            mediabunnyPromise = null;
            throw error;
        });
    }
    return mediabunnyPromise;
}

function masterFileFor(state, media) {
    const mode = state?.audioSource?.master || 'uploaded';
    if (mode === 'video') return media?.videoFile || null;
    if (mode === 'none') return null;
    return state?.audio?.file || null;
}

async function prepareAudioConversion({ Mediabunny, masterFile, output, quality }) {
    if (!masterFile) return null;

    const { Input, ALL_FORMATS, BlobSource, Conversion, Quality } = Mediabunny;
    const input = new Input({
        formats: ALL_FORMATS,
        source: new BlobSource(masterFile),
    });

    try {
        const audioTrack = await input.getPrimaryAudioTrack();
        if (!audioTrack) {
            input.dispose();
            return null;
        }

        const conversion = await Conversion.init({
            input,
            output,
            tracks: 'primary',
            video: { discard: true },
            audio: {
                codec: 'aac',
                quality: new Quality({ bitrate: audioBitrateForQuality(quality) }),
            },
            composable: true,
        });

        return { input, conversion };
    } catch (error) {
        input.dispose();
        throw error;
    }
}

export async function canUseWebCodecsExport(config, quality) {
    try {
        if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') return false;
        const Mediabunny = await loadMediabunny();
        const codec = await Mediabunny.getFirstEncodableVideoCodec(
            ['avc'],
            {
                width: config.width,
                height: config.height,
                quality: new Mediabunny.Quality({ bitrate: bitrateForQuality(quality) }),
            },
        );
        return codec === 'avc';
    } catch {
        return false;
    }
}

/**
 * Modern KEFE export:
 * canvas renderer -> Mediabunny CanvasSource -> WebCodecs H.264 -> MP4 muxer.
 *
 * The old FFmpeg/WASM pipeline remains the compatibility fallback in
 * app/export/index.js. This path removes JPEG intermediates and keeps video
 * encoding/container work in native browser media APIs where available.
 */
export async function exportVideoWebCodecs({
    state,
    media,
    config,
    renderFrame,
    signal,
    quality,
    onProgress,
}) {
    if (!(await canUseWebCodecsExport(config, quality))) {
        throw new Error('WebCodecs H.264 export is not supported on this device');
    }
    if (String(window.kefeExportQuality || '').toLowerCase() === 'lossless') {
        throw new Error('Lossless export uses the FFmpeg compatibility path');
    }

    checkAbort(signal);

    const Mediabunny = await loadMediabunny();
    const {
        Output,
        Mp4OutputFormat,
        BufferTarget,
        CanvasSource,
        Quality,
    } = Mediabunny;

    const masterFile = masterFileFor(state, media);
    const duration = Number(
        state?.audioSource?.master === 'video'
            ? media?.video?.duration
            : state?.audioSource?.master === 'none'
                ? Math.max(Number(media?.video?.duration) || 0, Number(state?.audio?.duration) || 0, 1)
                : state?.audio?.duration,
    );

    if (!Number.isFinite(duration) || duration <= 0) {
        throw new Error('Master duration is unavailable');
    }

    const canvas = document.createElement('canvas');
    canvas.width = config.width;
    canvas.height = config.height;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Could not create WebCodecs export canvas');

    const output = new Output({
        format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
        target: new BufferTarget(),
    });

    const videoSource = new CanvasSource(canvas, {
        codec: 'avc',
        quality: new Quality({ bitrate: bitrateForQuality(quality) }),
        latencyMode: 'quality',
        keyFrameInterval: 2,
        hardwareAcceleration: 'prefer-hardware',
        contentHint: 'motion',
    });

    output.addVideoTrack(videoSource, { frameRate: config.fps });

    const metadata = state?.audio?.metadata || {};
    const title = String(metadata.title || '').trim();
    const artist = String(metadata.artist || '').trim();
    if (title || artist) {
        output.setMetadataTags({
            ...(title ? { title } : {}),
            ...(artist ? { artist } : {}),
        });
    }

    let audio = null;

    try {
        audio = await prepareAudioConversion({
            Mediabunny,
            masterFile,
            output,
            quality,
        });

        checkAbort(signal);
        onProgress?.({ percent: 2, message: 'Starting hardware-accelerated export…' });

        await output.start();

        const totalFrames = Math.max(1, Math.ceil(duration * config.fps));

        const renderTask = (async () => {
            for (let frame = 0; frame < totalFrames; frame++) {
                checkAbort(signal);

                const time = frame / config.fps;
                await renderFrame(ctx, config.width, config.height, time);

                await videoSource.add(
                    time,
                    1 / config.fps,
                    {
                        keyFrame: frame === 0 || frame % Math.max(1, Math.round(config.fps * 2)) === 0,
                    },
                );

                onProgress?.({
                    percent: 5 + ((frame + 1) / totalFrames) * 82,
                    message: `Encoding frame ${frame + 1} of ${totalFrames} with WebCodecs…`,
                });
            }

            videoSource.close();
        })();

        const audioTask = audio
            ? (async () => {
                audio.conversion.onProgress = progress => {
                    onProgress?.({
                        percent: 5 + Math.max(0, Math.min(1, progress)) * 82,
                        message: 'Encoding master audio…',
                    });
                };
                await audio.conversion.execute();
            })()
            : Promise.resolve();

        try {
            await Promise.all([renderTask, audioTask]);
        } catch (error) {
            try { await output.cancel(); } catch {}
            throw error;
        }

        checkAbort(signal);
        onProgress?.({ percent: 90, message: 'Finalising MP4…' });
        await output.finalize();

        const buffer = output.target.buffer;
        if (!buffer?.byteLength) throw new Error('WebCodecs produced an empty MP4');

        onProgress?.({ percent: 100, message: 'Export complete' });

        return {
            blob: new Blob([buffer], { type: 'video/mp4' }),
            engine: 'webcodecs',
        };
    } finally {
        try { audio?.input?.dispose?.(); } catch {}
        try { canvas.width = 1; canvas.height = 1; } catch {}
    }
}
