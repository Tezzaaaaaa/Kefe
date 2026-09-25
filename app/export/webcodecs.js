import {
    ALL_FORMATS,
    BlobSource,
    BufferTarget,
    CanvasSource,
    Conversion,
    Input,
    Mp4OutputFormat,
    Output,
    Quality
} from 'https://cdn.jsdelivr.net/npm/mediabunny@1.58.0/+esm';

import { getQualityPreset } from './config.js';

function abortError() {
    return new DOMException('Export cancelled', 'AbortError');
}

function checkAbort(signal) {
    if (signal?.aborted) throw abortError();
}

function qualityForMediabunny(name, config) {
    const quality = getQualityPreset(name || 'medium');

    if (name === 'ultra') return new Quality('very-high');
    if (name === 'high') return new Quality('high');
    if (name === 'low') return new Quality('low');

    if (name === 'lossless') {
        return new Quality('very-high');
    }

    const pixels = config.width * config.height;
    const minimumBitrate =
        pixels >= 1920 * 1080
            ? 8_000_000
            : pixels >= 1280 * 720
                ? 5_000_000
                : 2_500_000;

    const configuredBitrate =
        Number.parseInt(
            quality.videoBitrate || '0',
            10
        ) * 1_000_000;

    const bitrate = Math.max(
        minimumBitrate,
        Number.isFinite(configuredBitrate)
            ? configuredBitrate
            : 0
    );

    return new Quality({
        bitrate
    });
}

export async function canUseWebCodecsExport(config) {
    if (
        typeof window === 'undefined' ||
        !window.isSecureContext ||
        typeof VideoEncoder === 'undefined' ||
        typeof VideoFrame === 'undefined'
    ) {
        return false;
    }

    try {
        const support =
            await VideoEncoder.isConfigSupported({
                codec: 'avc1.4d4028',
                width: config.width,
                height: config.height,
                bitrate: 8_000_000,
                framerate: config.fps,
                hardwareAcceleration: 'prefer-hardware',
                latencyMode: 'quality'
            });

        return Boolean(support?.supported);
    } catch {
        return false;
    }
}

export async function exportVideoWebCodecs({
    state,
    media,
    config,
    renderFrame,
    buildFilename,
    signal,
    onProgress
}) {
    if (
        typeof VideoEncoder === 'undefined' ||
        typeof VideoFrame === 'undefined'
    ) {
        throw new Error(
            'WebCodecs is unavailable in this browser'
        );
    }

    const masterMode =
        state?.audioSource?.master || 'uploaded';

    const masterFile =
        masterMode === 'video'
            ? media?.videoFile || null
            : masterMode === 'none'
                ? null
                : state?.audio?.file || null;

    const masterDuration =
        masterMode === 'video'
            ? Number(media?.video?.duration) || 0
            : masterMode === 'none'
                ? Math.max(
                    Number(media?.video?.duration) || 0,
                    Number(state?.audio?.duration) || 0,
                    1
                )
                : Number(state?.audio?.duration) || 0;

    if (
        !Number.isFinite(masterDuration) ||
        masterDuration <= 0
    ) {
        throw new Error(
            'Master duration is unavailable'
        );
    }

    if (typeof renderFrame !== 'function') {
        throw new Error(
            'KEFE export renderer is not connected'
        );
    }

    checkAbort(signal);

    const canvas =
        document.createElement('canvas');

    canvas.width = config.width;
    canvas.height = config.height;

    const context =
        canvas.getContext('2d', {
            alpha: false
        });

    if (!context) {
        throw new Error(
            'Could not create WebCodecs export canvas'
        );
    }

    const videoSource =
        new CanvasSource(canvas, {
            codec: 'avc',
            quality: qualityForMediabunny(
                window.kefeExportQuality || 'medium',
                config
            ),
            hardwareAcceleration: 'prefer-hardware',
            latencyMode: 'quality',
            keyFrameInterval: 2
        });

    const output =
        new Output({
            format:
                new Mp4OutputFormat({
                    fastStart: 'in-memory'
                }),
            target:
                new BufferTarget()
        });

    output.addVideoTrack(
        videoSource,
        {
            frameRate: config.fps
        }
    );

    let conversion = null;

    if (masterFile) {
        const input =
            new Input({
                formats: ALL_FORMATS,
                source:
                    new BlobSource(masterFile)
            });

        const audioQuality =
            getQualityPreset(
                window.kefeExportQuality || 'medium'
            );

        const audioBitrate =
            Number.parseInt(
                audioQuality.audioBitrate || '128k',
                10
            ) * 1000;

        conversion =
            await Conversion.init({
                input,
                output,
                composable: true,
                video: {
                    discard: true
                },
                audio: {
                    codec: 'aac',
                    quality:
                        new Quality({
                            bitrate:
                                Number.isFinite(
                                    audioBitrate
                                )
                                    ? audioBitrate
                                    : 128_000
                        })
                },
                trim: {
                    start: 0,
                    end: masterDuration
                },
                tags: {
                    title:
                        state?.audio?.metadata?.title ||
                        undefined,
                    artist:
                        state?.audio?.metadata?.artist ||
                        undefined
                }
            });

        if (!conversion.isValid) {
            throw new Error(
                'The selected master audio cannot be encoded into the KEFE MP4 output'
            );
        }
    }

    let finalized = false;

    try {
        await output.start();

        const conversionPromise =
            conversion
                ? conversion.execute()
                : Promise.resolve();

        const totalFrames =
            Math.max(
                1,
                Math.ceil(
                    masterDuration *
                    config.fps
                )
            );

        for (
            let frameIndex = 0;
            frameIndex < totalFrames;
            frameIndex++
        ) {
            checkAbort(signal);

            const time =
                frameIndex /
                config.fps;

            await renderFrame(
                context,
                config.width,
                config.height,
                time
            );

            await videoSource.add(
                time,
                1 / config.fps
            );

            const percent =
                5 +
                ((frameIndex + 1) /
                    totalFrames) *
                    88;

            onProgress?.({
                percent,
                message:
                    'Encoding frame ' +
                    (frameIndex + 1) +
                    ' of ' +
                    totalFrames
            });
        }

        videoSource.close();

        onProgress?.({
            percent: 94,
            message: 'Finalising MP4…'
        });

        await conversionPromise;

        checkAbort(signal);

        await output.finalize();

        const buffer =
            output.target.buffer;

        if (
            !buffer ||
            buffer.byteLength < 1024
        ) {
            throw new Error(
                'WebCodecs produced an empty MP4'
            );
        }

        finalized = true;

        onProgress?.({
            percent: 100,
            message: 'Export complete'
        });

        return {
            blob:
                new Blob(
                    [buffer],
                    { type: 'video/mp4' }
                ),
            filename:
                buildFilename?.() ||
                'KEFE Visualiser.mp4'
        };
    } catch (error) {
        if (!finalized) {
            try {
                await output.cancel();
            } catch {}
        }

        throw error;
    } finally {
        try {
            videoSource.close();
        } catch {}
    }
}
