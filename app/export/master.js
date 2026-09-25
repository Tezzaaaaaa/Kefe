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

