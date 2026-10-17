(() => {
  'use strict';
/* =========================================================================
 * PULSE EFFECT (Standalone Module)
 * ========================================================================= */

const linaClamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const linaSmooth = (value) => { const t = linaClamp(value); return t * t * (3 - 2 * t); };
const linaSmoother = (value) => { const t = linaClamp(value); return t * t * t * (t * (t * 6 - 15) + 10); };
const hasFiniteNumber = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));

function linaNormaliseLine(lines, index) {
    if (!Array.isArray(lines) || index < 0 || index >= lines.length) return null;
    const source = lines[index];
    const start = Number(source.time) || 0;
    const nextLineTime = hasFiniteNumber(lines[index + 1]?.time) ? Number(lines[index + 1].time) : null;
    const end = hasFiniteNumber(source.endTime) ? Number(source.endTime) : (nextLineTime !== null ? nextLineTime : start + 3);
    const vocalEnd = hasFiniteNumber(source.vocalEndTime) ? Number(source.vocalEndTime) :
        (source.words && source.words.length > 0 && hasFiniteNumber(source.words[source.words.length - 1]?.endTime) ? Number(source.words[source.words.length - 1].endTime) : end);
    return { ...source, time: start, endTime: end, vocalEndTime: vocalEnd, nextLineTime };
}

function linaFindActiveLine(lines, time) {
    let index = -1;
    for (let i = 0; i < lines.length; i++) {
        if (hasFiniteNumber(lines[i].time) && time >= Number(lines[i].time)) index = i;
        else break;
    }
    return index;
}

function activeEffectLine(lines, time) {
    const index = linaFindActiveLine(lines, time);
    return index >= 0 ? linaNormaliseLine(lines, index) : null;
}

/* Per-word timing aligned 1:1 with the whitespace tokens of the line. Real word timing when it lines up, else the engine's vocal-capped estimate. */
function pulseWords(line, next, tokens) {
    const U = window.kefeEffectUtils;
    let words = U.wordsFor(line, next);
    if (words.length !== tokens.length) {
        const model = window.kefeLyricModel;
        const start = Number(line.time) || 0, end = Number(line.endTime) || start + 3;
        words = model ? model.estimateWords(line.text, start, end, true) : tokens.map((t, i) => ({ text: t, time: start + (i / tokens.length) * (end - start), endTime: start + ((i + 1) / tokens.length) * (end - start) }));
    }
    return tokens.map((t, i) => ({ text: t, start: Number(words[i].time), end: Number(words[i].endTime) }));
}

function drawPulseLine(ctx, w, h, style, line, next, time, phase) {
    const text = String(line.text || '').trim();
    if (!text || !w || !h) return;
    const U = window.kefeEffectUtils;
    const amplitude = linaClamp(Number(style.pulseAmplitude) || 0.4, 0.05, 1);
    const glowSize = Number(style.pulseGlowSize) || 1;
    const colour = style.accentColor || '#FFFFFF';
    const fontSize = Number(style.fontSize) || 76;
    const tokens = text.split(/\s+/).filter(Boolean);
    if (!tokens.length) return;

    const perWord = pulseWords(line, next, tokens);
    const contract = window.KEFE_TYPE?.effects?.pulse || {};
    const face = String(contract.weight || 400), fam = contract.family || 'AuraSerif';
    const setF = (c, sz) => { c.font = face + ' ' + sz + 'px "' + fam + '",Arial,sans-serif'; };
    const layout = U.layoutText(ctx, text, {
        setFont: setF, size: fontSize, minSize: 18, maxWidth: w * 0.88,
        maxHeight: h * 0.58, lineHeight: 1.12, maxLines: 4
    });
    const size = layout.size;
    setF(ctx, size);
    const rows = layout.lines.map(row => row.split(/\s+/).filter(Boolean));
    const flattened = rows.reduce((n, row) => n + row.length, 0);
    const timedRows = [];
    if (flattened === perWord.length) {
        let k = 0;
        rows.forEach(row => timedRows.push(row.map(() => perWord[k++])));
    } else {
        timedRows.push(perWord);
    }

    const rowHeight = size * 1.12;
    const rowCount = timedRows.length;
    const cy = h * 0.43;
    const lineY = (1 - phase.enter) * size * 0.18 - phase.leave * size * 0.2;
    const firstY = cy + lineY - ((rowCount - 1) * rowHeight) / 2;
    const beatPeriod = 1.05;
    const beatPhase = ((time % beatPeriod) + beatPeriod) % beatPeriod / beatPeriod;
    const traceAmplitude = Math.min(h * 0.17, size * (0.44 + amplitude * 0.38));
    const step = Math.max(1, Math.min(3, w / 900));

    ctx.save();
    ctx.globalAlpha *= linaClamp(phase.alpha);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 8;

    timedRows.forEach((rowWords, rowIndex) => {
        if (!rowWords.length) return;
        const mask = document.createElement('canvas');
        mask.width = Math.max(1, Math.ceil(w));
        mask.height = Math.max(1, Math.ceil(size * 1.55));
        const mctx = mask.getContext('2d', { willReadFrequently: true });
        if (!mctx) return;
        setF(mctx, size);
        mctx.textBaseline = 'alphabetic';
        mctx.textAlign = 'left';
        const baseline = mask.height * 0.72;
        const widths = rowWords.map(word => mctx.measureText(word.text).width);
        const spaceWidth = mctx.measureText(' ').width;
        const totalWidth = widths.reduce((sum, value) => sum + value, 0) + spaceWidth * (rowWords.length - 1);
        let cursor = Math.max(0, (w - totalWidth) / 2);

        // The offscreen surface is geometry only; it is never composited as visible text.
        // Glyph pixels steer the ECG trace itself, so the line becomes the letterforms.
        rowWords.forEach((word, i) => {
            const timing = U.wordProgress({ time: word.start, endTime: word.end }, time, 0.09);
            if (timing.pre > 0.015) {
                mctx.save();
                mctx.globalAlpha = linaClamp(0.25 + 0.75 * timing.pre);
                mctx.fillStyle = '#FFFFFF';
                mctx.fillText(word.text, cursor, baseline);
                mctx.restore();
            }
            cursor += widths[i] + spaceWidth;
        });

        let pixels;
        try {
            pixels = mctx.getImageData(0, 0, mask.width, mask.height).data;
        } catch (_) {
            return;
        }
        const traceY = firstY + rowIndex * rowHeight + size * 0.18;
        const points = [];
        let lastGlyphY = baseline;
        for (let x = 0; x <= w; x += step) {
            const ix = Math.min(mask.width - 1, Math.max(0, Math.floor(x)));
            let bestY = -1;
            let bestDistance = Infinity;
            let runStart = -1;
            for (let y = 0; y <= mask.height; y++) {
                const ink = y < mask.height && pixels[(y * mask.width + ix) * 4 + 3] > 24;
                if (ink && runStart < 0) runStart = y;
                if (!ink && runStart >= 0) {
                    const center = (runStart + y - 1) / 2;
                    const distance = Math.abs(center - lastGlyphY);
                    if (distance < bestDistance) {
                        bestDistance = distance;
                        bestY = center;
                    }
                    runStart = -1;
                }
            }

            const p = ((x / Math.max(1, w)) + beatPhase) % 1;
            const bump = (center, width, height) => height * Math.exp(-0.5 * Math.pow((p - center) / width, 2));
            let ecg = 0;
            ecg -= bump(0.19, 0.035, traceAmplitude * 0.16);
            ecg += bump(0.385, 0.012, traceAmplitude * 0.18);
            ecg -= bump(0.415, 0.009, traceAmplitude);
            ecg += bump(0.447, 0.014, traceAmplitude * 0.38);
            ecg -= bump(0.64, 0.065, traceAmplitude * 0.29);

            let y = traceY + ecg * 0.22;
            if (bestY >= 0) {
                // Track the glyph ink contour, with the heartbeat motion coupled into it.
                lastGlyphY = bestY;
                y = traceY + (bestY - baseline) * 0.72 + ecg * 0.12;
            }
            points.push([x, y]);
        }
        if (points.length < 2) return;

        const strokePath = () => {
            ctx.beginPath();
            points.forEach((point, i) => i ? ctx.lineTo(point[0], point[1]) : ctx.moveTo(point[0], point[1]));
            ctx.stroke();
        };

        // All glow and highlight passes reuse the exact same lyric-shaped path.
        ctx.save();
        ctx.strokeStyle = colour;
        ctx.lineWidth = Math.max(2, size * 0.035);
        ctx.shadowColor = colour;
        ctx.shadowBlur = size * 0.2 * glowSize;
        ctx.globalAlpha *= 0.18;
        strokePath();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = colour;
        ctx.lineWidth = Math.max(1.5, size * 0.018);
        ctx.shadowColor = colour;
        ctx.shadowBlur = size * 0.08 * glowSize;
        ctx.globalAlpha *= 0.92;
        strokePath();
        ctx.restore();

        const headX = ((time * 0.42) % 1) * w;
        const headWidth = Math.max(w * 0.1, size * 1.5);
        const gradient = ctx.createLinearGradient(Math.max(0, headX - headWidth), 0, Math.max(1, headX), 0);
        gradient.addColorStop(0, 'rgba(255,255,255,0)');
        gradient.addColorStop(1, 'rgba(255,255,255,0.95)');
        ctx.save();
        ctx.strokeStyle = gradient;
        ctx.lineWidth = Math.max(1.5, size * 0.026);
        ctx.shadowColor = '#FFFFFF';
        ctx.shadowBlur = size * 0.13 * glowSize;
        strokePath();
        ctx.restore();
    });
    ctx.restore();
}
function drawPulseEffect(ctx, w, h, style, lines, time) {
    const stack = window.kefeEffectUtils.lineStack(lines, time);
    for (const it of stack) drawPulseLine(ctx, w, h, style, it.line, it.next, time, it);
}

  window.kefeEffects = window.kefeEffects || {};
  window.kefeEffects.pulse = drawPulseEffect;
})();
