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
    const glowSize = linaClamp(Number(style.pulseGlowSize) || 1, 0, 2.5);
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
    const spaceWidth = ctx.measureText(' ').width;
    const accent = colour;
    const baseAlpha = linaClamp(phase.alpha);

    ctx.save();
    ctx.globalAlpha *= baseAlpha;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    timedRows.forEach((rowWords, rowIndex) => {
        if (!rowWords.length) return;
        const widths = rowWords.map(word => ctx.measureText(word.text).width);
        const totalWidth = widths.reduce((sum, value) => sum + value, 0) + spaceWidth * (rowWords.length - 1);
        let x = (w - totalWidth) * 0.5;
        const y = firstY + rowIndex * rowHeight;
        const placements = rowWords.map((word, index) => {
            const item = { word, x, width: widths[index] };
            x += widths[index] + spaceWidth;
            return item;
        });

        // Establish a quiet, fully filled text layer first. The reveal colours the
        // actual glyphs instead of tracing their outer edges.
        ctx.save();
        ctx.globalAlpha *= 0.27;
        ctx.fillStyle = '#FFFFFF';
        placements.forEach(item => ctx.fillText(item.word.text, item.x, y));
        ctx.restore();

        placements.forEach(item => {
            const timing = U.wordProgress({ time: item.word.start, endTime: item.word.end }, time, 0.06);
            const reveal = linaClamp(timing.sweep);
            if (reveal <= 0.002) return;
            const revealWidth = item.width * reveal;
            if (revealWidth <= 0) return;

            ctx.save();
            ctx.beginPath();
            ctx.rect(item.x - 1, y - size, revealWidth + 2, size * 2);
            ctx.clip();

            // Soft bloom is kept behind a crisp, solid glyph fill.
            if (glowSize > 0.01) {
                ctx.save();
                ctx.fillStyle = accent;
                ctx.shadowColor = accent;
                ctx.shadowBlur = size * 0.16 * glowSize;
                ctx.globalAlpha *= 0.38 + timing.pulse * 0.18;
                ctx.fillText(item.word.text, item.x, y);
                ctx.restore();
            }

            const fill = ctx.createLinearGradient(item.x, y - size * 0.55, item.x, y + size * 0.55);
            fill.addColorStop(0, '#FFFFFF');
            fill.addColorStop(0.42, accent);
            fill.addColorStop(1, accent);
            ctx.fillStyle = fill;
            ctx.globalAlpha *= 0.94 + timing.pulse * 0.06;
            ctx.fillText(item.word.text, item.x, y);

            // A narrow specular pass follows the active word front, not an
            // arbitrary screen-wide beat, keeping the motion tied to the vocal.
            if (reveal < 0.995) {
                const headX = item.x + revealWidth;
                const head = ctx.createLinearGradient(headX - size * 0.12, 0, headX + size * 0.12, 0);
                head.addColorStop(0, 'rgba(255,255,255,0)');
                head.addColorStop(0.5, 'rgba(255,255,255,0.9)');
                head.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = head;
                ctx.globalAlpha *= 0.7;
                ctx.fillRect(headX - size * 0.12, y - size * 0.48, size * 0.24, size * 0.96);
            }
            ctx.restore();
        });

        // Fine ECG-like pulse accent beneath each row, restrained enough to
        // support the lyric rather than compete with it.
        const progress = rowWords.reduce((value, word) => {
            const p = U.wordProgress({ time: word.start, endTime: word.end }, time, 0.06).sweep;
            return Math.max(value, linaClamp(p));
        }, 0);
        const traceY = y + size * 0.64;
        const traceWidth = Math.min(totalWidth, w * 0.72);
        const traceX = (w - traceWidth) * 0.5;
        const traceProgress = linaClamp(progress);
        if (traceProgress > 0.01) {
            const beatWindow = ((time % 1.05) + 1.05) % 1.05 / 1.05;
            const beat = Math.exp(-0.5 * Math.pow((((beatWindow - 0.415 + 1.5) % 1) - 0.5) / 0.035, 2));
            ctx.save();
            ctx.beginPath();
            ctx.rect(traceX, traceY - size * 0.15, traceWidth * traceProgress, size * 0.3);
            ctx.clip();
            ctx.beginPath();
            ctx.moveTo(traceX, traceY);
            const points = 96;
            for (let i = 1; i <= points; i++) {
                const p = i / points;
                const qrs = Math.exp(-0.5 * Math.pow((p - 0.52) / 0.018, 2));
                const pre = Math.exp(-0.5 * Math.pow((p - 0.44) / 0.025, 2));
                const post = Math.exp(-0.5 * Math.pow((p - 0.59) / 0.03, 2));
                const wave = Math.sin(p * Math.PI * 8) * 0.025 - pre * 0.07 + qrs * (0.22 + beat * 0.08) - post * 0.1;
                ctx.lineTo(traceX + traceWidth * p, traceY - size * amplitude * wave);
            }
            ctx.strokeStyle = accent;
            ctx.lineWidth = Math.max(0.8, size * 0.009);
            ctx.globalAlpha *= 0.22 + beat * 0.1;
            ctx.shadowColor = accent;
            ctx.shadowBlur = size * 0.035 * glowSize;
            ctx.stroke();
            ctx.restore();
        }
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
